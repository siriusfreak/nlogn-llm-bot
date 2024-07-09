import Contester from "./contester";
import loadConfig from "../config";

describe('Integration tests for contester service', () => {
    let contester: Contester;

    const config = loadConfig('config/config.yaml');
    const USER_ID = 648;
    const USER_NAME = 'siriusfreak';
    const CONTEST_ID = 2067;
    const PROBLEM_SLUG = 'D';
    const PROBLEM_ID = 3092;
    const SOLUTION_ID = 658599;

    beforeAll(async () => {
        contester = new Contester(config.contesterToken);
    })

    it('should fetch all contests for user', async () => {
        const response = await contester.fetchAllContests(USER_ID);

        expect(response.length).toBeGreaterThan(0);
    });


    it('should fetch problems for contest', async () => {
        const response = await contester.fetchProblemsForContest(CONTEST_ID);

        expect(response.length).toBeGreaterThan(0);
    });

    it('should fetch problem details', async () => {
        const response = await contester.fetchProblemDetails(CONTEST_ID, PROBLEM_SLUG);

        expect(response).toBeDefined()
    });

    it('should fetch problem solution', async () => {
        const response = await contester.fetchProblemSolution(CONTEST_ID, PROBLEM_ID);

        expect(response).toBeDefined();
    });

    it('should fetch user submissions', async () => {
        const response = await contester.fetchUserSolutions(USER_ID, CONTEST_ID, PROBLEM_ID);

        expect(response).toBeDefined();
    });

    it('should fetch submissions details', async () => {
        const response = await contester.fetchSolutionDetails(SOLUTION_ID);

        expect(response).toBeDefined();
    });

    it('should fetch user data', async () => {
        const response = await contester.fetchUserData("user800791");

        expect(response).toBeDefined();
    });
});
