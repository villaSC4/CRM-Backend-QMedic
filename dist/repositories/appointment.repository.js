"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentRepository = void 0;
const database_1 = require("../config/database");
class AppointmentRepository {
    static async create(appointment) {
        const [result] = await database_1.pool.query(`INSERT INTO appointments 
      (patient_id, service_id, start_time, end_time, status, is_first_session, price_paid, google_event_id, notes) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            appointment.patient_id,
            appointment.service_id,
            appointment.start_time,
            appointment.end_time,
            appointment.status,
            appointment.is_first_session ? 1 : 0,
            appointment.price_paid,
            appointment.google_event_id || null,
            appointment.notes || null,
        ]);
        return result.insertId;
    }
    static async findAllWithPatientDetails() {
        const [rows] = await database_1.pool.query(`SELECT 
        a.id, 
        a.start_time, 
        a.end_time, 
        a.status, 
        a.price_paid, 
        a.is_first_session,
        p.full_name AS patient_name, 
        p.phone AS patient_phone, 
        s.name AS service_name
      FROM appointments a
      INNER JOIN patients p ON a.patient_id = p.id
      INNER JOIN services s ON a.service_id = s.id
      ORDER BY a.start_time DESC`);
        return rows;
    }
}
exports.AppointmentRepository = AppointmentRepository;
