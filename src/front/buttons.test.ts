import { ButtonsGenerator } from './buttons';
import { GenerationRepository, Contester } from './buttons';

describe('ButtonsGenerator', () => {
    let buttonsGenerator: ButtonsGenerator;
    let mockGenerationRepo: jest.Mocked<GenerationRepository>;
    let mockContester: jest.Mocked<Contester>;

    beforeEach(() => {
        mockGenerationRepo = {
            selectTop5GenerationsForProblem: jest.fn(),
        } as unknown as jest.Mocked<GenerationRepository>;
        mockContester = {} as jest.Mocked<Contester>;
        buttonsGenerator = new ButtonsGenerator(mockGenerationRepo, mockContester);
    });

    test('test_voteButtons_ShouldReturnThreeButtonsWithCorrectCallbackData', async () => {
        // Arrange
        const generationId = 123; // Example generationId
        const expectedButtons = [
            { text: '👍', callback_data: 'voteup_' + generationId },
            { text: '👎', callback_data: 'votedown_' + generationId },
            { text: '🔁', callback_data: 'regenerate_' + generationId }
        ];

        // Act
        const buttons = await buttonsGenerator.voteButtons(generationId);

        // Assert
        expect(buttons).toEqual(expectedButtons);
        expect(buttons).toHaveLength(3);
        expect(buttons[0].callback_data).toBe(`voteup_${generationId}`);
        expect(buttons[1].callback_data).toBe(`votedown_${generationId}`);
        expect(buttons[2].callback_data).toBe(`regenerate_${generationId}`);
    });

    test('test_variantsButtons_WhenNoGenerations_ShouldReturnEmptyArray', async () => {
        // Arrange
        const problemId = 1;
        mockGenerationRepo.selectTop5GenerationsForProblem.mockResolvedValue([]);

        // Act
        const buttons = await buttonsGenerator.variantsButtons(problemId);

        // Assert
        expect(buttons).toEqual([]);
        expect(mockGenerationRepo.selectTop5GenerationsForProblem).toHaveBeenCalledWith(problemId);
        expect(mockGenerationRepo.selectTop5GenerationsForProblem).toHaveBeenCalledTimes(1);
    });
});

// test_variantsButtons_WithValidGenerations_ShouldMapToButtonsWithUserMessages
// test_solutionsButtons_WhenAnyParameterIsNull_ShouldReturnEmptyArray
// test_solutionsButtons_WithValidSolutions_ShouldFilterNonOKVerdictsAndReturnButtons
// test_solutionsButtons_WhenNoSolutions_ShouldReturnEmptyArray
// test_toProblemsButton_ShouldReturnSingleButtonWithProblemsCallback
// test_toContestsButton_ShouldReturnSingleButtonWithContestsCallback
// test_variantsButtons_WithGenerations_ShouldIgnoreGenerationsWithoutUserMessage
// test_variantsButtons_ShouldCallSelectTop5GenerationsForProblemOnce
// test_solutionsButtons_ShouldCallFetchUserSolutionsOnceWithCorrectParameters
// test_voteButtons_ShouldCreateButtonsWithCorrectTextIcons
