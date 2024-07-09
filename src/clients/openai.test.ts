import { OpenAIChat } from "./openai";
import loadConfig from "../config";

describe('Integration tests for contester service', () => {
    jest.setTimeout(60000);

    const config = loadConfig('config/config.yaml');

    const chat = new OpenAIChat({
        apiKey: config.openAI.apiKey,
        model: "gpt-3.5-turbo"
    });

    it ('should chat', async () => {
        const response = await chat.Chat([
            {text: "write me a text about something!", isUser: true},
            {text: "do you want text about freedom?", isUser: false},
            {text: "yes", isUser: true},
        ]);

        expect(response).toContain("freedom");
    });
});
