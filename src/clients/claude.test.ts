import Anthropic from '@anthropic-ai/sdk';
import {ClaudeChat, RefusalError, trimHistory} from "./claude";

const message = (overrides: Partial<Anthropic.Beta.BetaMessage>): Anthropic.Beta.BetaMessage => ({
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-5-5',
    content: [],
    stop_reason: 'end_turn',
    stop_sequence: null,
    stop_details: null,
    usage: {input_tokens: 10, output_tokens: 5},
    ...overrides,
} as Anthropic.Beta.BetaMessage);

const fakeClient = (response: Anthropic.Beta.BetaMessage) => {
    const create = jest.fn().mockResolvedValue(response);
    const client = {beta: {messages: {create}}} as unknown as Anthropic;
    return {client, create};
};

describe('trimHistory', () => {
    it('keeps the whole dialog when it fits', () => {
        const dialog = [
            {text: 'a', isUser: true},
            {text: 'b', isUser: false},
            {text: 'c', isUser: true},
        ];
        expect(trimHistory(dialog, 100)).toEqual(dialog);
    });

    it('drops the oldest messages over the budget and starts with the user', () => {
        const dialog = [
            {text: 'x'.repeat(50), isUser: true},
            {text: 'y'.repeat(50), isUser: false},
            {text: 'z'.repeat(30), isUser: true},
            {text: 'w'.repeat(30), isUser: false},
            {text: 'v'.repeat(30), isUser: true},
        ];
        // 'z', 'w', 'v' are 90 characters; adding 'y' would make 140
        expect(trimHistory(dialog, 100).map(m => m.text[0])).toEqual(['z', 'w', 'v']);
    });

    it('drops a leading assistant message left after trimming', () => {
        const dialog = [
            {text: 'x'.repeat(50), isUser: true},
            {text: 'y'.repeat(40), isUser: false},
            {text: 'z'.repeat(40), isUser: true},
        ];
        expect(trimHistory(dialog, 85).map(m => m.text[0])).toEqual(['z']);
    });

    it('always keeps the newest message, even over the budget', () => {
        const dialog = [
            {text: 'old', isUser: true},
            {text: 'answer', isUser: false},
            {text: 'n'.repeat(500), isUser: true},
        ];
        expect(trimHistory(dialog, 100)).toEqual([dialog[2]]);
    });

    it('skips empty messages', () => {
        const dialog = [
            {text: 'question', isUser: true},
            {text: '', isUser: false},
            {text: 'again', isUser: true},
        ];
        expect(trimHistory(dialog, 100)).toEqual([dialog[0], dialog[2]]);
    });
});

describe('ClaudeChat', () => {
    it('sends the dialog with roles, adaptive thinking, effort and default fallbacks', async () => {
        const {client, create} = fakeClient(message({
            content: [
                {type: 'thinking', thinking: '', signature: 'sig'} as Anthropic.Beta.BetaThinkingBlock,
                {type: 'text', text: 'Hello', citations: null} as Anthropic.Beta.BetaTextBlock,
                {type: 'text', text: ' world', citations: null} as Anthropic.Beta.BetaTextBlock,
            ],
        }));
        const chat = new ClaudeChat({model: 'claude-opus-5-5', effort: 'medium'}, client);

        const answer = await chat.Chat([
            {text: 'write me a text about something!', isUser: true},
            {text: 'do you want text about freedom?', isUser: false},
            {text: 'yes', isUser: true},
        ]);

        expect(answer).toBe('Hello world');
        const params = create.mock.calls[0][0];
        expect(params).toMatchObject({
            model: 'claude-opus-5-5',
            thinking: {type: 'adaptive'},
            output_config: {effort: 'medium'},
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default',
            messages: [
                {role: 'user', content: 'write me a text about something!'},
                {role: 'assistant', content: 'do you want text about freedom?'},
                {role: 'user', content: 'yes'},
            ],
        });
        expect(params).not.toHaveProperty('temperature');
        expect(params).not.toHaveProperty('top_p');
    });

    it('leaves effort to the model default when not configured', async () => {
        const {client, create} = fakeClient(message({
            content: [{type: 'text', text: 'ok', citations: null} as Anthropic.Beta.BetaTextBlock],
        }));
        await new ClaudeChat({model: 'claude-opus-5-5'}, client).Chat([{text: 'hi', isUser: true}]);
        expect(create.mock.calls[0][0]).not.toHaveProperty('output_config');
    });

    it('does not ask for fallbacks on Haiku', async () => {
        const {client, create} = fakeClient(message({
            model: 'claude-haiku-5-5',
            content: [{type: 'text', text: 'ok', citations: null} as Anthropic.Beta.BetaTextBlock],
        }));
        await new ClaudeChat({model: 'claude-haiku-5-5'}, client).Chat([{text: 'hi', isUser: true}]);
        const params = create.mock.calls[0][0];
        expect(params).not.toHaveProperty('fallbacks');
        expect(params).not.toHaveProperty('betas');
    });

    it('throws RefusalError with the category on a refusal, ignoring partial text', async () => {
        const {client} = fakeClient(message({
            stop_reason: 'refusal',
            stop_details: {type: 'refusal', category: 'cyber', explanation: null} as Anthropic.Beta.BetaRefusalStopDetails,
            content: [{type: 'text', text: 'partial', citations: null} as Anthropic.Beta.BetaTextBlock],
        }));
        const chat = new ClaudeChat({model: 'claude-opus-5-5'}, client);

        const error = await chat.Chat([{text: 'hi', isUser: true}]).catch(e => e);
        expect(error).toBeInstanceOf(RefusalError);
        expect(error.category).toBe('cyber');
    });

    it('throws when the answer has no text', async () => {
        const {client} = fakeClient(message({content: []}));
        await expect(new ClaudeChat({model: 'claude-opus-5-5'}, client).Chat([{text: 'hi', isUser: true}]))
            .rejects.toThrow('no text');
    });

    it('does not call the API without a user message', async () => {
        const {client, create} = fakeClient(message({}));
        await expect(new ClaudeChat({model: 'claude-opus-5-5'}, client).Chat([{text: 'only me', isUser: false}]))
            .rejects.toThrow('No user message');
        expect(create).not.toHaveBeenCalled();
    });
});

// Real API call; runs only with a key: ANTHROPIC_API_KEY=... npx jest claude
const describeWithKey = process.env.ANTHROPIC_API_KEY ? describe : describe.skip;

describeWithKey('ClaudeChat against the API', () => {
    jest.setTimeout(120000);

    it('should chat', async () => {
        const chat = new ClaudeChat({model: process.env.CLAUDE_MODEL ?? 'claude-sonnet-5-5', effort: 'low'});
        const response = await chat.Chat([
            {text: "write me a text about something!", isUser: true},
            {text: "do you want text about freedom?", isUser: false},
            {text: "yes", isUser: true},
        ]);

        expect(response.toLowerCase()).toContain("freedom");
    });
});
