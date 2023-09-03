import fs from 'fs';
import yaml from 'js-yaml';
import { join } from 'path';

export interface Config {

    contesterToken: string

    botToken: string

    openAI: {
        apiKey: string
        model: string
    }

    rateLimit: number

    db: {
        host: string
        port: number
        user: string
        password: string
        database: string
    }
}

export default function loadConfig(filename: string): Config {
    try {
        const filePath = join(process.cwd(), filename);
        const fileContents = fs.readFileSync(filePath, 'utf8');

        return yaml.load(fileContents) as Config;
    } catch (error) {
        console.error('Error while parsing the YAML configuration file:', error);
        throw new Error('Failed to parse the YAML configuration file.');
    }
}
