import {ChatMessage} from "../types";

export interface SelectProblemAction {
    contestId: number;
    problemId: number;
    problemSlug: string;
}

export interface AuthorizationAction {
    userId: number;
    telegramId: number;
    contesterId: number;
}

export interface ChatWithGPTAction {
    contestId: number;
    problemId: number;
    problemSlug: string;
    dialog: ChatMessage[];
    generationId: number;
    generationLevel: number;
    solutionId: number
}

export interface VoteAction {
    generationId: number;
    isUpVote: boolean;
}

export interface SelectContestAction {
    contestId: number;
}

export type ActionType = 'AUTHORIZATION' | 'SELECT_CONTEST' | 'SELECT_PROBLEM' | 'CHAT_WITH_GPT' | 'VOTE';

export interface Action {
    actionId: number;
    userId: number;
    type: ActionType;
    details: AuthorizationAction | SelectContestAction | SelectProblemAction | ChatWithGPTAction;  // Additional information about the action, if needed.
    timestamp: Date;  // The time when the action occurred.
}

export interface QueryResult {
    rows: any[];
    rowCount: number;
}

export interface Database {
    executeQuery(query: string, params: any[]): Promise<QueryResult>;
}

export default class ActionsRepository {
    constructor(private db: Database) {
    }

    async logAction(
        userId: number,
        type: ActionType,
        details: AuthorizationAction | SelectContestAction | SelectProblemAction | ChatWithGPTAction | VoteAction
    ): Promise<void> {
        const marshalledDetails = JSON.stringify(details);
        await this.db.executeQuery('INSERT INTO actions (user_id, type, details, timestamp) VALUES ($1, $2, $3, $4)', [userId, type, marshalledDetails, new Date()]);
    }

    async getLastActionByUserId(userId: number): Promise<Action | null> {
        const resp = await this.db.executeQuery('SELECT * FROM actions WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 1', [userId]);
        if (resp.rowCount > 0) {
            return {...resp.rows[0], details: JSON.parse(resp.rows[0].details)};
        }
        return null;
    }

    async getLastActionByUserIdAndType(userId: number, type: ActionType): Promise<Action | null> {
        const resp = await this.db.executeQuery('SELECT * FROM actions WHERE user_id = $1 AND type = $2 ORDER BY timestamp DESC LIMIT 1', [userId, type]);
        if (resp.rowCount > 0) {
            return {...resp.rows[0]};
        }
        return null;
    }

    async getActionsByUserId(userId: number): Promise<Action[]> {
        const resp = await this.db.executeQuery('SELECT * FROM actions WHERE user_id = $1 ORDER BY timestamp DESC', [userId]);
        return resp.rows.map(row => ({...row, details: JSON.parse(row.details)}));
    }

}

