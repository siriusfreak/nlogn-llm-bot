import {Telegraf} from "telegraf";
 import {BotContext, Group, User} from "./types";
import {Logger} from "./types";
import {getStartTimestamp} from "./helpers";
import { Update } from "telegraf/typings/core/types/typegram";
export interface UserRepository {
    getUserByTelegramId(telegramId: number): Promise<User | null>
    updateUserLastStep(userId: number, lastStep: string): Promise<void>;
}

export interface GroupsRepository {
    getGropByChatId(chatId: number): Promise<Group | null>
}

export interface Service {
    processAuthorization(ctx: BotContext, telegramId: number, users: UserRepository): Promise<void>
}

export const setupMiddleware = (bot: Telegraf<BotContext>, users: UserRepository, groups: GroupsRepository ,logger: Logger, service: Service) => {
    bot.use(async (ctx, next) => {
        ctx.Logger = logger

        // Extract user from context
        const telegramId = ctx.from?.id
        if (telegramId === undefined) {
            return
        }

        if (ctx.from) {
            let rawUser = ctx.from?.first_name
            if (ctx.from?.last_name) {
                rawUser += " " + ctx.from?.last_name
            }
            if (ctx.from?.username) {
                rawUser += " (@" + ctx.from?.username + ")"
            }
            ctx.RawUserName = rawUser
        }

        ctx.Message = ""
        if (ctx.updateType === 'message') {
            if (ctx.message && ctx.message.date && ctx.message.date < getStartTimestamp()) {
                return;
            }

            if (ctx.message && ctx.message.chat && (ctx.message.chat.type === 'group'  || ctx.message.chat.type === 'supergroup')) {
                ctx.IsGroupChat = true;
                ctx.ChatId = ctx.message.chat.id
            }

            if (ctx.message && 'text' in ctx.message) {
                ctx.Message = ctx.message.text
            }
        }

        if (ctx.updateType === 'callback_query') {
            const callbackQuery = (ctx.update as Update.CallbackQueryUpdate).callback_query

            if (callbackQuery && callbackQuery.message && callbackQuery.message.chat &&
                (callbackQuery.message.chat.type === 'group' || callbackQuery.message.chat.type === 'supergroup')) {

                ctx.IsGroupChat = true;
                ctx.ChatId = callbackQuery.message.chat.id;
            }
        }

        if (ctx.IsGroupChat) {
            const group = await groups.getGropByChatId(ctx.ChatId)
            if (group === null) {
                ctx.GroupId = -1
            } else {
                ctx.GroupId = group.id
            }
        }

        const user = await users.getUserByTelegramId(telegramId)
        if (user === null) {
            return service.processAuthorization(ctx, telegramId, users)
        } else {
            ctx.User = user
            return next()
        }
    })
}
