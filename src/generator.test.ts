import Generator, {GenerationTask} from './generator';
import { TemplatesRepository, GenerationRepository, OpenAIChat } from './generator';
import {Template} from "./models/templates";
import {ChatMessage, Generation, TemplateVariables} from "./types";
// @ts-ignore
import Mustache from "mustache";


describe('Generator', () => {
    let generator: Generator;
    let mockTemplatesRepository: jest.Mocked<TemplatesRepository>;
    let mockGenerationsRepository: jest.Mocked<GenerationRepository>;
    let mockOpenAIChat: jest.Mocked<OpenAIChat>;

    beforeEach(() => {

        mockTemplatesRepository = {
            getTemplate: jest.fn(),
        };

        mockGenerationsRepository = {
            addGeneration: jest.fn(),
            retrieveGenerationsByProblemID: jest.fn(),
            setGenerationStatusAndResult: jest.fn(),
            getGeneration: jest.fn(),
            getPreviousDialog: jest.fn(),
            removeGeneration: jest.fn(),
        };

        mockOpenAIChat = {
            Chat: jest.fn(),
        };

        generator = new Generator(mockTemplatesRepository, mockGenerationsRepository, mockOpenAIChat);
    });

    it('should successfully generate using the provided task', async () => {
        // Given
        const mockTask: GenerationTask = {
            previousGenerationId: 1,
            problemId: 1,
            solutionId: 1,
            generationLevel: 1,
            templateName: "someTemplate",
            templateVariables: { userMessage: "value1" }
        };

        const mockTemplate: Template = { name: 'someTemplate', template: "mock-template" };
        const mockGenerationId = 123;
        const mockChatOutput = "mocked output";

        const expectedGeneration: Generation = {
            id: mockGenerationId,
            problemId: mockTask.problemId,
            previousGenerationId: mockTask.previousGenerationId,
            generationLevel: mockTask.generationLevel,
            input: mockChatOutput,
            output: "",
            upVotes: 0,
            downVotes: 0,
            solutionId: mockTask.solutionId,
            templateName: mockTask.templateName,
            templateVariables: mockTask.templateVariables,
            status: 'IN PROGRESS',
        }

        mockTemplatesRepository.getTemplate.mockResolvedValueOnce(mockTemplate);
        mockGenerationsRepository.getPreviousDialog.mockResolvedValueOnce([]);
        mockGenerationsRepository.retrieveGenerationsByProblemID.mockResolvedValueOnce([]);
        mockGenerationsRepository.addGeneration.mockResolvedValueOnce(expectedGeneration);
        mockOpenAIChat.Chat.mockResolvedValueOnce(mockChatOutput);

        // When
        const result = await generator.addTask(mockTask);

        // Then
        expect(result).toBe(mockGenerationId);
        expect(mockTemplatesRepository.getTemplate).toBeCalledWith(mockTask.templateName);
        expect(mockOpenAIChat.Chat).toBeCalled();
        expect(mockGenerationsRepository.addGeneration).toBeCalledWith(
            mockTask.problemId, mockTask.previousGenerationId, mockTask.generationLevel,
            "", "", mockTask.templateName, mockTask.templateVariables, mockTask.solutionId
        );
    });

    it('should retrieve the previous dialog when generating using a task with a previous generation ID', async () => {
        // Given
        const mockTask: GenerationTask = {
            previousGenerationId: 1,  // Previous generation ID set
            problemId: 1,
            solutionId: 1,
            generationLevel: 1,
            templateName: "someTemplate",
            templateVariables: { userMessage: "value1" }
        };

        const mockTemplate: Template = { name: 'someTemplate', template: "mock-template" };
        const mockGenerationId = 123;
        const mockChatOutput = "mocked output";
        const expectedChatInput = Mustache.render(mockTemplate.template, mockTask.templateVariables);

        const expectedGeneration: Generation = {
            id: mockGenerationId,
            problemId: mockTask.problemId,
            previousGenerationId: mockTask.previousGenerationId,
            generationLevel: mockTask.generationLevel,
            input: expectedChatInput,
            output: "",
            upVotes: 0,
            downVotes: 0,
            solutionId: mockTask.solutionId,
            templateName: mockTask.templateName,
            templateVariables: mockTask.templateVariables,
            status: 'IN PROGRESS',
        };

        const previousDialog: ChatMessage[] = [{
            text: "previous message",
            isUser: true
        }];

        mockTemplatesRepository.getTemplate.mockResolvedValueOnce(mockTemplate);
        mockGenerationsRepository.getPreviousDialog.mockResolvedValueOnce(previousDialog);
        mockGenerationsRepository.retrieveGenerationsByProblemID.mockResolvedValueOnce([]);
        mockGenerationsRepository.addGeneration.mockResolvedValueOnce(expectedGeneration);
        mockOpenAIChat.Chat.mockResolvedValueOnce(mockChatOutput);

        // When
        const result = await generator.addTask(mockTask);

        // Then
        expect(result).toBe(mockGenerationId);
        expect(mockTemplatesRepository.getTemplate).toBeCalledWith(mockTask.templateName);
        expect(mockGenerationsRepository.getPreviousDialog).toBeCalledWith(mockTask.previousGenerationId);
        expect(mockOpenAIChat.Chat).toBeCalledWith([...previousDialog, { text: expectedChatInput, isUser: true }]);
        expect(mockGenerationsRepository.addGeneration).toBeCalledWith(
            mockTask.problemId, mockTask.previousGenerationId, mockTask.generationLevel,
            "", "", mockTask.templateName, mockTask.templateVariables, mockTask.solutionId
        );
    });

    it('should throw an error when the template is not found', async () => {
        // Given
        const mockGenerationId = 123;
        const mockTask: GenerationTask = {
            previousGenerationId: 0,  // No previous generation
            problemId: 1,
            solutionId: 1,
            generationLevel: 1,
            templateName: "nonExistentTemplate",
            templateVariables: { userMessage: "value1" }
        };

        const expectedGeneration: Generation = {
            id: mockGenerationId,
            problemId: mockTask.problemId,
            previousGenerationId: mockTask.previousGenerationId,
            generationLevel: mockTask.generationLevel,
            input: "",
            output: "",
            upVotes: 0,
            downVotes: 0,
            solutionId: mockTask.solutionId,
            templateName: mockTask.templateName,
            templateVariables: mockTask.templateVariables,
            status: 'IN PROGRESS',
        };

        // Create a promise that resolves when `setGenerationStatusAndResult` is called
        const setStatusPromise = new Promise<void>((resolve) => {
            mockGenerationsRepository.setGenerationStatusAndResult.mockImplementationOnce(() => {
                resolve();
                return Promise.resolve();
            });
        });

        mockTemplatesRepository.getTemplate.mockResolvedValueOnce(null);  // Simulate template not found
        mockGenerationsRepository.retrieveGenerationsByProblemID.mockResolvedValueOnce([]);
        mockGenerationsRepository.addGeneration.mockResolvedValueOnce(expectedGeneration);

        // When & Then
        await generator.addTask(mockTask);
        await setStatusPromise;

        expect(mockGenerationsRepository.retrieveGenerationsByProblemID).toBeCalled();
        expect(mockTemplatesRepository.getTemplate).toBeCalledWith(mockTask.templateName);
        // Ensure other mocks are not called due to the error
        expect(mockOpenAIChat.Chat).not.toBeCalled();
        expect(mockGenerationsRepository.getPreviousDialog).not.toBeCalled();
    });

    it('should throw an error when trying to regenerate a non-existent generation', async () => {
        // Given
        const mockGenerationId = 123;  // Some mock generation ID

        mockGenerationsRepository.getGeneration.mockResolvedValueOnce(null);  // Simulate generation not found

        // When & Then
        await expect(generator.regenerate(mockGenerationId)).rejects.toThrow("Generation not found");

        expect(mockGenerationsRepository.getGeneration).toBeCalledWith(mockGenerationId);
        // Ensure other mocks are not called due to the error
        expect(mockOpenAIChat.Chat).not.toBeCalled();
        expect(mockGenerationsRepository.addGeneration).not.toBeCalled();
        expect(mockGenerationsRepository.getPreviousDialog).not.toBeCalled();
        expect(mockGenerationsRepository.removeGeneration).not.toBeCalled();
    });

    it('should throw an error if generation is not found while waiting', async () => {
        // Given
        const mockGenerationId = 123;

        // Initially, return a generation with status 'IN PROGRESS'
        mockGenerationsRepository.getGeneration.mockResolvedValueOnce({
            id: mockGenerationId,
            problemId: 1,
            previousGenerationId: 1,
            generationLevel: 1,
            input: "",
            output: "",
            upVotes: 0,
            downVotes: 0,
            solutionId: 1,
            templateName: "someTemplate",
            templateVariables: { userMessage: "value1" },
            status: 'IN PROGRESS',
        });

        // Subsequent calls to getGeneration will return null, simulating the scenario where the generation is not found.
        mockGenerationsRepository.getGeneration.mockResolvedValueOnce(null);

        // When & Then
        await expect(generator.waitForGeneration(mockGenerationId)).rejects.toThrow("Generation not found");

        expect(mockGenerationsRepository.getGeneration).toBeCalledTimes(2);
    });

    it('should throw an error when generation fails during waiting', async () => {
        // Given
        const mockGenerationId = 456;

        const mockInitialGeneration: Generation = {
            id: mockGenerationId,
            problemId: 2,
            previousGenerationId: 2,
            generationLevel: 2,
            input: "initial input",
            output: "initial output",
            upVotes: 0,
            downVotes: 0,
            solutionId: 2,
            templateName: "someOtherTemplate",
            templateVariables: { userMessage: "initial value" },
            status: 'IN PROGRESS'
        };

        const mockFailedGeneration: Generation = {
            ...mockInitialGeneration,
            status: 'FAILED'
        };

        mockGenerationsRepository.getGeneration
            .mockResolvedValueOnce(mockInitialGeneration) // First call returns the 'IN PROGRESS' status
            .mockResolvedValueOnce(mockFailedGeneration); // Second call returns the 'FAILED' status

        // When & Then
        await expect(generator.waitForGeneration(mockGenerationId)).rejects.toThrow("Generation failed");
    });

    it('should not create a new generation if one already exists for the same problem ID', async () => {
        // Given
        const mockTask: GenerationTask = {
            previousGenerationId: 1,
            problemId: 1,
            solutionId: 1,
            generationLevel: 1,
            templateName: "someTemplate",
            templateVariables: { userMessage: "existingValue" }
        };

        const existingGenerationId = 456;
        const existingGeneration: Generation = {
            id: existingGenerationId,
            problemId: mockTask.problemId,
            previousGenerationId: mockTask.previousGenerationId,
            generationLevel: mockTask.generationLevel,
            input: "existing input",
            output: "existing output",
            upVotes: 0,
            downVotes: 0,
            solutionId: mockTask.solutionId,
            templateName: mockTask.templateName,
            templateVariables: mockTask.templateVariables,
            status: 'IN PROGRESS'
        };

        // Mocking the retrieval of existing generations by problem ID to return our existing generation.
        mockGenerationsRepository.retrieveGenerationsByProblemID.mockResolvedValueOnce([existingGeneration]);

        // When
        const result = await generator.addTask(mockTask);

        // Then
        expect(result).toBe(existingGenerationId);
        expect(mockTemplatesRepository.getTemplate).not.toBeCalled();
        expect(mockOpenAIChat.Chat).not.toBeCalled();
        expect(mockGenerationsRepository.addGeneration).not.toBeCalled();
    });

    it('should handle chat failure during generation', async () => {
        // Given
        const mockTask: GenerationTask = {
            previousGenerationId: 1,
            problemId: 1,
            solutionId: 1,
            generationLevel: 1,
            templateName: "someTemplate",
            templateVariables: { userMessage: "value1" }
        };

        const mockTemplate: Template = { name: 'someTemplate', template: "mock-template" };
        const mockGenerationId = 123;

        const expectedGeneration: Generation = {
            id: mockGenerationId,
            problemId: mockTask.problemId,
            previousGenerationId: mockTask.previousGenerationId,
            generationLevel: mockTask.generationLevel,
            input: "",
            output: "",
            upVotes: 0,
            downVotes: 0,
            solutionId: mockTask.solutionId,
            templateName: mockTask.templateName,
            templateVariables: mockTask.templateVariables,
            status: 'IN PROGRESS',
        }

        mockTemplatesRepository.getTemplate.mockResolvedValueOnce(mockTemplate);
        mockGenerationsRepository.getPreviousDialog.mockResolvedValueOnce([]);
        mockGenerationsRepository.retrieveGenerationsByProblemID.mockResolvedValueOnce([]);
        mockGenerationsRepository.addGeneration.mockResolvedValueOnce(expectedGeneration);
        mockOpenAIChat.Chat.mockRejectedValueOnce(new Error("Chat failed"));

        // Create a promise that resolves when `setGenerationStatusAndResult` is called
        const setStatusPromise = new Promise<void>((resolve) => {
            mockGenerationsRepository.setGenerationStatusAndResult.mockImplementationOnce(() => {
                resolve();
                return Promise.resolve();
            });
        });

        // When
        const result = await generator.addTask(mockTask);

        await setStatusPromise;
        // Then
        expect(result).toBe(mockGenerationId);
        expect(mockTemplatesRepository.getTemplate).toBeCalledWith(mockTask.templateName);
        expect(mockOpenAIChat.Chat).toBeCalled();
        expect(mockGenerationsRepository.addGeneration).toBeCalledWith(
            mockTask.problemId, mockTask.previousGenerationId, mockTask.generationLevel,
            "", "", mockTask.templateName, mockTask.templateVariables, mockTask.solutionId
        );

        // Assert that `setGenerationStatusAndResult` is called with the 'FAILED' status
        expect(mockGenerationsRepository.setGenerationStatusAndResult).toBeCalledWith(
            mockGenerationId, 'FAILED', "", ""
        );
    });

    it('should handle Mustache template rendering errors', async () => {
        // Given
        const mockTask: GenerationTask = {
            previousGenerationId: 1,
            problemId: 1,
            solutionId: 1,
            generationLevel: 1,
            templateName: "malformedTemplate",
            templateVariables: { userMessage: "value1" }
        };
        const mockGenerationId = 123;
        const expectedGeneration: Generation = {
            id: mockGenerationId,
            problemId: mockTask.problemId,
            previousGenerationId: mockTask.previousGenerationId,
            generationLevel: mockTask.generationLevel,
            input: "",
            output: "",
            upVotes: 0,
            downVotes: 0,
            solutionId: mockTask.solutionId,
            templateName: mockTask.templateName,
            templateVariables: mockTask.templateVariables,
            status: 'IN PROGRESS',
        }

        const malformedTemplate: Template = { name: 'malformedTemplate', template: "This is a malformed {{ " }; // Intentionally malformed Mustache template

        mockTemplatesRepository.getTemplate.mockResolvedValueOnce(malformedTemplate);
        mockGenerationsRepository.retrieveGenerationsByProblemID.mockResolvedValueOnce([]);
        mockGenerationsRepository.addGeneration.mockResolvedValueOnce(expectedGeneration);

        // We don't expect the chat or generations repository methods to be called in this scenario, so no other mocks are set.

        // When & Then
        await expect(generator.addTask(mockTask)).resolves.toBe(mockGenerationId)

        expect(mockTemplatesRepository.getTemplate).toBeCalledWith(mockTask.templateName);
        expect(mockGenerationsRepository.addGeneration).toBeCalledWith(
            mockTask.problemId, mockTask.previousGenerationId, mockTask.generationLevel,
            "", "", mockTask.templateName, mockTask.templateVariables, mockTask.solutionId
        );
        // These methods should not be called due to the template error
        expect(mockOpenAIChat.Chat).not.toBeCalled();

        // Assert that `setGenerationStatusAndResult` is called with the 'FAILED' status
        expect(mockGenerationsRepository.setGenerationStatusAndResult).toBeCalledWith(
            mockGenerationId, 'FAILED', "", ""
        );
    });

    it('should handle simultaneous generation tasks correctly', async () => {
        // Given
        const mockTask1: GenerationTask = {
            previousGenerationId: 1,
            problemId: 1,
            solutionId: 1,
            generationLevel: 1,
            templateName: "someTemplate",
            templateVariables: { userMessage: "value1" }
        };

        const mockTask2: GenerationTask = {
            previousGenerationId: 2,
            problemId: 2,
            solutionId: 2,
            generationLevel: 2,
            templateName: "someTemplate2",
            templateVariables: { userMessage: "value2" }
        };

        const mockTemplate: Template = { name: 'someTemplate', template: "mock-template" };
        const mockGenerationId1 = 123;
        const mockGenerationId2 = 456;
        const mockChatOutput1 = "mocked output 1";
        const mockChatOutput2 = "mocked output 2";

        const expectedGeneration1: Generation = {
            id: mockGenerationId1,
            problemId: mockTask1.problemId,
            previousGenerationId: mockTask1.previousGenerationId,
            generationLevel: mockTask1.generationLevel,
            input: mockChatOutput1,
            output: "",
            upVotes: 0,
            downVotes: 0,
            solutionId: mockTask1.solutionId,
            templateName: mockTask1.templateName,
            templateVariables: mockTask1.templateVariables,
            status: 'IN PROGRESS',
        };

        const expectedGeneration2: Generation = {
            id: mockGenerationId2,
            problemId: mockTask2.problemId,
            previousGenerationId: mockTask2.previousGenerationId,
            generationLevel: mockTask2.generationLevel,
            input: mockChatOutput2,
            output: "",
            upVotes: 0,
            downVotes: 0,
            solutionId: mockTask2.solutionId,
            templateName: mockTask2.templateName,
            templateVariables: mockTask2.templateVariables,
            status: 'IN PROGRESS',
        };

        mockTemplatesRepository.getTemplate.mockResolvedValue(mockTemplate);
        mockGenerationsRepository.getPreviousDialog.mockResolvedValue([]);
        mockGenerationsRepository.retrieveGenerationsByProblemID.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
        mockGenerationsRepository.addGeneration.mockResolvedValueOnce(expectedGeneration1).mockResolvedValueOnce(expectedGeneration2);
        mockOpenAIChat.Chat.mockResolvedValueOnce(mockChatOutput1).mockResolvedValueOnce(mockChatOutput2);

        // When
        const [result1, result2] = await Promise.all([
            generator.addTask(mockTask1),
            generator.addTask(mockTask2)
        ]);

        // Then
        expect(result1).not.toEqual(result2);
        expect(mockTemplatesRepository.getTemplate).toHaveBeenCalledTimes(2);
        expect(mockOpenAIChat.Chat).toHaveBeenCalledTimes(2);
        expect(mockGenerationsRepository.addGeneration).toHaveBeenCalledTimes(2);
        expect(mockGenerationsRepository.addGeneration).toHaveBeenCalledWith(
            mockTask1.problemId, mockTask1.previousGenerationId, mockTask1.generationLevel,
            "", "", mockTask1.templateName, mockTask1.templateVariables, mockTask1.solutionId
        );
        expect(mockGenerationsRepository.addGeneration).toHaveBeenCalledWith(
            mockTask2.problemId, mockTask2.previousGenerationId, mockTask2.generationLevel,
            "", "", mockTask2.templateName, mockTask2.templateVariables, mockTask2.solutionId
        );
    });

    it('should handle simultaneous addition of identical tasks', async () => {
        // Given
        const mockTask: GenerationTask = {
            previousGenerationId: 1,
            problemId: 1,
            solutionId: 1,
            generationLevel: 1,
            templateName: "someTemplate",
            templateVariables: { userMessage: "value1" }
        };

        const mockTemplate: Template = { name: 'someTemplate', template: "mock-template" };
        const mockGenerationId = 123;
        const mockChatOutput = "mocked output";

        const expectedGeneration: Generation = {
            id: mockGenerationId,
            problemId: mockTask.problemId,
            previousGenerationId: mockTask.previousGenerationId,
            generationLevel: mockTask.generationLevel,
            input: mockChatOutput,
            output: "",
            upVotes: 0,
            downVotes: 0,
            solutionId: mockTask.solutionId,
            templateName: mockTask.templateName,
            templateVariables: mockTask.templateVariables,
            status: 'IN PROGRESS',
        }

        mockTemplatesRepository.getTemplate.mockResolvedValueOnce(mockTemplate).mockResolvedValueOnce(mockTemplate);
        mockGenerationsRepository.getPreviousDialog.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
        mockGenerationsRepository.retrieveGenerationsByProblemID.mockResolvedValueOnce([]).mockResolvedValueOnce([expectedGeneration]);
        mockGenerationsRepository.addGeneration.mockResolvedValueOnce(expectedGeneration);
        mockOpenAIChat.Chat.mockResolvedValueOnce(mockChatOutput).mockResolvedValueOnce(mockChatOutput);

        // When
        const [result1, result2] = await Promise.all([
            generator.addTask(mockTask),
            generator.addTask(mockTask)
        ]);

        // Then
        expect(result1).toBe(mockGenerationId);
        expect(result2).toBe(mockGenerationId);
        expect(mockTemplatesRepository.getTemplate).toBeCalledTimes(1);
        expect(mockOpenAIChat.Chat).toBeCalledTimes(1);
        // `addGeneration` should only be called once due to mutex, even though `addTask` was called twice.
        expect(mockGenerationsRepository.addGeneration).toBeCalledTimes(1);
    });

    it('should handle simultaneous regeneration of the same generation', async () => {
        // Given
        const mockGenerationId = 123;
        const mockGeneration: Generation = {
            id: mockGenerationId,
            problemId: 1,
            previousGenerationId: 1,
            generationLevel: 1,
            input: "previous input",
            output: "previous output",
            upVotes: 0,
            downVotes: 0,
            solutionId: 1,
            templateName: "someTemplate",
            templateVariables: { userMessage: "value1" },
            status: 'IN PROGRESS'
        };

        mockGenerationsRepository.getGeneration
            .mockResolvedValueOnce(mockGeneration) // for first call
            .mockResolvedValueOnce(null) // for second call, simulating that the first regeneration already removed it

        // Simultaneously initiate regeneration for the same generation
        const regeneratePromise1 = generator.regenerate(mockGenerationId);
        const regeneratePromise2 = generator.regenerate(mockGenerationId);

        let error: Error | null = null;
        try {
            await Promise.all([regeneratePromise1, regeneratePromise2]);
        } catch (e) {
            error = e;
        }

        // Then
        expect(error).not.toBeNull();
        expect(error?.message).toBe("Generation not found");
    });

    it('should wait for generation concurrently', async () => {
        // Given
        const mockGenerationId = 123;

        const generationInProgress: Generation = {
            id: mockGenerationId,
            problemId: 1,
            previousGenerationId: 1,
            generationLevel: 1,
            input: "someInput",
            output: "",
            upVotes: 0,
            downVotes: 0,
            solutionId: 1,
            templateName: "someTemplate",
            templateVariables: { userMessage: "value1" },
            status: 'IN PROGRESS',
        };

        const generationReady: Generation = {
            ...generationInProgress,
            status: 'READY'
        };

        mockGenerationsRepository.getGeneration
            .mockResolvedValueOnce(generationInProgress)   // First call returns 'IN PROGRESS'
            .mockResolvedValueOnce(generationInProgress)   // Second call (concurrent) returns 'IN PROGRESS'
            .mockResolvedValueOnce(generationReady)        // Subsequent call returns 'READY'
            .mockResolvedValueOnce(generationReady);       // Subsequent call for the concurrent invocation

        // When
        const [result1, result2] = await Promise.all([
            generator.waitForGeneration(mockGenerationId),
            generator.waitForGeneration(mockGenerationId)
        ]);

        // Then
        expect(result1.status).toBe('READY');
        expect(result2.status).toBe('READY');
        expect(mockGenerationsRepository.getGeneration).toHaveBeenCalledTimes(4);
    });
});
