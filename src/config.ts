import fs from 'fs';
import yaml from 'js-yaml';
import { join } from 'path';
import {Effort} from "./clients/claude";

export interface Config {

    contesterToken: string

    botToken: string

    // The API key is not here: the SDK reads ANTHROPIC_API_KEY.
    claude: {
        model: string
        effort?: Effort
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

const EFFORTS: Effort[] = ['low', 'medium', 'high', 'xhigh', 'max'];

// The YAML file is optional (local runs); environment variables override it.
// In k8s everything comes from the environment, secrets from Secrets.
export default function loadConfig(filename: string, env: NodeJS.ProcessEnv = process.env): Config {
    let file: Partial<Config> = {};
    const filePath = join(process.cwd(), filename);
    if (fs.existsSync(filePath)) {
        try {
            file = (yaml.load(fs.readFileSync(filePath, 'utf8')) ?? {}) as Partial<Config>;
        } catch (error) {
            console.error('Error while parsing the YAML configuration file:', error);
            throw new Error('Failed to parse the YAML configuration file.');
        }
    }

    const effort = env.CLAUDE_EFFORT ?? file.claude?.effort;
    if (effort !== undefined && !EFFORTS.includes(effort as Effort)) {
        throw new Error(`Unknown Claude effort "${effort}", expected one of ${EFFORTS.join(', ')}.`);
    }

    const config: Config = {
        contesterToken: env.CONTESTER_TOKEN ?? file.contesterToken ?? '',
        botToken: env.TELEGRAM_TOKEN ?? file.botToken ?? '',
        claude: {
            model: env.CLAUDE_MODEL ?? file.claude?.model ?? '',
            effort: effort as Effort | undefined,
        },
        rateLimit: Number(env.RATE_LIMIT ?? file.rateLimit ?? 30),
        db: {
            host: env.DB_HOST ?? file.db?.host ?? '',
            port: Number(env.DB_PORT ?? file.db?.port ?? 5432),
            user: env.DB_USER ?? file.db?.user ?? '',
            password: env.DB_PASSWORD ?? file.db?.password ?? '',
            database: env.DB_NAME ?? file.db?.database ?? '',
        },
    };

    const missing = Object.entries({
        'contesterToken (CONTESTER_TOKEN)': config.contesterToken,
        'botToken (TELEGRAM_TOKEN)': config.botToken,
        'claude.model (CLAUDE_MODEL)': config.claude.model,
        'db.host (DB_HOST)': config.db.host,
        'db.user (DB_USER)': config.db.user,
        'db.password (DB_PASSWORD)': config.db.password,
        'db.database (DB_NAME)': config.db.database,
    }).filter(([, value]) => !value).map(([name]) => name);
    if (missing.length > 0) {
        throw new Error(`Missing configuration: ${missing.join(', ')}.`);
    }

    return config;
}
