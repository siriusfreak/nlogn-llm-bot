// @ts-ignore
import Mustache from 'mustache';
import {Mutex} from 'async-mutex';
import {ChatMessage, Generation, TemplateVariables} from "./types";
import {Template} from "./models/templates";

export interface GenerationTask {
    previousGenerationId: number,
    problemId: number,
    solutionId: number,
    generationLevel: number,
    templateName: string,
    templateVariables: TemplateVariables,
};

export interface TemplatesRepository {
    getTemplate(templateName: string): Promise<Template>
}

export interface GenerationRepository {
    addGeneration(taskId: number,
                  previousGenerationId: number,
                  generationLevel: number, input: string, output: string,
                  templateName: string,
                  templateVariables: TemplateVariables,
                  solutionId: number): Promise<Generation>;
    retrieveGenerationsByProblemID(taskID: number, level: number, solutionID: number): Promise<Generation[]>;
    setGenerationStatusAndResult(generationID: number, status: string, input: string, output: string): Promise<void>;
    getGeneration (generationId: number): Promise<Generation | null>;
    getPreviousDialog(generationId: number): Promise<ChatMessage[]>;
    removeGeneration(generationId: number): Promise<void>;
}

export interface OpenAIChat {
    Chat(messages: ChatMessage[]): Promise<string>
}


export default class Generator {
    private mutex: Mutex = new Mutex();
    constructor(private templates: TemplatesRepository, private generations: GenerationRepository, private chat: OpenAIChat) {}

    private generate = async (task: GenerationTask): Promise<{ input: string, output: string }> => {
        const template = (await this.templates.getTemplate(task.templateName)).template

        let previousDialog: ChatMessage[] = []
        if (task.previousGenerationId !== 0) {
            previousDialog = (await this.generations.getPreviousDialog(task.previousGenerationId))
        }

        const chatGPTInput: string = Mustache.render(template, task.templateVariables)

        const chatGPTOutput = await this.chat.Chat([
            ...previousDialog, {
                text: chatGPTInput,
                isUser: true,
            }]
        )

        return {input: chatGPTInput, output: chatGPTOutput}
    }
    async regenerate(generationId: number, dontCreateNew: boolean): Promise<{ generationId: number, isNew: boolean}> {
        let generation = await this.generations.getGeneration(generationId)
        if (generation === null) {
            return {
                generationId: -1,
                isNew: false
            }
        }

        const task: GenerationTask = {
            previousGenerationId: generation.previousGenerationId,
            problemId: generation.problemId,
            solutionId: generation.solutionId,
            generationLevel: generation.generationLevel,
            templateName: generation.templateName,
            templateVariables: generation.templateVariables
        }

        //await this.generations.removeGeneration(generationId)
        return await this.createTask(task, dontCreateNew, true)
    }

    private async createTask(task: GenerationTask, dontCreateNew: boolean, force: boolean): Promise<{ generationId: number, isNew: boolean}> {
        return await this.mutex.runExclusive<{ generationId: number, isNew: boolean}>( async (): Promise<{ generationId: number, isNew: boolean}> => {
            if (!force) {
                let generations = await this.generations.retrieveGenerationsByProblemID(task.problemId, task.generationLevel, task.solutionId)
                if (generations.length > 0) {
                    return {generationId: generations[0].id, isNew: false}
                }

                if (dontCreateNew) {
                    throw new Error("Generation not found")
                }
            }

            const selectedGenerationId = (
                await this.generations.addGeneration(
                    task.problemId, task.previousGenerationId, task.generationLevel,
                    "", "", task.templateName, task.templateVariables, task.solutionId
                )
            ).id;

            this.generate(task).then( async (res: { input: string, output: string }) => {
                await this.generations.setGenerationStatusAndResult(selectedGenerationId, 'READY', res.input, res.output)
            }).catch( async (err) => {
                console.log(err)
                await this.generations.setGenerationStatusAndResult(selectedGenerationId, 'FAILED', "", "")
            })

            return { generationId: selectedGenerationId, isNew: true }
        })
    }

    async addTask(task: GenerationTask, dontCreateNew: boolean): Promise<{ generationId: number, isNew: boolean}> {
        return this.createTask(task, dontCreateNew, false)
    }

    async waitForGeneration(generationId: number): Promise<Generation> {
        let generation = await this.generations.getGeneration(generationId)
        if (generation === null) {
            throw new Error("Generation not found")
        }

        while (generation != null && generation.status !== 'READY') {
            // sleep for 3 second
            await new Promise(resolve => setTimeout(resolve, 3000));
            generation = await this.generations.getGeneration(generationId)
            if (generation === null) {
                throw new Error("Generation not found")
            }

            if (generation.status === 'FAILED') {
                throw new Error("Generation failed")
            }
        }

        return generation
    }
}
