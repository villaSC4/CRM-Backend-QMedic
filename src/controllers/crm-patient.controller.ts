import { Request, Response } from 'express';
import { pool } from '../config/database';
import { RowDataPacket } from 'mysql2';

export class CRMPatientController {
  /**
   * Obtener todos los pacientes con conteo de citas
   */
  static async getAllPatients(req: Request, res: Response) {
    try {
      const [patients] = await pool.query<RowDataPacket[]>(`
        SELECT 
          p.id,
          p.full_name,
          p.phone,
          p.email,
          p.medical_notes,
          p.has_used_first_promo,
          p.created_at,
          COUNT(a.id) AS total_appointments
        FROM patients p
        LEFT JOIN appointments a ON p.id = a.patient_id
        GROUP BY p.id
        ORDER BY p.created_at DESC
      `);

      return res.status(200).json({ success: true, data: patients });
    } catch (error) {
      console.error('Error al obtener pacientes:', error);
      return res.status(500).json({ success: false, message: 'Error al consultar directorio' });
    }
  }

  /**
   * Actualizar notas médicas de un paciente
   */
  static async updateNotes(req: Request, res: Response) {
    try {
      const patientId = Number(req.params.id);
      const { medicalNotes } = req.body;

      await pool.query('UPDATE patients SET medical_notes = ? WHERE id = ?', [medicalNotes, patientId]);

      return res.status(200).json({ success: true, message: 'Notas actualizadas correctamente' });
    } catch (error) {
      console.error('Error al actualizar notas:', error);
      return res.status(500).json({ success: false, message: 'Error al guardar notas médicas' });
    }
  }
}