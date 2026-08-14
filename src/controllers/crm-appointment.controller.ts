import { Request, Response } from 'express';
import { PatientRepository } from '../repositories/patient.repository';
import { AppointmentRepository } from '../repositories/appointment.repository';
import { CalendarService } from '../services/calendar.service';
import { pool } from '../config/database';

export class CRMAppointmentController {
  /**
   * Listar todas las citas para el CRM
   */
  static async getAllAppointments(req: Request, res: Response) {
    try {
      const appointments = await AppointmentRepository.findAllWithPatientDetails();
      return res.status(200).json({ success: true, data: appointments });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false, message: 'Error al obtener citas de MySQL' });
    }
  }

  /**
   * Crear una nueva cita desde el CRM o Lead de WhatsApp
   */
  static async createAppointment(req: Request, res: Response) {
    try {
      const { fullName, phone, email, startTime, isFirstSession, notes } = req.body;

      const start = new Date(startTime);
      // Duración estándar de sesión de 60 minutos
      const end = new Date(start.getTime() + 60 * 60 * 1000);

      // 1. Validar reglas de horario de QMEDIC
      if (!CalendarService.isWithinWorkingHours(start)) {
        return res.status(400).json({
          success: false,
          message: 'El horario está fuera del rango de atención de QMEDIC (Jueves hasta 2pm, otros días hasta 6pm)'
        });
      }

      // 2. Buscar o registrar paciente en MySQL
      let patient = await PatientRepository.findByPhone(phone);
      let patientId: number;

      if (!patient) {
        patientId = await PatientRepository.create({
          full_name: fullName,
          phone,
          email,
        });
      } else {
        patientId = patient.id!;
      }

      // 3. Tarifa comercial QMEDIC (S/ 120.00 sesión combinada / promo primera sesión)
      const pricePaid = 120.00;

      // 4. Crear evento en Google Calendar
      const googleEventId = await CalendarService.createAppointmentEvent({
        patientName: fullName,
        phone,
        startTime: start,
        endTime: end,
        isFirstSession: Boolean(isFirstSession),
      });

      // 5. Guardar cita en MySQL
      const appointmentId = await AppointmentRepository.create({
        patient_id: patientId,
        service_id: 2,
        start_time: start,
        end_time: end,
        status: 'CONFIRMED',
        is_first_session: Boolean(isFirstSession),
        price_paid: pricePaid,
        google_event_id: googleEventId,
        notes,
      });

      // Si fue su primera sesión, marcarla como usada en la ficha del paciente
      if (isFirstSession) {
        await PatientRepository.markPromoAsUsed(patientId);
      }

      return res.status(201).json({
        success: true,
        message: 'Cita creada y sincronizada con éxito en el CRM de QMEDIC',
        appointmentId,
        googleEventId,
      });
    } catch (error) {
      console.error('Error al agendar cita:', error);
      return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }
  static async getSlots(req: Request, res: Response) {
    try {
      const { date } = req.query; // Ejemplo: ?date=2026-08-15

      if (!date || typeof date !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Debe proporcionar una fecha en formato YYYY-MM-DD en la query.',
        });
      }

      const availableSlots = await CalendarService.getAvailableSlots(date);

      return res.status(200).json({
        success: true,
        date,
        availableSlots,
      });
    } catch (error) {
      console.error('Error al obtener slots:', error);
      return res.status(500).json({
        success: false,
        message: 'Error al consultar disponibilidad en Google Calendar',
      });
    }
  }

  static async updateStatus(req: Request, res: Response) {
    try {
      const appointmentId = Number(req.params.id);
      const { status } = req.body; // 'ATTENDED' | 'CANCELLED' | 'CONFIRMED'

      if (!['CONFIRMED', 'ATTENDED', 'CANCELLED'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Estado inválido' });
      }

      // Obtener datos de la cita
      const [appointmentRows]: any = await pool.query(
        'SELECT patient_id, is_first_session FROM appointments WHERE id = ? LIMIT 1',
        [appointmentId]
      );

      if (appointmentRows.length === 0) {
        return res.status(404).json({ success: false, message: 'Cita no encontrada' });
      }

      const appointment = appointmentRows[0];

      // Actualizar estado de la cita
      await pool.query('UPDATE appointments SET status = ? WHERE id = ?', [status, appointmentId]);

      // Si fue atendida y era su primera sesión, marcar que ya usó la promoción
      if (status === 'ATTENDED' && appointment.is_first_session) {
        await pool.query('UPDATE patients SET has_used_first_promo = 1 WHERE id = ?', [
          appointment.patient_id,
        ]);
      }

      return res.status(200).json({ success: true, message: 'Estado actualizado correctamente' });
    } catch (error) {
      console.error('Error al actualizar estado:', error);
      return res.status(500).json({ success: false, message: 'Error al cambiar estado de la cita' });
    }
  }
}