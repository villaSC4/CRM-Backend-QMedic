"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatRepository = void 0;
const database_1 = require("../config/database");
class ChatRepository {
    static async getOrCreateConversation(patientId) {
        const [rows] = await database_1.pool.query('SELECT id FROM conversations WHERE patient_id = ? LIMIT 1', [patientId]);
        if (rows.length > 0) {
            return rows[0].id;
        }
        const [result] = await database_1.pool.query('INSERT INTO conversations (patient_id, unread_count) VALUES (?, 0)', [patientId]);
        return result.insertId;
    }
    static async saveMessage(data) {
        const [result] = await database_1.pool.query('INSERT INTO messages (conversation_id, sender, body) VALUES (?, ?, ?)', [data.conversationId, data.sender, data.body]);
        await database_1.pool.query('UPDATE conversations SET last_message = ?, updated_at = NOW() WHERE id = ?', [data.body, data.conversationId]);
        return result.insertId;
    }
    static async getAllConversations() {
        const [rows] = await database_1.pool.query(`SELECT 
        c.id AS conversation_id,
        c.unread_count,
        c.last_message,
        c.updated_at,
        p.id AS patient_id,
        p.full_name,
        p.phone
      FROM conversations c
      INNER JOIN patients p ON c.patient_id = p.id
      ORDER BY c.updated_at DESC`);
        return rows;
    }
    static async getMessagesByConversationId(conversationId) {
        const [rows] = await database_1.pool.query('SELECT id, sender, body, is_read, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC', [conversationId]);
        return rows;
    }
}
exports.ChatRepository = ChatRepository;
