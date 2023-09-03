import { Pool, PoolClient } from 'pg';

export interface QueryResult {
    rows: any[];
    rowCount: number;
}

export interface Config {
    host: string
    port: number
    user: string
    password: string
    database: string
}

class Database {
    private pool?: Pool;
    private client?: PoolClient;

    constructor(private config: Config) {}

    public async connect(): Promise<void> {
        this.pool = new Pool({
            host: this.config.host,
            port: this.config.port,
            user: this.config.user,
            password: this.config.password,
            database: this.config.database,
            query_timeout: 1000, // Increase the timeout value (in milliseconds)
            ssl: false,
        });

        try {
            this.client = await this.pool.connect();
            console.log('Connected to the database');
        } catch (error) {
            console.error('Failed to connect to the database', error);
            throw error;
        }
    }

    public async disconnect(): Promise<void> {
        if (this.pool) {
            await this.pool.end();
            console.log('Disconnected from the database');
        }
    }

    public async executeQuery(query: string, params: any[]): Promise<QueryResult> {
        try {
            if (!this.pool) {
                throw new Error('Database pool is not initialized');
            }
            const res = await this.pool.query(query, params);
            if (res && res.rows && typeof res.rowCount !== 'undefined') {
                return {
                    rows: res.rows,
                    rowCount: res.rowCount
                };
            }
            throw new Error('Database query failed. Please check the console for more details.');
        } catch (error) {
            console.error('Database query failed:', error);
            throw new Error('Database query failed. Please check the console for more details.');
        }
    }

}

export default Database;
