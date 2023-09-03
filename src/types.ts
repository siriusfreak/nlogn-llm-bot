import { Context } from 'telegraf'
import { Logger as TsLogger } from 'tslog'
import exp = require("constants");

export type Logger = TsLogger<any>;

export type Step = 'AUTHORIZATION' | 'SELECT_CONTEST' | 'SELECT_PROBLEM' | 'PROBLEM_SELECTED' | 'CHAT_WITH_GPT';

export type Role = 'USER' | 'ADMIN';

export interface User {
    id: number;
    telegramID: number;
    contesterID: number;
    contestID: number | null;
    problemID: number | null;
    problemSlug: string | null;
    lastStep: Step;
    lastGenerationDT: Date;
    role: Role;
    leftGenerations: number;
}

export interface Problem {
    id: number;
    slug: string;
    title?: string;
}
export interface BotContext extends Context {
    User: User;
    RawUserName: string;
    Message: string;
    Logger: Logger;
    IsGroupChat: boolean;
    ChatId: number;
    GroupId: number;
}

export interface TemplateVariables {
    problem?: string;
    solution?: string;
    code?: string;
    compilerMessage?: string;
    contesterMessage?: string;
    programErrorTrace?: string;
    userMessage?: string;
}

export interface Generation {
    id: number;
    problemId: number;
    previousGenerationId: number;
    generationLevel: number;
    input: string;
    output: string;
    upVotes: number;
    downVotes: number;
    solutionId: number;
    templateName: string;
    templateVariables: TemplateVariables;
    status: 'READY' | 'IN PROGRESS' | 'FAILED';
}

export interface Button {
    text: string;
    callback_data: string;
}

export interface ChatMessage {
    text: string;
    isUser: boolean;
}

export interface Contest {
    id: string;
    name: string;
}


export interface ProblemStatement {
    title: string;
    text: string;
}

export interface Solution {
    id: number;
    verdictId: number | null;
    verdict: string | null;
}

export interface SolutionDetails {
    id: number;
    verdictId?: number;
    verdict?: string;
    sourceCode: string;
    compilationError?: string;
    errorTrace?: string;
    problemSlug: string;
    problemId: number;
    contestId: number;
    userId: number;
}

export interface Group {
    id: number;
    chatId: number;
}

export interface UserData {
    id: number;
    username: string;
}
