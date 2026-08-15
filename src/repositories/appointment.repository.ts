import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { pool } from '../config/database';

export interface Appointment {
  id?: number;
  patient_id: number;
  service_id: number;
  start_time: Date | string;
  end_time: Date | string;
  status: 'PENDING' | 'CONFIRMED' | 'ATTENDED' | 'CANCELLED';
  is_first_session: boolean | number;
  price_paid: number;
  google_event_id?: string | null;
  notes?: string | null;
}

export class AppointmentRepository {
  static async create(appointment: Appointment): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO appointments 
      (patient_id, service_id, start_time, end_time, status, is_first_session, price_paid, google_event_id, notes) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        appointment.patient_id,
        appointment.service_id,
        appointment.start_time,
        appointment.end_time,
        appointment.status,
        appointment.is_first_session ? 1 : 0,
        appointment.price_paid,
        appointment.google_event_id || null,
        appointment.notes || null,
      ]
    );

    return result.insertId;
  }

  static async findAllWithPatientDetails(): Promise<RowDataPacket[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        a.id, 
        DATE_FORMAT(a.start_time, '%Y-%m-%d %H:%i:%s') AS start_time, 
        DATE_FORMAT(a.end_time, '%Y-%m-%d %H:%i:%s') AS end_time, 
        a.status, 
        a.price_paid, 
        a.is_first_session,
        p.full_name AS patient_name, 
        p.phone AS patient_phone, 
        s.name AS service_name
      FROM appointments a
      INNER JOIN patients p ON a.patient_id = p.id
      INNER JOIN services s ON a.service_id = s.id
      ORDER BY a.start_time DESC`
    );

    return rows;
  }
}