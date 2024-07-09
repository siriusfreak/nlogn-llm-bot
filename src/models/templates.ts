interface QueryResult {
    rows: any[];
    rowCount: number;
}


export interface Database {
    executeQuery(query: string, params: any[]): Promise<QueryResult>
}

export interface Template {
    name: string
    template: string
}
export default class TemplatesRepository {
    constructor(private db: Database) {}

    public async getTemplate(templateName: string): Promise<Template> {
        const res = await this.db.executeQuery("SELECT * FROM templates WHERE name = $1", [templateName])
        return res.rows[0]
    }

    public async upsertTemplate(templateName: string, template: string): Promise<void> {
        const res = await this.db.executeQuery("INSERT INTO templates (name, template) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET template = $2", [templateName, template])
    }
}
