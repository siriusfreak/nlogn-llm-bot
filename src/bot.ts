import {Logger} from "tslog";
import loadConfig from "./config";
import {Telegraf} from "telegraf";
import {BotContext} from "./types";
import {OpenAIChat} from "./clients/openai";
import Database from "./database/database";
import TemplatesRepository from "./models/templates";
import {UserRepository} from "./models/user";
import {GenerationsRepository} from "./models/generation";
import {ButtonsGenerator} from "./front/buttons";
import Replies from "./front/replies";
import Generator from "./generator";
import {BotService} from "./service";
import {setupMiddleware} from "./middleware";
import setupDispatcher from "./dispatcher";
import Contester from "./clients/contester";
import ActionsRepository from "./models/action";
import RateLimit from "./rateLimit";
import GroupsRepository from "./models/groups";


const logger = new Logger<any>({ name: "myLogger" });

const config = loadConfig('config/config.yaml');
const bot = new Telegraf<BotContext>(config.botToken);
const openAIChat = new OpenAIChat(config.openAI);
const db = new Database(config.db);
const contester = new Contester(config.contesterToken);

db.connect().then(() => {
    const templatesRepository = new TemplatesRepository(db);
    const userRepository = new UserRepository(db);
    const generationsRepository = new GenerationsRepository(db);
    const actionsRepository = new ActionsRepository(db);
    const groupRepository = new GroupsRepository(db);
    const generator = new Generator(templatesRepository, generationsRepository, openAIChat);


    const buttons = new ButtonsGenerator(generationsRepository, contester);
    const replies = new Replies();

    const rateLimiter = new RateLimit(config.rateLimit);
    const service = new BotService(replies, userRepository, groupRepository, generator, generationsRepository,
        buttons, openAIChat, actionsRepository, contester, templatesRepository, rateLimiter);

    setupMiddleware(bot, userRepository, groupRepository, logger, service);
    setupDispatcher(bot, service);

    bot.help((ctx) => {
        ctx.reply('Для начала работы с ботом необходимо авторизоваться. ' +
            'Для этого введи свой ID в системе NLogN. ' +
            'После этого ты сможешь выбрать контест и задачу, которую хочешь решить. ')
    });

    bot.catch((err, ctx) => {
        console.log(`Ooops, encountered an error for ${ctx.updateType}`, err)
    })

    process.once('SIGINT', () => bot.stop('SIGINT'))
    process.once('SIGTERM', () => bot.stop('SIGTERM'))

    return bot.launch()
})
