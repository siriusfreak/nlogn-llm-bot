import {Button, Generation, Solution} from "../types";

export interface GenerationRepository {
    selectTop5GenerationsForProblem(problemId: number): Promise<Generation[]>;
}

export interface Contester {
    fetchUserSolutions(userId: number, contestId: number, problemId: number): Promise<Solution[]>;
}

export class ButtonsGenerator {
    constructor(private generations: GenerationRepository, private contester: Contester) {}
    public async voteButtons(generationId: number): Promise<Button[]> {
        return [
            {text: "👍", callback_data: "voteup_" + generationId},
            {text: "👎", callback_data: "votedown_" + generationId},
            {text: "🔁", callback_data: "regenerate_" + generationId}
        ];
    }

    public async hintButton(problemId: number, problemSlug: string): Promise<Button[]> {
        return [
            {text: "Получить подсказку по задаче", callback_data: "hint_" + problemId + "_" + problemSlug}
        ]
    }
    public async variantsButtons(problemId: number): Promise<Button[]> {
        const top5gen = await this.generations.selectTop5GenerationsForProblem(problemId)
        if (top5gen.length == 0) {
            return [];
        }
        return top5gen.filter((gen) => gen.templateVariables.userMessage && gen.templateVariables.userMessage != "").map((gen: any) => {
            return {
                text: gen.templateVariables.userMessage,
                callback_data: "generation_" + gen.id
            }
        })
    }
    public async solutionsButtons(contesterId: number | null, contestId: number | null, problemId: number | null, problemSlug: string | null): Promise<Button[]> {
        if (contesterId === null || contestId === null || problemId === null || problemSlug === null) {
            return []
        }
        let solution = await this.contester.fetchUserSolutions(contesterId, contestId, problemId)
        solution = solution.filter((submission) => submission.verdict !== "OK")
        if (solution.length == 0) {
            return []
        }
        return solution.map((solution) => {
            return {
                text: `Посылка ${solution.id}`,
                callback_data: `solution_${contestId}_${problemId}_${problemSlug}_${solution.id}`,
            }
        });
    }
    public async toProblemsButton(): Promise<Button[]> {
        return [{text: "Вернуться к выбору задачи", callback_data: "problems"}];
    }
    public async toContestsButton(): Promise<Button[]> {
        return [{text: "Вернуться к выбору контеста", callback_data: "contests"}];
    }
}
