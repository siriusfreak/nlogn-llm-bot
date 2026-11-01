import fs from 'fs';
import os from 'os';
import path from 'path';
import loadConfig from "./config";

const fullEnv = {
    TELEGRAM_TOKEN: 'tg',
    CONTESTER_TOKEN: 'contester',
    CLAUDE_MODEL: 'claude-opus-5-5',
    DB_HOST: 'db.example',
    DB_USER: 'bot',
    DB_PASSWORD: 'secret',
    DB_NAME: 'nlogn_llm_bot',
};

describe('loadConfig', () => {
    let dir: string;
    let file: string;

    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nlogn-config-'));
        file = path.relative(process.cwd(), path.join(dir, 'config.yaml'));
    });

    afterEach(() => {
        fs.rmSync(dir, {recursive: true, force: true});
    });

    it('works from the environment alone, without a file', () => {
        const config = loadConfig(file, {...fullEnv, CLAUDE_EFFORT: 'medium', DB_PORT: '6432', RATE_LIMIT: '5'});

        expect(config).toEqual({
            contesterToken: 'contester',
            botToken: 'tg',
            claude: {model: 'claude-opus-5-5', effort: 'medium'},
            rateLimit: 5,
            db: {host: 'db.example', port: 6432, user: 'bot', password: 'secret', database: 'nlogn_llm_bot'},
        });
    });

    it('lets the environment override the file', () => {
        fs.writeFileSync(path.join(dir, 'config.yaml'), [
            'contesterToken: from-file',
            'botToken: from-file',
            'claude:',
            '  model: claude-sonnet-5-5',
            '  effort: low',
            'rateLimit: 10',
            'db:',
            '  host: localhost',
            '  user: postgres',
            '  password: password',
            '  database: nlogn_llm_bot',
        ].join('\n'));

        const config = loadConfig(file, {TELEGRAM_TOKEN: 'from-env', CLAUDE_MODEL: 'claude-opus-5-5'});

        expect(config.botToken).toBe('from-env');
        expect(config.contesterToken).toBe('from-file');
        expect(config.claude).toEqual({model: 'claude-opus-5-5', effort: 'low'});
        expect(config.rateLimit).toBe(10);
        expect(config.db.port).toBe(5432);
    });

    it('names what is missing without printing values', () => {
        expect(() => loadConfig(file, {CLAUDE_MODEL: 'claude-opus-5-5', DB_PASSWORD: 'hunter2'}))
            .toThrow(/^Missing configuration: contesterToken \(CONTESTER_TOKEN\), botToken \(TELEGRAM_TOKEN\), db\.host \(DB_HOST\), db\.user \(DB_USER\), db\.database \(DB_NAME\)\.$/);
    });

    it('rejects an unknown effort', () => {
        expect(() => loadConfig(file, {...fullEnv, CLAUDE_EFFORT: 'extreme'})).toThrow('Unknown Claude effort');
    });
});
