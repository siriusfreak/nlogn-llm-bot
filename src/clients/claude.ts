import Anthropic from '@anthropic-ai/sdk';
import {ChatMessage} from "../types";

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface Config {
    model: string;
    effort?: Effort;
}

// Dialog history sent with each request, in characters. The OpenAI client kept
// ~12000 GPT tokens; at ~4 characters per token this is the same order of size.
// The newest message is always sent whole.
export const MAX_HISTORY_CHARS = 48000;

const MAX_TOKENS = 16000;

// On a safety-classifier decline the API retries the same request on the model
// Anthropic recommends for that refusal category. Haiku has no server-side fallback.
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

export class RefusalError extends Error {
    constructor(public readonly category: string | null) {
        super(`Claude declined the request (category: ${category ?? 'unknown'})`);
        this.name = 'RefusalError';
    }
}

// Keeps the longest tail of the dialog that fits into maxChars, starting with a
// user message (the Messages API rejects a conversation that starts with the assistant).
export function trimHistory(messages: ChatMessage[], maxChars: number = MAX_HISTORY_CHARS): ChatMessage[] {
    const nonEmpty = messages.filter(message => message.text.trim() !== '');

    const result: ChatMessage[] = [];
    let total = 0;
    for (let i = nonEmpty.length - 1; i >= 0; i--) {
        const length = nonEmpty[i].text.length;
        if (result.length > 0 && total + length > maxChars) {
            break;
        }
        result.unshift(nonEmpty[i]);
        total += length;
    }

    while (result.length > 0 && !result[0].isUser) {
        result.shift();
    }

    return result;
}

export class ClaudeChat {
    private readonly model: string
    private readonly effort?: Effort

    // The key comes from ANTHROPIC_API_KEY.
    constructor(config: Config, private client: Anthropic = new Anthropic()) {
        this.model = config.model
        this.effort = config.effort
    }

    public async Chat(messages: ChatMessage[]): Promise<string> {
        const history = trimHistory(messages);
        if (history.length === 0) {
            throw new Error('No user message to send to Claude.');
        }

        const withFallback = !this.model.startsWith('claude-haiku');

        console.log("start chat", this.model)
        const response = await this.client.beta.messages.create({
            model: this.model,
            max_tokens: MAX_TOKENS,
            thinking: {type: 'adaptive'},
            ...(this.effort ? {output_config: {effort: this.effort}} : {}),
            ...(withFallback ? {betas: [FALLBACK_BETA], fallbacks: 'default' as const} : {}),
            messages: history.map((message): Anthropic.Beta.BetaMessageParam => ({
                role: message.isUser ? 'user' : 'assistant',
                content: message.text,
            })),
        });
        console.log("end chat", response.model, response.stop_reason,
            response.usage.input_tokens, response.usage.output_tokens)

        if (response.stop_reason === 'refusal') {
            throw new RefusalError(response.stop_details?.category ?? null);
        }

        const text = response.content
            .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
            .map(block => block.text)
            .join('');
        if (!text) {
            throw new Error(`Claude returned no text (stop_reason: ${response.stop_reason}).`);
        }

        return text;
    }
}
