import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { pool } from '../config/database';

export interface Patient {
  id?: number;
  full_name: string;
  phone: string;
  email?: string | null;
  medical_notes?: string | null;
  has_used_first_promo?: boolean | number;
}

export class PatientRepository {
  static async findByPhone(phone: string): Promise<Patient | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM patients WHERE phone = ? LIMIT 1',
      [phone]
    );

    if (rows.length === 0) return null;
    return rows[0] as Patient;
  }

  static async create(data: { full_name: string; phone: string; email?: string }): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO patients (full_name, phone, email) VALUES (?, ?, ?)',
      [data.full_name, data.phone, data.email || null]
    );

    return result.insertId;
  }

  static async markPromoAsUsed(patientId: number): Promise<void> {
    await pool.query(
      'UPDATE patients SET has_used_first_promo = 1 WHERE id = ?',
      [patientId]
    );
  }
}