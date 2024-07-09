import {ChatMessage, Generation, TemplateVariables} from "../types"; // assuming you're using `pg` as the database driver

export interface QueryResult {
    rows: any[];
    rowCount: number;
}
export interface Database {
    executeQuery(query: string, params: any[]): Promise<QueryResult>
}

export type GenerationStatus = 'IN PROGRESS' | 'FAILED' | 'SUCCESS';
export class GenerationsRepository {
    constructor(private db: Database) {
    }

    public async addGeneration(problemId: number,
                               previousGenerationId: number | null,
                               generationLevel: number, input: string, output: string,
                               templateName: string,
                               templateVariables: TemplateVariables,
                               solutionId: number): Promise<Generation> {
        const query = `
            INSERT INTO generations(problem_id, previous_generation_id, input, output, generation_level, solution_id,
                                    template_name, template_variables)
                                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *;
        `;

        const values = [problemId, previousGenerationId,
            input, output, generationLevel, solutionId, templateName, JSON.stringify(templateVariables)];

        console.log('addGeneration', query, values)
        const {rows} = await this.db.executeQuery(query, values);
        return rows[0];
    }

    public async getPreviousDialog(generationId: number): Promise<ChatMessage[]> {
        // Retrieve the current generation from the database using the generation ID
        const currentGeneration = await this.getGeneration(generationId);
        if (currentGeneration === null) {
            return [];
        }

        // If there is no previous generation, return empty array
        if (currentGeneration.previousGenerationId == 0) {
            return [
                {text: currentGeneration.input, isUser: true},
                {text: currentGeneration.output, isUser: false},
            ];
        }

        // If there is a previous generation, recursively call getPreviousDialog
        // to get the previous dialog and then append the current dialog
        const previousDialog = await this.getPreviousDialog(currentGeneration.previousGenerationId);

        return [
            ...previousDialog
        ];
    }

    public async setGenerationStatusAndResult(generationId: number, status: GenerationStatus, input: string, output: string): Promise<void> {
        await this.failOutdatedGenerations();

        const query = `
            UPDATE generations
            SET status = $1,
                input = $2,
                output = $3
            WHERE id = $4;
        `;

        await this.db.executeQuery(query, [status, input, output, generationId]);
    }
    async retrieveGenerationsByProblemID(taskID: number, level: number, solutionID: number): Promise<Generation[]> {
        await this.failOutdatedGenerations();

        const query = `
        SELECT * FROM generations WHERE problem_id = $1 AND generation_level = $2 AND solution_id = $3 AND status != 'FAILED' ORDER BY id DESC;
    `;

        const { rows } = await this.db.executeQuery(query, [taskID, level, solutionID]);

        return rows.map((row) => {
            return {
                id: row.id,
                problemId: row.problem_id,
                previousGenerationId: row.previous_generation_id,
                generationLevel: row.generation_level,
                input: row.input,
                output: row.output,
                upVotes: row.up_votes,
                downVotes: row.down_votes,
                solutionId: row.solution_id,
                status: row.status,
                templateVariables: row.template_variables,
                templateName: row.template_name,
            }
        });
    }

    //
    // public async retrieveGenerationsByProblemID (problemId: number, minimumGenerationLevel: number, maximumGenerationLevel: number): Promise<Generation[]> {
    //     await this.failOutdatedGenerations();
    //
    //     const query = `
    //     SELECT * FROM generations WHERE problem_id= $1 AND generation_level >= $2 AND generation_level <= $3 AND status != 'FAILED' ORDER BY id DESC;
    // `;
    //
    //     const { rows } = await this.db.executeQuery(query, [problemId, minimumGenerationLevel, maximumGenerationLevel]);
    //
    //     return rows.map((row) => {
    //         return {
    //             id: row.id,
    //             problemId: row.task_id,
    //             previousGenerationId: row.previous_generation_id,
    //             generationLevel: row.generation_level,
    //             input: row.input,
    //             output: row.output,
    //             upVotes: row.up_votes,
    //             downVotes: row.down_votes,
    //             solutionId: row.solution_id,
    //             status: row.status,
    //             templateVariables: row.template_variables,
    //             templateName: row.template_name,
    //         }
    //     });
    // };

    public async addVote(generationId: number, isUpVote: boolean): Promise<void> {
        const query = isUpVote ?
            `UPDATE generations SET up_votes = up_votes + 1 WHERE id = $1;` :
            `UPDATE generations SET down_votes = down_votes + 1 WHERE id = $1;`;

        await this.db.executeQuery(query, [generationId]);

    };

    public async  failOutdatedGenerations(): Promise<void> {
        // Set generations to FAIL if they are outdated (not ready for 1 minute)
        const query = `UPDATE generations SET status = 'FAILED' WHERE status = 'IN PROGRESS' AND (NOW() - created_at) > INTERVAL '5 minute';`;
        await this.db.executeQuery(query, []);
    }

    public async  selectTop5GenerationsForProblem(problemId: number): Promise<Generation[]> {
        await this.failOutdatedGenerations();

        const query = `
        SELECT * FROM generations
        WHERE problem_id = $1 AND solution_id = 0 AND generation_level = 1 AND status != 'FAILED' AND status != 'IN PROGRESS'
        ORDER BY (up_votes - down_votes) DESC, up_votes DESC
    `;

        const { rows } = await this.db.executeQuery(query, [problemId]);

        const uniqueInputs = new Set();
        const uniqueGenerations = [];

        for (const row of rows) {
            if (!uniqueInputs.has(row.input)) {
                uniqueInputs.add(row.input);

            }

            uniqueGenerations.push({
                id: row.id,
                problemId: row.problem_id,
                previousGenerationId: row.previous_generation_id,
                generationLevel: row.generation_level,
                input: row.input,
                output: row.output,
                upVotes: row.up_votes,
                downVotes: row.down_votes,
                solutionId: row.solution_id,
                status: row.status,
                templateVariables: row.template_variables,
                templateName: row.template_name,
            });

            if(uniqueGenerations.length >= 5) {
                break;
            }
        }

        return uniqueGenerations;
    };

    public async getGeneration (generationId: number): Promise<Generation | null>  {
        await this.failOutdatedGenerations();

        const query = `
        SELECT * FROM generations WHERE id = $1 AND status != 'FAILED';
    `;

        const { rows } = await this.db.executeQuery(query, [generationId]);

        if (rows.length === 0) {
            return null;
        }

        return {
            id: rows[0].id,
            problemId: rows[0].problem_id,
            previousGenerationId: rows[0].previous_generation_id,
            generationLevel: rows[0].generation_level,
            input: rows[0].input,
            output: rows[0].output,
            upVotes: rows[0].up_votes,
            downVotes: rows[0].down_votes,
            solutionId: rows[0].solution_id,
            status: rows[0].status,
            templateVariables: rows[0].template_variables,
            templateName: rows[0].template_name,
        }
    }

    async removeGeneration(generationId: number): Promise<void> {
        const query = `DELETE FROM generations WHERE id = $1;`;
        await this.db.executeQuery(query, [generationId]);
    }

    public async  getGenerationBySolution (solutionId: number): Promise<Generation | null> {
        await this.failOutdatedGenerations();

        const query = `
        SELECT * FROM generations WHERE solution_id = $1 AND status != 'FAILED';
    `;

        const { rows } = await this.db.executeQuery(query, [solutionId]);

        if (rows.length === 0) {
            return null;
        }

        return {
            id: rows[0].id,
            problemId: rows[0].problem_id,
            previousGenerationId: rows[0].previous_generation_id,
            generationLevel: rows[0].generation_level,
            input: rows[0].input,
            output: rows[0].output,
            upVotes: rows[0].up_votes,
            downVotes: rows[0].down_votes,
            solutionId: rows[0].solution_id,
            status: rows[0].status,
            templateVariables: rows[0].template_variables,
            templateName: rows[0].template_name,
        }
    }

}



