import OpenAI from 'openai';
import { encode } from 'gpt-3-encoder';
import {ChatMessage} from "../types";


type Model = 'gpt-4' | 'gpt-4-32k' | 'gpt-3.5-turbo' | 'gpt-3.5-turbo-16k'

export interface Config {
    apiKey: string;
    model: string;
}

export class OpenAIChat {
    private openai: OpenAI
    private readonly model: string

    constructor(config: Config) {
        this.openai = new OpenAI({
            apiKey: config.apiKey,
        });
        this.model = config.model
    }

    private tokenCount = (text: string): number => {
        return encode(text).length;
    }

    public async Chat(messages: ChatMessage[]): Promise<string> {
        const msgs = messages.map(message => {
            let role: "user" | "assistant" | "system" | "function" = "user"; // Default role
            if (message.isUser) {
                role = "user";
            } else if (message) {
                role = "assistant";
            }

            return {
                content: message.text,
                role: role,
            };
        });

        let resultMessages = [];
        let curTokenCount = 0;
        for (let i = 0; i < msgs.length; i++) {
            resultMessages.push(msgs[i])
            curTokenCount = curTokenCount + this.tokenCount(msgs[i].content);
            while (curTokenCount > 12000) {
                const firstMessage = resultMessages[0].content;
                curTokenCount = curTokenCount - this.tokenCount(firstMessage);
                resultMessages.shift();
            }
        }

        let cuttedMsg: any[] = [];
        if (resultMessages.length == 0) {
            if (messages.length > 1) {
                let firstRole: 'user' | 'assistant' = messages[0].isUser ? "user" : "assistant";
                let lastRole: 'user' | 'assistant' = messages[-1].isUser ? "user" : "assistant";

                resultMessages = [{
                    content: messages[0].text.slice(0, 20000),
                    role: firstRole,
                }, {
                    content: messages[-1].text.slice(0, 20000),
                    role: lastRole,
                }];
            } else {
                let role: 'user' | 'assistant' = messages[0].isUser ? "user" : "assistant"
                resultMessages = [{
                    content: messages[0].text.slice(0, 20000),
                    role: role,
                }];
            }
        }

        console.log("start chat", this.model)
        const completion = await this.openai.chat.completions.create({
            messages: resultMessages,
            model: this.model,
        });
        console.log("end chat")

        if (completion.choices.length === 0) {
            throw new Error('Failed to generate an explanation from OpenAI.');
        }

        if (!completion.choices[0].message.content) {
            throw new Error('Failed to generate an explanation from OpenAI.');
        }

        return completion.choices[0].message.content;
    }
}





