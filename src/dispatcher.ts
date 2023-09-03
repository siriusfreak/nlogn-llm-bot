import { Telegraf } from 'telegraf';
import {BotContext} from "./types";
import {message} from "telegraf/filters";

export interface Service {
    listContests(ctx: BotContext): Promise<void>
    updateUserContest(ctx: BotContext, contestID: number): Promise<void>
    onGeneration(ctx: BotContext, generationId: number): Promise<void>
    onMessage (ctx: BotContext): Promise<void>
    onProblem(ctx: BotContext, problemId: number, problemSlug: string): Promise<void>
    onProblems(ctx: BotContext): Promise<void>
    onRegenerate(ctx: BotContext, generationId: number): Promise<void>
    onSolution (ctx: BotContext, solutionId: number): Promise<void>
    listUserContests(ctx: BotContext): Promise<void>
    onVote(ctx: BotContext, generationId: number, isUpVote: boolean): Promise<void>
    onGetTemplate(ctx: BotContext, templateName: string): Promise<void>
    onSetTemplate(ctx: BotContext, templateName: string, template: string): Promise<void>
    onHint(ctx: BotContext, problemId: number, problemSlug: string): Promise<void>
    onSetAdmin(ctx: BotContext, username: string): Promise<void>
    onAuthorizeGroup(ctx: BotContext): Promise<void>
}

export default function setupDispatcher(bot: Telegraf<BotContext>, service: Service): void {
    setupOnHelpMe(bot, service);
    setupOnAuthorizeGroup(bot, service);
    setupOnGetTemplate(bot, service);
    setupOnSetTemplate(bot, service);
    setupOnSetAdmin(bot, service);
    setupOnContest(bot, service);
    setupOnGeneration(bot, service);
    setupOnMessage(bot, service);
    setupOnProblem(bot, service);
    setupOnRegenerate(bot, service);
    setupOnSolution(bot, service);
    setupOnStart(bot, service);
    setupOnVote(bot, service);
    setupOnProblems(bot, service);
    setupOnHint(bot, service);
}


function setupOnHelpMe(bot: Telegraf<BotContext>, service: Service): void {
    bot.command('helpme', async (ctx) => {
        if (ctx.IsGroupChat && ctx.GroupId < 0) {
            ctx.reply("Бот не авторизован для данного чата")
            return;
        }
        if (!ctx.IsGroupChat && ctx.User.role !== 'ADMIN') {
            ctx.reply("Теперь вернись в чат своей группы и сможешь со мной общаться!")
            return;
        }
        const solutionId = ctx.payload
        let solutionIdParsed = parseInt(solutionId, 10);
        if (isNaN(solutionIdParsed)) {
            solutionIdParsed = -1
        }

        service.onSolution(ctx, solutionIdParsed).finally()
    });
}

function setupOnVote(bot: Telegraf<BotContext>, service: Service): void {
    bot.action(/^vote(up|down)_([0-9]+)$/, async (ctx) => {
        const upOrDown = ctx.match[1];
        const generationId = ctx.match[2];
        let generationIdParsed = parseInt(generationId, 10);
        if (isNaN(generationIdParsed)) {
            generationIdParsed = -1
        }

        service.onVote(ctx, generationIdParsed, upOrDown === "up").finally()
    });
}

// Define any related constants or configurations specific to this step.
function setupOnStart(bot: Telegraf<BotContext>, service: Service): void {
    bot.command('start', async ctx => {
        if (ctx.IsGroupChat) {
            return;
        }
        if (ctx.User.role !== 'ADMIN') {
            return;
        }
        const f = async (ctx: any)  => {
            if (ctx.User !== null) {
                return service.listUserContests(ctx);
            }
        };
        return f(ctx);
    });
}

function setupOnSetAdmin(bot: Telegraf<BotContext>, service: Service): void {
    bot.command('setadmin', async ctx => {
        const userName = ctx.payload
        service.onSetAdmin(ctx, userName).finally()
    });
}

function setupOnSolution(bot: Telegraf<BotContext>, service: Service): void {
    bot.action(/^solution_([0-9]+)_([0-9]+)_([A-Z]+)_([0-9]+)$/, async (ctx) => {
        if (ctx.IsGroupChat) {
            return;
        }
        if (ctx.User.role !== 'ADMIN') {
            return;
        }

        const solutionId = ctx.match[4];
        let solutionIdParsed = parseInt(solutionId, 10);
        if (isNaN(solutionIdParsed)) {
            solutionIdParsed = -1
        }

        service.onSolution(ctx, solutionIdParsed).finally()
    });
}

function setupOnRegenerate(bot: Telegraf<BotContext>, service: Service): void {
    bot.action(/^regenerate_([0-9]+)$/, async (ctx) => {
        const generationId = ctx.match[1];
        let generationIdParsed = parseInt(generationId, 10);
        if (isNaN(generationIdParsed)) {
            generationIdParsed = -1
            return;
        }

        service.onRegenerate(ctx, generationIdParsed).finally()
    });
}
function setupOnProblem(bot: Telegraf<BotContext>, service: Service): void {
    bot.action('problems', async (ctx) => {
        if (ctx.IsGroupChat) {
            return;
        }
        if (ctx.User.role !== 'ADMIN') {
            return;
        }

        service.onProblems(ctx).finally()
    });

    bot.action(/^problem_([0-9]+)_([A-Z]+)$/, async (ctx) => {
        if (ctx.IsGroupChat) {
            return;
        }
        if (ctx.User.role !== 'ADMIN') {
            return;
        }

        const problemId = ctx.match[1];
        const problemSlug = ctx.match[2];

        let problemIdParsed = parseInt(problemId, 10);
        if (isNaN(problemIdParsed)) {
            problemIdParsed = -1
        }
        service.onProblem(ctx, problemIdParsed, problemSlug).finally()
    });
}

function setupOnHint(bot: Telegraf<BotContext>, service: Service): void {
    bot.action(/^hint_([0-9]+)_([A-Z]+)$/, async (ctx) => {
        if (ctx.IsGroupChat) {
            return;
        }
        if (ctx.User.role !== 'ADMIN') {
            return;
        }

        const problemId = ctx.match[1];
        const problemSlug = ctx.match[2];

        let problemIdParsed = parseInt(problemId, 10);
        if (isNaN(problemIdParsed)) {
            problemIdParsed = -1
        }
        service.onHint(ctx, problemIdParsed, problemSlug).finally()
    });
}

function setupOnMessage(bot: Telegraf<BotContext>, service: Service): void {
    const handleMessage = async (ctx: BotContext) => {
        if (ctx.IsGroupChat) {
            return;
        }
        if (ctx.User.role !== 'ADMIN') {
            return;
        }

        service.onMessage(ctx).finally()
    }
    bot.on(message('text') , handleMessage)
}
function setupOnContest(bot: Telegraf<BotContext>, service: Service): void {
    bot.action('contests', async (ctx: any) => {
        if (ctx.IsGroupChat) {
            return;
        }
        if (ctx.User.role !== 'ADMIN') {
            return;
        }

        service.listContests(ctx).finally()
    });

    bot.action(/^contest_([0-9]+)$/, async (ctx) => {
        if (ctx.IsGroupChat) {
            return;
        }
        if (ctx.User.role !== 'ADMIN') {
            return;
        }

        const contestId = ctx.match[1];
        let contestIdParsed = parseInt(contestId, 10);
        if (isNaN(contestIdParsed)) {
            contestIdParsed = -1
        }

        service.updateUserContest(ctx, contestIdParsed).finally()
    });
}

function setupOnProblems(bot: Telegraf<BotContext>, service: Service): void {
    bot.action('problems', async (ctx: any) => {
        if (ctx.IsGroupChat) {
            return;
        }
        if (ctx.User.role !== 'ADMIN') {
            return;
        }

        service.onProblems(ctx).finally()
    });
}

function setupOnGeneration(bot: Telegraf<BotContext>, service: Service): void {
    bot.action(/^generation_([0-9]+)$/, async (ctx) => {
        if (ctx.IsGroupChat) {
            return;
        }
        if (ctx.User.role !== 'ADMIN') {
            return;
        }

        const generationId = ctx.match[1];
        let generationIdParsed = parseInt(generationId, 10);
        if (isNaN(generationIdParsed)) {
            generationIdParsed = -1
        }
        service.onGeneration(ctx, generationIdParsed).finally()
    });
}

function setupOnGetTemplate(bot: Telegraf<BotContext>, service: Service): void {
    bot.command('getTemplate', async (ctx) => {
        if (ctx.IsGroupChat) {
            return;
        }
        if (ctx.User.role !== 'ADMIN') {
            return;
        }

        const templateName = ctx.payload
        service.onGetTemplate(ctx, templateName).finally()
    })
}

function setupOnSetTemplate(bot: Telegraf<BotContext>, service: Service): void {
    bot.command('setTemplate', async (ctx) => {
        if (ctx.IsGroupChat) {
            return;
        }
        if (ctx.User.role !== 'ADMIN') {
            return;
        }

        const templateName = ctx.payload.split(/\s+/)[0];
        const templateText = ctx.payload.replace(templateName, '')
        service.onSetTemplate(ctx, templateName, templateText).finally()
    })
}

function setupOnAuthorizeGroup(bot: Telegraf<BotContext>, service: Service): void {
    bot.command('authorizeGroup', async (ctx) => {
        if (!ctx.IsGroupChat) {
            return;
        }
        service.onAuthorizeGroup(ctx).finally()
    })
}
