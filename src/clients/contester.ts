import axios from 'axios';
import cheerio from 'cheerio';
import { decodeHTML } from 'entities';
import * as repl from "repl";
import {Contest, Problem, ProblemStatement, Solution, SolutionDetails, UserData} from "../types";

function extractTextFromHtml(html: string): string {
    const text = cheerio.load(html).text();

    return decodeHTML(text || "");
}

const CONTESTER_BASE_URL = 'https://contest.nlogn.info/api'; // Replace with the actual base URL of the contest system API

export default class Contester{
    constructor(private token: string) {
    }

    private async call( path: string, params: any = null) {
        const response = await axios({
            method: 'GET',
            url: `${CONTESTER_BASE_URL}${path}`,
            headers: {
                Cookie: `auth.token=${this.token}`
            },
            data: params
        });
        return response;
    }

    async fetchAllContests(userId: number): Promise<Contest[]> {
        const response = await this.call(`/contest/all?userId=${userId}`);
        return response.data.contests.map((contest: any) => {
            return {id: contest.id, name: contest.name}
        });
    }

    async fetchProblemsForContest(contestId: number): Promise<Problem[]> {
        const response = await this.call(`/contest/${contestId}/problems`);
        return response.data.map((problem: any) => {
            return {id: problem.id, title: problem.title, slug: problem.internalSymbolIndex}
        });
    }

    async fetchProblemDetails(contestId: number, problemSlug: string): Promise<ProblemStatement> {
        try {
            const response = await this.call(`/contest/${contestId}/problems/${problemSlug}`)
            return {
                title: response.data.title,
                text: extractTextFromHtml(response.data.htmlStatement)
            };
        } catch (error) {
            console.error('Error while fetching problem details:', error);
            throw new Error('Failed to retrieve problem details from the contest system.');
        }
    }

    async fetchProblemSolution(contestId: number, problemId: number): Promise<string | null> {

        const response = await this.call(
            `/contest/${contestId}/solutions/all?contestId=${contestId}&filterProblemIds=${problemId}&filterVerdictIds=1`);

        if (response.data.solutions && response.data.solutions[0]) {
            const response2 = await this.call(
                `/contest/${contestId}/solutions/${response.data.solutions[0].id}/code`);
            return decodeHTML(response2.data.sourceCode || "");
        } else {
            return null
        }
    }

    async fetchUserSolutions(contesterId: number, contestId: number, problemId: number): Promise<Solution[]> {
        const response = await this.    call(
            `/contest/${contestId}/solutions/all?contestId=${contestId}&filterProblemIds=${problemId}&filterUserIds=${contesterId}&count=5&offset=0&select=all`);
        return response.data.solutions.map((solution: any) => {
            if (solution.verdict !== null) {
                return {id: solution.id, verdictId: solution.verdict.id, verdict: solution.verdict.name}
            } else {
                return {id: solution.id, verdictId: null, verdict: null}
            }
        });
    }

    async fetchSolutionDetails(solutionId: number): Promise<SolutionDetails> {
        try {
            let response = await this.call(`/solution/${solutionId}`);
            const contestId = response.data.contestId;

            // Ensure response.data exists and has required properties
            if (!response.data || !contestId) {
                throw new Error("Invalid solution or contest data received");
            }

            response = await this.call(`/contest/${contestId}/solutions/${solutionId}/code`);

            // Checking if verdict is null before accessing its properties
            const verdictName = response.data.verdict ? response.data.verdict.name : 'Unknown';

            return {
                id: response.data.id,
                verdictId: response.data.verdictId,
                verdict: verdictName,
                sourceCode: decodeHTML(response.data.sourceCode || ""),
                compilationError: response.data.compilationError,
                errorTrace: response.data.errorTrace,
                problemSlug: response.data.internalSymbolIndex,
                problemId: response.data.problem.id,
                contestId: contestId,
                userId: response.data.userId,
            };
        } catch (error) {
            console.error('Failed to fetch solution details:', error);
            throw error;  // Re-throw the error if you need to handle it further up the chain
        }
    }


    async fetchUserData(userName: string): Promise<UserData | null > {
        const response = await this.call(`/admin/users/username?username=${userName}`);
        return {
            id: response.data.id,
            username: response.data.username,
        }
    }

    async fetchTelegramLinkCode(userId: number): Promise<string | null> {
            const response = await this.call(`/admin/telegram/${userId}`);
            return response.data.linkKey;
    }

}
