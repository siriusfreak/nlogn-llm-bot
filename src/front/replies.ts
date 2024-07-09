import Context from "telegraf/typings/context";
import {Button} from "../types";

export default class Replies {
    public async afterGenerationReply(ctx: Context, buttons: Button[][]): Promise<void> {
        await ctx.reply("Ты можешь дальше задавать вопросы (в свободной форме или кликнув на кнопки) или вернуться к выбору задачи!", {
            reply_markup: {
                inline_keyboard: buttons
            }
        });
    }

    public async afterGenerationChatReply(ctx: Context, buttons: Button[][]): Promise<void> {
        await ctx.reply("Проголосуй за мой ответ!", {
            reply_markup: {
                inline_keyboard: buttons
            }
        });
    }

    public async afterProblemSelectedReply(ctx: Context, problemName: string, problemSlug: string, buttons: Button[][]): Promise<void> {
        await ctx.reply(`Ты выбрал задачу ${problemSlug}. ${problemName}. Теперь ты можешь сделать следующее.`, {
            reply_markup: {
                inline_keyboard: buttons
            }
        });
    }


    public async selectContestReply(ctx: Context): Promise<void> {
        await ctx.reply("Теперь выбери контест");
    }

    public async selectProblemReply(ctx: Context): Promise<void> {
        await ctx.reply("Теперь выбери задачу");
    }

    public async wrongContestIDReply(ctx: Context): Promise<void> {
        await ctx.reply("Не могу понять к какому контесту относится твой запрос :( Попробуй ещё раз.");
    }

    public async wrongProblemIDReply(ctx: Context): Promise<void> {
        await ctx.reply("Не могу понять к какой задаче относится твой запрос :( Попробуй ещё раз.");
    }

    public async wrongGenerationIDReply(ctx: Context): Promise<void> {
        await ctx.reply("Не могу понять к какому ответу относится твой запрос :( Попробуй ещё раз.");
    }

    public async wrongSolutionIDReply(ctx: Context): Promise<void> {
        await ctx.reply("Не могу понять к какому решению относится твой запрос :( Попробуй ещё раз.");
    }

    public async contestIDSelected(ctx: Context, contestId: number): Promise<void> {
        await ctx.reply(`Выбран контест номер ${contestId}`);
    }

    public async somethingWentWrongReply(ctx: Context): Promise<void> {
        await ctx.reply("Что-то пошло не так. Попробуй ещё раз!");
    }

    public async youReturnedToProblemSelection(ctx: Context): Promise<void> {
        await ctx.reply("Ты вернулся к выбору задачи!");
    }

    public async startGenerationReply(ctx: Context, slug: string, title: string): Promise<void> {
        await ctx.reply(`Выбранная задача ${slug}. ${title}. Я генерирую решение`)
    }

    public async startGenerationSolutionExplanationReply(ctx: Context, slug: string, title: string, solutionId: number): Promise<void> {
        const msg = await ctx.reply(`Выбранная задача ${slug}. ${title}. Посылка: №${solutionId}. Я генерирую объясненение.`);
        setTimeout(() => {
            ctx.deleteMessage(msg.message_id).finally();
        }, 30000);
    }

    public async thankYouForVoteReply(ctx: Context): Promise<void> {
        await ctx.answerCbQuery("Спасибо за голос!");
    }
}
