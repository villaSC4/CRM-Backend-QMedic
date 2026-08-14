import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { pool } from '../config/database';

export class ChatRepository {
  /**
   * Obtener o crear una conversación asociada a un paciente
   */
  static async getOrCreateConversation(patientId: number): Promise<number> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM conversations WHERE patient_id = ? LIMIT 1',
      [patientId]
    );

    if (rows.length > 0) {
      return rows[0].id;
    }

    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO conversations (patient_id, unread_count) VALUES (?, 0)',
      [patientId]
    );

    return result.insertId;
  }

  /**
   * Guardar un nuevo mensaje entrante o saliente
   */
  static async saveMessage(data: {
    conversationId: number;
    sender: 'PATIENT' | 'SYSTEM' | 'RECEPTIONIST';
    body: string;
  }): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO messages (conversation_id, sender, body) VALUES (?, ?, ?)',
      [data.conversationId, data.sender, data.body]
    );

    // Actualizar el último mensaje en la conversación
    await pool.query(
      'UPDATE conversations SET last_message = ?, updated_at = NOW() WHERE id = ?',
      [data.body, data.conversationId]
    );

    return result.insertId;
  }

  /**
   * Listar todas las conversaciones para la bandeja del CRM
   */
  static async getAllConversations(): Promise<RowDataPacket[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        c.id AS conversation_id,
        c.unread_count,
        c.last_message,
        c.updated_at,
        p.id AS patient_id,
        p.full_name,
        p.phone
      FROM conversations c
      INNER JOIN patients p ON c.patient_id = p.id
      ORDER BY c.updated_at DESC`
    );

    return rows;
  }

  /**
   * Obtener el historial de mensajes de una conversación
   */
  static async getMessagesByConversationId(conversationId: number): Promise<RowDataPacket[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, sender, body, is_read, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
      [conversationId]
    );

    return rows;
  }
}