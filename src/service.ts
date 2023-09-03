import {Context} from "telegraf";
import { escapers } from "@telegraf/entity";
import {
    BotContext,
    Button,
    ChatMessage,
    Contest,
    Generation, Group,
    Problem,
    ProblemStatement,
    SolutionDetails,
    User,
    UserData
} from "./types";
import {OpenAIChat} from "./clients/openai";

// @ts-ignore
import Mustache from "mustache";
import {GenerationTask} from "./generator";
import {Template} from "./models/templates";
import {is} from "cheerio/lib/api/traversing";
import { marked } from "marked";
import markedCodePreview from "marked-code-preview";

export interface UserRepository {
    updateUserContestId(userId: number, contestId: number | null): Promise<void>;
    updateUserLastStep(userId: number, lastStep: string): Promise<void>;
    updateUserProblem(userId: number, problemId: number | null, problemSlug: string | null): Promise<void>;
    createUser(telegramId: number, contesterId: number, username: string): Promise<number>;
    getUserByTelegramId(telegramId: number): Promise<any>;
    setLastGenerationDTToNow(userId: number): Promise<void>;
    decrementLastGeneration(userId: number): Promise<void>;
    updateUserRole(username: string, role: string): Promise<boolean>
}

export interface Generator {
    waitForGeneration(generationId: number): Promise<Generation>
    addTask(task: GenerationTask, dontCreateNew: boolean): Promise<{ generationId: number, isNew: boolean}>
    regenerate(generationId: number, dontCreateNew: boolean): Promise<{ generationId: number, isNew: boolean}>
}
export interface Replies {
    selectContestReply(ctx: Context): Promise<void>;
    wrongContestIDReply(ctx: Context): Promise<void>;
    contestIDSelected(ctx: Context, contestId: number): Promise<void>;
    afterGenerationReply(ctx: BotContext, buttons: Button[][]): Promise<void>;
    wrongGenerationIDReply(ctx: BotContext): Promise<void>;
    startGenerationReply(ctx: Context, problemSlug: string, problemTitle: string): Promise<void>;
    wrongContestIDReply(ctx: Context): Promise<void>;
    wrongProblemIDReply(ctx: Context): Promise<void>;
    youReturnedToProblemSelection(ctx: Context): Promise<void>;
    somethingWentWrongReply(ctx: Context): Promise<void>;
    startGenerationSolutionExplanationReply (ctx: any, problemSlug: string, problemTitle: string, solutionId: number): Promise<void>;
    thankYouForVoteReply(ctx: any): Promise<void>;
    wrongGenerationIDReply(ctx: any): Promise<void>;
    afterProblemSelectedReply(ctx: Context, problemTitle: string, problemSlug: string, buttons: Button[][]) : Promise<void>;
    afterGenerationChatReply(ctx: BotContext, buttons: Button[][]): Promise<void>;
}
export interface Buttons {
    solutionsButtons(userId: number | null, contestId: number | null, problemId: number | null, problemSlug: string | null): Promise<Button[]>;
    toContestsButton(): Promise<Button[]>;
    toProblemsButton(): Promise<Button[]>;
    hintButton(problemId: number, problemSlug: string): Promise<Button[]>
    variantsButtons(problemId: number): Promise<Button[]>;
    voteButtons(generationId: number): Promise<Button[]>;
}

export interface GenerationRepository {
    addVote(generationId: number, isUpVote: boolean): Promise<void>;
}

export interface Contester {
    fetchAllContests(contesterId: number): Promise<Contest[]>;
    fetchProblemsForContest(contestId: number): Promise<Problem[]>;
    fetchProblemDetails(contestId: number, problemSlug: string): Promise<ProblemStatement>;
    fetchProblemSolution(contestId: number, problemId: number): Promise<string | null>;
    fetchUserSolutions(contesterId: number, contestId: number, problemId: number): Promise<any>;
    fetchSolutionDetails( solutionId: number): Promise<SolutionDetails>;
    fetchTelegramLinkCode(contesterId: number): Promise<any>;
    fetchUserData(userName: string): Promise<UserData | null>;
}

export interface ActionsRepository {
    logAction(userId: number, type: string, details: any): Promise<void>;
    getLastActionByUserIdAndType(userId: number, type: string): Promise<any>;
}

export interface TemplatesRepository {
    getTemplate(templateName: string): Promise<Template>;
    upsertTemplate(templateName: string, template: string): Promise<void>
}

export interface RateLimiter {
    isRateLimited(ctx: BotContext): Promise<boolean>
}

export interface GroupsRepository {
    addGroup(chatId: number): Promise<number>
}

export class BotService {
    constructor(private replies: Replies, private users: UserRepository, private groups: GroupsRepository, private generator: Generator, private generations: GenerationRepository,
        private buttons: Buttons, private chat: OpenAIChat, private actions: ActionsRepository, private contester: Contester,
                private templates: TemplatesRepository, private rateLimiter: RateLimiter) {
    }

    async onVote(ctx: BotContext, generationId: number, isUpVote: boolean): Promise<void> {
            if (generationId <= 0) {
                await this.replies.wrongGenerationIDReply(ctx)
                return;
            }

            await this.actions.logAction(ctx.User.id, 'VOTE',
                {generationId: generationId, isUpVote})
            await this.generations.addVote(generationId, isUpVote)
            await this.replies.thankYouForVoteReply(ctx);
    }

    async onSetAdmin(ctx: BotContext, username: string): Promise<void> {
        if (ctx.User.role !== 'ADMIN') {
            await ctx.reply("Ты не админ")
            return
        }

        const res = await this.users.updateUserRole(username, 'ADMIN')
        if (res) {
            await ctx.reply(`Теперь ${username} админ`)
        } else {
            await ctx.reply("Не могу найти пользователя")
        }
    }
    async onSolution (ctx: BotContext, solutionId: number): Promise<void>  {
        if (solutionId <= 0) {
            await ctx.reply("Неправильный ID посылки. Введи /helpme <номер посылки>")
            return
        }

        const userSolution =
            await this.contester.fetchSolutionDetails(solutionId);

        if (ctx.User.role != 'ADMIN' && userSolution.userId != ctx.User.contesterID) {
            await ctx.reply("Это не твоя посылка")
            return
        }

        if (userSolution.verdict === "OK") {
            await ctx.reply("Это решение уже принято. Ты молодец!")
            return
        }


        const contestId = userSolution.contestId
        const problemSlug = userSolution.problemSlug
        const problemId = userSolution.problemId

        const problem =
            await this.contester.fetchProblemDetails(contestId, problemSlug);
        let problemSolutionCode =
            await this.contester.fetchProblemSolution(contestId, problemId);

        if (problemSolutionCode === null) {
            console.log("No solution code")
            problemSolutionCode = ""
        }


        await this.replies.startGenerationSolutionExplanationReply(ctx, problemSlug, problem.title, solutionId);

        const templateName = 'solutionComment';
        const templateVariables = {
            problem: problem.text,
            solution: problemSolutionCode,
            code: userSolution.sourceCode,
            compilerMessage: userSolution.compilationError,
            contesterMessage: userSolution.verdict,
            programErrorTrace: userSolution.errorTrace,
        }

        const rateLimited = await this.rateLimiter.isRateLimited(ctx)

        let generationId = 0
        let isNew = false
        try {
            ({ generationId, isNew } = await this.generator.addTask({
                previousGenerationId: 0,
                problemId: problemId,
                solutionId: solutionId,
                generationLevel: 2,
                templateName: templateName,
                templateVariables: templateVariables
            }, rateLimited));
            if (isNew) {
                await this.users.decrementLastGeneration(ctx.User.id)
                await this.users.setLastGenerationDTToNow(ctx.User.id)
            }
        } catch (e) {
            if (rateLimited) {
                await ctx.reply("Превышен лимит запросов к OpenAI. Попробуйте позже")
                return
            }
            throw e
        }


        this.generator.waitForGeneration(generationId).then(async (generation: Generation) => {
            await this.actions.logAction(ctx.User.id, 'CHAT_WITH_GPT',
                {
                    contestId: contestId, problemId: problemId, problemSlug: problemSlug,
                    dialog: [{
                        text: generation.input,
                        isUser: true,
                    }, {
                        text: generation.output,
                        isUser: false,
                    }],
                    generationId: generationId,
                    generationLevel: generation.generationLevel,
                    solutionId: generation.solutionId,
                });
            await this.users.updateUserLastStep(ctx.User.id, 'CHAT_WITH_GPT');

            const renderer = {
                code(code: string, infostring: string | undefined, escaped: boolean): string | false {
                    // Escape HTML special characters in the code
                    const escapedCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    // Check if language is provided
                    return `<pre>${escapedCode}</pre>\n\n`;
                 },
                paragraph(text: string): string {
                    return text + '\n\n';
                }
            };

            const htmlOutput =  marked.use({
                renderer,
            }).parse(generation.output)
            const removeTags = (htmlString: string, tagsToRemove: string[]): string => {
                // Create a regular expression pattern to match the tags
                const regexPattern = tagsToRemove.map(tag => `<${tag}[^>]*>|</${tag}>`).join('|');
                const regex = new RegExp(regexPattern, 'gi');

                // Replace the matched tags with an empty string
                return htmlString.replace(regex, '');
            }
            const htmlOutputWithoutCode = removeTags(htmlOutput, ['ol', 'il', 'li', 'ul'])

            await ctx.replyWithHTML(htmlOutputWithoutCode);

            if (ctx.IsGroupChat) {
                await ctx.replyWithMarkdownV2(`Код посылки: \`\`\` \n${userSolution.sourceCode}\n \`\`\``)
                await this.replies.afterGenerationChatReply(ctx, [
                    await this.buttons.voteButtons(generationId),
                    ])
            } else {
                await this.replies.afterGenerationReply(ctx, [
                    await this.buttons.variantsButtons(problemId),
                    await this.buttons.voteButtons(generationId),
                    await this.buttons.solutionsButtons(ctx.User.contesterID, ctx.User.contestID, ctx.User.problemID, ctx.User.problemSlug),
                    await this.buttons.toProblemsButton(),
                    await this.buttons.toContestsButton(),
                ]);
            }
        }).catch(async (error) => {
            console.log(error)
            await ctx.reply("Произошла ошибка при общении с OpenAI. Попробуйте позже")
        })
    }

    async onMessage (ctx: BotContext):Promise<void> {
        if (ctx.User.lastStep === 'AUTHORIZATION') {
            return this.listUserContests(ctx);
        }

        if (ctx.User.lastStep == 'SELECT_CONTEST') {
            if (ctx.User.contestID === null) {
                return this.listUserContests(ctx);
            } else {
                return this.listProblemsForContest(ctx);
            }
        }

        if (ctx.User.lastStep == 'SELECT_PROBLEM') {
            if (ctx.User.contestID === null) {
                return this.listUserContests(ctx);
            } else {
                return this.listProblemsForContest(ctx);
            }
        }

        if (ctx.User.lastStep == 'PROBLEM_SELECTED') {
            await ctx.reply("Выбери один из вариантов выше")
        }

        if (ctx.User.lastStep == 'CHAT_WITH_GPT' && ctx.User.contestID !== null && ctx.User.problemID !== null) {
            const lastAction = await this.actions.getLastActionByUserIdAndType(ctx.User.id, 'CHAT_WITH_GPT');
            if (lastAction !== null) {
                if ("dialog" in lastAction.details) {
                    return this.freeTextInput(ctx, ctx.User.contestID, ctx.User.problemID, lastAction.details.generationId,
                        lastAction.details.problemSlug,
                        lastAction.details.generationLevel, lastAction.details.solutionId, lastAction.details.dialog)
                }
            }
        }

        await this.replies.somethingWentWrongReply(ctx);
        return this.listUserContests(ctx);
    }


    async processAuthorization(ctx: BotContext, telegramId: number, users: UserRepository): Promise<void> {
        if (ctx.IsGroupChat) {
            const msg = await ctx.reply(ctx.RawUserName + "\nТебе надо авторизоваться, чтобы пользоваться мной. Перейди ко мне в личные сообщения @nlogn_llm_bot и я помогу тебе!");
            setTimeout(async () => {
                await ctx.deleteMessage(msg.message_id)
            }, 10000);
            return ;
        }
        const messageSlpit = ctx.Message.split(" ");
        if (messageSlpit.length !== 2) {
            await ctx.reply("Привет. Не могу узнать тебя. Ты должен отправить мне через пробел своё имя пользователя и код для привязки Telegram отсюда: https://contest.nlogn.info/profile");
            return;
        }

        const userName = messageSlpit[0];
        const verificationCode = messageSlpit[1].trim();

        await ctx.reply("Проверяю твои данные... Ты сказал, что твой ID в системе " + userName + " и код " + verificationCode);
        const userData = await this.contester.fetchUserData(userName)
        if (userData === null) {
            await ctx.reply("Не могу найти тебя по имени пользователю в системе. Попробуй ещё раз!");
            return;
        }
        await ctx.reply("Твой ID в системе: " + userData.id);

        const realLinkCode = await this.contester.fetchTelegramLinkCode(userData.id);
        if (realLinkCode === null) {
            await ctx.reply("Не могу найти твой код для авторизации. Попробуй ещё раз!");
            return;
        }

        if (realLinkCode !== verificationCode) {
            await ctx.reply("Код не совпадает. Попробуй ещё раз!");
            return;
        }

        try {
            // Store new user's information in the database.
            const userId = await this.users.createUser(telegramId, userData.id, userData.username);
            await this.actions.logAction(userId, 'AUTHORIZATION', {
                contesterId: userData.id,
                userId: userId,
                telegramId: telegramId
            })
            await users.updateUserLastStep(userId, 'AUTHORIZATION');
            await ctx.reply("Успешная авторизация!");

            const user = await users.getUserByTelegramId(ctx.from?.id || 0);
            if (user === null) {
                return;
            }
            ctx.User = user

            return
        } catch (error) {
            console.error('Error during authorization:', error);
            await ctx.reply("Что-то пошло не так. Попробуй ещё раз!");
        }

    }

    async freeTextInput(ctx: BotContext, contestId: number, problemId: number, previousGenerationId: number, problemSlug: string,
                                 generationLevel: number, solutionId: number, dialog: ChatMessage[]): Promise<void> {
        const templateName = 'freeText';
        generationLevel += 1;
        const userMessage = ctx.Message;
        const templateVariables = {
            userMessage: userMessage,
        }


        const generationTask: GenerationTask = {
            previousGenerationId: previousGenerationId,
            problemId: problemId,
            solutionId: solutionId,
            generationLevel: generationLevel,
            templateName: templateName,
            templateVariables: templateVariables
        }

        const rateLimited = await this.rateLimiter.isRateLimited(ctx)

        let generationId= 0
        let isNew = false
        try {
            ({ generationId, isNew } = await this.generator.addTask(generationTask, rateLimited))
            if (isNew) {
                await this.users.decrementLastGeneration(ctx.User.id)
                await this.users.setLastGenerationDTToNow(ctx.User.id)
            }

        } catch (e) {
            if (rateLimited) {
                await ctx.reply("Превышен лимит запросов к OpenAI. Попробуйте позже")
                return
            }
            throw e
        }

        await this.users.updateUserLastStep(ctx.User.id, 'CHAT_WITH_GPT');
        this.generator.waitForGeneration(generationId).then(async (generation: Generation) => {
            await this.actions.logAction(ctx.User.id, 'CHAT_WITH_GPT',
                {
                    contestId: contestId, problemId: problemId, problemSlug: problemSlug,
                    generationId: generationId, generationLevel: generationLevel,
                    solutionId: solutionId, dialog: [
                        ...dialog,
                        {
                            text: generation.input,
                            isUser: true,
                        },
                        {
                            text: generation.output,
                            isUser: false,
                        }
                    ]
                });


            await ctx.reply(generation.output);


            await this.replies.afterGenerationReply(ctx, [
                await this.buttons.variantsButtons(problemId),
                await this.buttons.voteButtons(generationId),
                await this.buttons.solutionsButtons(ctx.User.contesterID, ctx.User.contestID, ctx.User.problemID, ctx.User.problemSlug),
                await this.buttons.toProblemsButton(),
            ]);

        }).catch(async (error) => {
            console.log(error)
            await ctx.reply("Произошла ошибка при общении с OpenAI. Попробуйте позже")

        })
    }

    private SELECT_PROBLEM_MESSAGE = "Вот задачи в этом контесте. Выбери одну:";

    async listProblemsForContest(ctx: BotContext): Promise<void> {
        if (ctx.User.contestID === null) {
            await ctx.reply("Не выбран контест. Попробуй ещё раз.");
            return;
        }

        let problems;
        try {
            problems = await this.contester.fetchProblemsForContest(ctx.User.contestID);
        } catch (error) {
            console.error('Error fetching problems:', error);
            await ctx.reply("Ошибка получения задач. Попробуй ещё раз.");
            return;
        }

        if (!problems || problems.length === 0) {
            await ctx.reply("Не найдено задач для данного контеста. Жесть какая-то.");
            return;
        }

        const options = {
            reply_markup: {
                inline_keyboard: [
                    ...problems.map(problem => [{
                        text: problem.slug + ". " + problem.title,
                        callback_data: `problem_${problem.id}_${problem.slug}`
                    }]),
                    [
                        {text: "Вернуться к выбору контеста", callback_data: "contests"}
                    ]
                ]
            }
        };

        await ctx.reply(this.SELECT_PROBLEM_MESSAGE, options);
    }


    private SELECT_CONTEST_MESSAGE = "Здесь твои контесты. Выбери один из них:";
    async listUserContests(ctx: BotContext): Promise<void> {
        let contests;
        try {
            contests = await this.contester.fetchAllContests(ctx.User.contesterID);
        } catch (error) {
            console.error('Error fetching contests:', error);
            await ctx.reply("Ошибка при получении списка контестов. Попробуй ещё раз.");
            return;
        }

        if (!contests || contests.length === 0) {
            await ctx.reply("Контест с таким ID не найден :( Попробуй ещё раз.");
            return;
        }

        const options = {
            reply_markup: {
                inline_keyboard: contests.map(contest => [{
                    text: contest.name,
                    callback_data: `contest_${contest.id}`  // Prefixing with 'contest_' to easily identify in callback handler
                }])
            }
        };

        await ctx.reply(this.SELECT_CONTEST_MESSAGE, options);
    }


    async onRegenerate (ctx: BotContext, regenerationId: number)  {
        await ctx.reply("Создаю новый ответ")

        const rateLimited = await this.rateLimiter.isRateLimited(ctx)
        let generationId = 0
        let isNew = false
        try {
            ({ generationId, isNew } = await this.generator.regenerate(regenerationId, rateLimited))
            if (generationId == -1) {
                return
            }
            if (isNew) {
                await this.users.decrementLastGeneration(ctx.User.id)
                await this.users.setLastGenerationDTToNow(ctx.User.id)
            }
        } catch (e) {
            if (rateLimited) {
                await ctx.reply("Превышен лимит запросов к OpenAI. Попробуйте позже")
                return
            }
            throw e
        }
        this.generator.waitForGeneration(generationId).then(async (generation: Generation) => {
            await ctx.reply(generation.output)

            if (ctx.IsGroupChat) {
                await this.replies.afterGenerationChatReply(ctx, [
                    await this.buttons.voteButtons(generationId),
                    ])
            } else {
                await this.replies.afterGenerationReply(ctx, [
                    await this.buttons.variantsButtons(generation.problemId),
                    await this.buttons.voteButtons(generation.id),
                    await this.buttons.solutionsButtons(ctx.User.contesterID, ctx.User.contestID, ctx.User.problemID, ctx.User.problemSlug),
                    await this.buttons.toProblemsButton(),
                    await this.buttons.toContestsButton(),
                ]);
            }
        }).catch(async (error) => {
            console.log(error)
            await ctx.reply("Произошла ошибка при общении с OpenAI. Попробуйте позже")
        })
    }

    async onProblem (ctx: BotContext,
                             problemId: number,
                             problemSlug: string,
    ): Promise<void> {
        if (ctx.User.contestID === null) {
            return this.replies.wrongContestIDReply(ctx);
        }

        await this.actions.logAction(ctx.User.id, 'SELECT_PROBLEM', {
                contestId: ctx.User.contestID,
                problemId: problemId,
                problemSlug: problemSlug,
            }
        )

        if (problemId <= 0) {
            return this.replies.wrongProblemIDReply(ctx);
        }

        await this.users.updateUserProblem(ctx.User.id, problemId, problemSlug)
        await this.users.updateUserLastStep(ctx.User.id, 'PROBLEM_SELECTED');

        const problemDescription =
            await this.contester.fetchProblemDetails(ctx.User.contestID, problemSlug);

        await this.replies.afterProblemSelectedReply(ctx, problemDescription.title, problemSlug, [
            await this.buttons.hintButton(problemId, problemSlug),
            await this.buttons.variantsButtons(problemId),
            await this.buttons.solutionsButtons(ctx.User.contesterID, ctx.User.contestID, problemId, problemSlug),
            await this.buttons.toProblemsButton(),
            await this.buttons.toContestsButton(),
        ]);
    }

    async onHint(ctx: BotContext, problemId: number, problemSlug: string): Promise<void> {
        if (ctx.User.contestID === null) {
            return this.replies.wrongContestIDReply(ctx);
        }

        if (problemId <= 0) {
            return this.replies.wrongProblemIDReply(ctx);
        }
        const problemDescription =
            await this.contester.fetchProblemDetails(ctx.User.contestID, problemSlug);
        let problemSolution =
            await this.contester.fetchProblemSolution(ctx.User.contestID, problemId);
        if (problemSolution === null) {
            console.log("No solution code")
            problemSolution = ""
        }

        await this.replies.startGenerationReply(ctx, problemSlug, problemDescription.title);

        const rateLimited = await this.rateLimiter.isRateLimited(ctx)

        let generationId = 0
        let isNew = false
        try {
            ({generationId, isNew} = await this.generator.addTask({
                previousGenerationId: 0,
                problemId: problemId,
                solutionId: 0,
                generationLevel: 0,
                templateName: 'problemRequest',
                templateVariables: {
                    problem: problemDescription.text,
                    solution: problemSolution
                }
            }, rateLimited))
            if (isNew) {
                await this.users.decrementLastGeneration(ctx.User.id)
                await this.users.setLastGenerationDTToNow(ctx.User.id)
            }
        } catch (e) {
            if (rateLimited) {
                await ctx.reply("Превышен лимит запросов к OpenAI. Попробуйте позже")
                return
            }
            throw e
        }

        this.generator.waitForGeneration(generationId).then(async (generation: Generation) => {
            if (ctx.User.contestID === null) {
                return this.replies.wrongContestIDReply(ctx);
            }

            await this.actions.logAction(ctx.User.id, 'CHAT_WITH_GPT',
                {
                    contestId: ctx.User.contestID,
                    problemId: generation.problemId,
                    problemSlug: problemSlug,
                    dialog: [{
                        text: generation.input,
                        isUser: true,
                    }, {
                        text: generation.output,
                        isUser: false,
                    }],
                    generationId: generation.id,
                    generationLevel: generation.generationLevel,
                    solutionId: generation.solutionId,
                });
            await this.users.updateUserLastStep(ctx.User.id, 'CHAT_WITH_GPT');

            await ctx.reply(generation.output);

            await this.replies.afterGenerationReply(ctx, [
                await this.buttons.variantsButtons(problemId),
                await this.buttons.voteButtons(generationId),
                await this.buttons.solutionsButtons(ctx.User.contesterID, ctx.User.contestID, problemId, problemSlug),
                await this.buttons.toProblemsButton(),
                await this.buttons.toContestsButton(),
            ]);
        }).catch(async (error) => {
            console.log(error)
            await ctx.reply("Произошла ошибка при общении с OpenAI. Попробуйте позже")
        })
    }

    async onGeneration(ctx: BotContext, generationID: number): Promise<void> {
        if (generationID <= 0) {
            await this.replies.wrongGenerationIDReply(ctx);
            return;
        }

        const generation = await this.generator.waitForGeneration(generationID);
        if (generation === null) {
            await this.replies.wrongGenerationIDReply(ctx);
            return;
        }

        if (generation.output != "") {
            await ctx.reply(generation.output);
        }

        await this.replies.afterGenerationReply(ctx, [
            await this.buttons.variantsButtons(generation.problemId),
            await this.buttons.voteButtons(generationID),
            await this.buttons.solutionsButtons(ctx.User.contesterID, ctx.User.contestID, ctx.User.problemID, ctx.User.problemSlug),
            await this.buttons.toProblemsButton(),
            await this.buttons.toContestsButton(),
        ]);
    }

    async onProblems(ctx: BotContext): Promise<void> {
        await this.users.updateUserProblem(ctx.User.id, null, null)
        await this.replies.youReturnedToProblemSelection(ctx);

        if (ctx.User.contestID === null) {
            await this.replies.wrongContestIDReply(ctx);
            await this.listUserContests(ctx)
            return;
        } else {
            await this.listProblemsForContest(ctx)
            return
        }
    }

    async listContests(ctx: BotContext): Promise<void> {
        await this.users.updateUserContestId(ctx.User.id, null);
        await this.replies.selectContestReply(ctx);
        await this.listUserContests(ctx);
    }

    async updateUserContest(ctx: BotContext, contestID: number): Promise<void> {
        if (contestID <= 0) {
            return this.replies.wrongContestIDReply(ctx);
        }
        await this.users.updateUserContestId(ctx.User.id, contestID);
        ctx.User.contestID = contestID

        await this.actions.logAction(ctx.User.id, 'SELECT_CONTEST', {contestId: contestID})
        await this.users.updateUserLastStep(ctx.User.id, 'SELECT_CONTEST');
        await this.replies.contestIDSelected(ctx, contestID);
        await this.listProblemsForContest(ctx);
    }

    async onGetTemplate(ctx: BotContext, templateName: string): Promise<void> {
        if (ctx.User.role !== 'ADMIN') {
            await ctx.reply("Только администратор может получать шаблоны")
            return
        }
        const template = await this.templates.getTemplate(templateName)
        await ctx.reply(template.template)
    }

    async onSetTemplate(ctx: BotContext, templateName: string, template: string): Promise<void> {
        if (ctx.User.role !== 'ADMIN') {
            await ctx.reply("Только администратор может обновлять шаблоны")
            return
        }
        try {
            await this.templates.upsertTemplate(templateName, template)
            await ctx.reply("Шаблон обновлён")
        } catch (e) {
            console.log(e)
            await ctx.reply("Произошла ошибка при обновлении шаблона")
        }
    }

    async onAuthorizeGroup(ctx: BotContext): Promise<void> {
        if (ctx.User.role !== 'ADMIN') {
            await ctx.reply("Только администратор бота может авторизовать группу. Если ты ученик, то напиши мне /helpme <номер посылки> и я помогу тебе!")
            return
        }
        if (ctx.GroupId >= 0) {
            await ctx.reply("Группа уже авторизована")
            return
        }
        await this.groups.addGroup(ctx.ChatId)
        await ctx.reply("Группа авторизована")
    }
}
