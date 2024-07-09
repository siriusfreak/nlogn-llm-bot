import Database from "../database/database";
import {Group} from "../types";

export default class GroupsRepository {
    constructor(private db: Database) {}

    async addGroup(chatId: number): Promise<number> {
        const res = await this.db.executeQuery("INSERT INTO groups (chat_id) VALUES ($1) RETURNING id", [chatId])
        return res.rows[0].id
    }
    async getGropByChatId(chatId: number): Promise<Group | null> {
        const res = await this.db.executeQuery("SELECT * FROM groups WHERE chat_id = $1", [chatId])
        if (res.rows.length === 0) {
            return null
        }
        return res.rows[0]
    }
}
