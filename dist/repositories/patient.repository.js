"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientRepository = void 0;
const database_1 = require("../config/database");
class PatientRepository {
    static async findByPhone(phone) {
        const [rows] = await database_1.pool.query('SELECT * FROM patients WHERE phone = ? LIMIT 1', [phone]);
        if (rows.length === 0)
            return null;
        return rows[0];
    }
    static async create(data) {
        const [result] = await database_1.pool.query('INSERT INTO patients (full_name, phone, email) VALUES (?, ?, ?)', [data.full_name, data.phone, data.email || null]);
        return result.insertId;
    }
    static async markPromoAsUsed(patientId) {
        await database_1.pool.query('UPDATE patients SET has_used_first_promo = 1 WHERE id = ?', [patientId]);
    }
}
exports.PatientRepository = PatientRepository;
