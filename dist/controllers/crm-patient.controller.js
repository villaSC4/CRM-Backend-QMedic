"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CRMPatientController = void 0;
const database_1 = require("../config/database");
class CRMPatientController {
    static async getAllPatients(req, res) {
        try {
            const [patients] = await database_1.pool.query(`
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
        }
        catch (error) {
            console.error('Error al obtener pacientes:', error);
            return res.status(500).json({ success: false, message: 'Error al consultar directorio' });
        }
    }
    static async updateNotes(req, res) {
        try {
            const patientId = Number(req.params.id);
            const { medicalNotes } = req.body;
            await database_1.pool.query('UPDATE patients SET medical_notes = ? WHERE id = ?', [medicalNotes, patientId]);
            return res.status(200).json({ success: true, message: 'Notas actualizadas correctamente' });
        }
        catch (error) {
            console.error('Error al actualizar notas:', error);
            return res.status(500).json({ success: false, message: 'Error al guardar notas médicas' });
        }
    }
}
exports.CRMPatientController = CRMPatientController;
