import { Request, Response } from 'express';
import { PatientRepository } from '../repositories/patient.repository';
import { AppointmentRepository } from '../repositories/appointment.repository';
import { CalendarService } from '../services/calendar.service';
import { pool } from '../config/database';

export class CRMAppointmentController {
  static async getAllAppointments(req: Request, res: Response) {
    try {
      const appointments = await AppointmentRepository.findAllWithPatientDetails();
      return res.status(200).json({ success: true, data: appointments });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false, message: 'Error al obtener citas de MySQL' });
    }
  }

  static async createAppointment(req: Request, res: Response) {
    try {
      const { fullName, phone, email, startTime, isFirstSession, notes } = req.body;

      const start = new Date(startTime);
      const end = new Date(start.getTime() + 60 * 60 * 1000);

      if (!CalendarService.isWithinWorkingHours(start)) {
        return res.status(400).json({
          success: false,
          message: 'El horario está fuera del rango de atención de QMEDIC (Jueves hasta 2pm, otros días hasta 6pm)'
        });
      }

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

      const pricePaid = 120.00;

      const googleEventId = await CalendarService.createAppointmentEvent({
        patientName: fullName,
        phone,
        startTime: start,
        endTime: end,
        isFirstSession: Boolean(isFirstSession),
      });

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
      const { date } = req.query;

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
      const { status } = req.body;

      if (!['CONFIRMED', 'ATTENDED', 'CANCELLED'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Estado inválido' });
      }

      const [appointmentRows]: any = await pool.query(
        'SELECT patient_id, is_first_session FROM appointments WHERE id = ? LIMIT 1',
        [appointmentId]
      );

      if (appointmentRows.length === 0) {
        return res.status(404).json({ success: false, message: 'Cita no encontrada' });
      }

      const appointment = appointmentRows[0];

      await pool.query('UPDATE appointments SET status = ? WHERE id = ?', [status, appointmentId]);

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