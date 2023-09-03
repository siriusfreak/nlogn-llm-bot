import {Problem, Step, User} from "../types";

export interface QueryResult {
    rows: any[];
    rowCount: number;
}
export interface Database {
    executeQuery(query: string, params: any[]): Promise<QueryResult>
}

export class UserRepository {
    constructor(private db: Database) {}

    public async getUserById(userId: string): Promise<User | null> {
        try {
            const result = await this.db.executeQuery('SELECT * FROM users WHERE id = $1', [userId]);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error fetching user by ID:', error);
            throw new Error('Failed to fetch user by ID.');
        }
    }

    public async decrementLastGeneration(userId: number): Promise<void> {
            await this.db.executeQuery('UPDATE users SET left_generations = left_generations - 1 WHERE id = $1', [userId]);
    }

    public async  getUserByTelegramId(telegramId: number): Promise<User | null> {
        try {
            const result = await this.db.executeQuery('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
            if (result.rowCount === 0) return null;
            return {
                id: result.rows[0].id,
                telegramID: result.rows[0].telegram_id,
                contesterID: result.rows[0].contester_id,
                contestID: result.rows[0].contest_id || null,
                problemID: result.rows[0].problem_id || null,
                problemSlug: result.rows[0].problem_slug || null,
                lastStep: result.rows[0].last_step,
                lastGenerationDT: new Date(result.rows[0].last_generation_dt + 'Z'),
                role: result.rows[0].role,
                leftGenerations: result.rows[0].left_generations,
            } || null;
        } catch (error) {
            console.error('Error fetching user by ID:', error);
            throw new Error('Failed to fetch user by ID.');
        }
    }

    public async setLastGenerationDTToNow(userId: number): Promise<void> {
        try {
            await this.db.executeQuery('UPDATE users SET last_generation_dt = NOW() WHERE id = $1', [userId]);
        } catch (error) {
            console.error('Error updating user last generation DT:', error);
            throw new Error('Failed to update user last generation DT.');
        }
    }

    public async getUserContestId(userId: string): Promise<number | null> {
        try {
            const result = await this.db.executeQuery('SELECT contest_id FROM users WHERE id = $1', [userId]);
            return result.rows[0].contest_id || null;
        } catch (error) {
            console.error('Error fetching user by ID:', error);
            throw new Error('Failed to fetch user by ID.');
        }
    }


    public async getUserProblem(userId: number): Promise<Problem | null> {
        try {
            const result = await this.db.executeQuery('SELECT problem_id FROM users WHERE id = $1', [userId]);
            if (result.rowCount === 0) return null;
            return {
                id: result.rows[0].problem_id,
                slug: result.rows[0].problem_slug,
            }
        } catch (error) {
            console.error('Error fetching user by ID:', error);
            throw new Error('Failed to fetch user by ID.');
        }
    }

    public async updateUserContestId(userId: number, contestId: number | null): Promise<void> {
        try {
            await this.db.executeQuery('UPDATE users SET contest_id = $1 WHERE id = $2', [contestId, userId]);
        } catch (error) {
            console.error('Error updating user contest ID:', error);
            throw new Error('Failed to update user contest ID.');
        }
    }

    public async updateUserLastStep(userId: number, lastStep: Step): Promise<void> {
        try {
            await this.db.executeQuery('UPDATE users SET last_step = $1 WHERE id = $2', [lastStep, userId]);
        } catch (error) {
            console.error('Error updating user step:', error);
            throw new Error('Failed to update user step.');
        }
    }

    public async updateUserProblem(userId: number, problemId: number | null, problemSlug: string | null): Promise<void> {
        try {
            await this.db.executeQuery('UPDATE users SET problem_id = $1, problem_slug = $2 WHERE id = $3',
                [problemId, problemSlug, userId]);
        } catch (error) {
            console.error('Error updating user problem ID:', error);
            throw new Error('Failed to update user problem ID.');
        }
    }

    public async createUser(telegramId: number, contesterId: number, username: string): Promise<number> {
        try {
            const result = await this.db.executeQuery(
                'INSERT INTO users (telegram_id, contester_id, username) VALUES ($1, $2, $3) RETURNING id',
                [telegramId, contesterId, username]
            );

            if (result.rowCount === 1 && result.rows[0].id) {
                return result.rows[0].id;
            } else {
                throw new Error('Failed to create user.');
            }
        } catch (error) {
            console.error('Error creating user:', error);
            throw new Error('Failed to create user.');
        }
    }

    public async updateUserRole(username: string, role: string): Promise<boolean> {
        const result = await this.db.executeQuery('UPDATE users SET role = $1 WHERE username = $2 RETURNING id', [role, username]);
        if (result.rowCount >= 1) {
            return true;
        } else {
            return false;
        }
    }
}

