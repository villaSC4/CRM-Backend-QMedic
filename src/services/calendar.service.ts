import { google } from 'googleapis';
import path from 'path';

const KEYFILEPATH = path.join(__dirname, '../../google-credentials.json');
const SCOPES = ['https://www.googleapis.com/auth/calendar'];

const auth = new google.auth.GoogleAuth({
  keyFile: KEYFILEPATH,
  scopes: SCOPES,
});

const calendar = google.calendar({ version: 'v3', auth });
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'aaronpalominod34@gmail.com';

export class CalendarService {
  /**
   * Valida si el horario solicitado cumple los horarios de QMEDIC[cite: 1]
   * Lun-Sáb: 9:00 AM - 6:00 PM (último turno 5:00 PM)[cite: 1]
   * Jueves: 9:00 AM - 2:00 PM (último turno 1:00 PM)[cite: 1]
   */
  static isWithinWorkingHours(dateInput: Date): boolean {
    const dayOfWeek = dateInput.getDay(); // 0: Domingo, 1: Lunes, ..., 4: Jueves, 6: Sábado
    const hour = dateInput.getHours();

    if (dayOfWeek === 0) return false; // Domingo cerrado

    // Jueves: 9:00 AM a 2:00 PM (último turno 1:00 PM)[cite: 1]
    if (dayOfWeek === 4) {
      return hour >= 9 && hour < 14;
    }

    // Lunes a Sábado regulares: 9:00 AM a 6:00 PM (último turno 5:00 PM)[cite: 1]
    return hour >= 9 && hour < 18;
  }

  /**
   * Inserta la cita como evento en Google Calendar
   */
  static async createAppointmentEvent(data: {
    patientName: string;
    phone: string;
    startTime: Date;
    endTime: Date;
    isFirstSession: boolean;
  }): Promise<string | undefined> {
    try {
      const summary = `QMEDIC Cita: ${data.patientName}`;
      const description = `
        Paciente: ${data.patientName}
        Teléfono: ${data.phone}
        Detalle: Combinación de Terapias Personalizadas
        Primera Atención: ${data.isFirstSession ? 'SÍ (Tarifa Promo S/ 120)' : 'NO (S/ 120)'}
      `;

      const response = await calendar.events.insert({
        calendarId: CALENDAR_ID,
        requestBody: {
          summary,
          description,
          start: { dateTime: data.startTime.toISOString(), timeZone: 'America/Lima' },
          end: { dateTime: data.endTime.toISOString(), timeZone: 'America/Lima' },
        },
      });

      return response.data.id || undefined;
    } catch (error) {
      console.error('Error al insertar evento en Google Calendar:', error);
      return undefined;
    }
  }

  /**
   * Obtiene los bloques de horarios disponibles para una fecha específica
   * Formato de fecha esperado: 'YYYY-MM-DD'
   */
  static async getAvailableSlots(dateStr: string): Promise<string[]> {
    const targetDate = new Date(`${dateStr}T00:00:00`);
    const dayOfWeek = targetDate.getDay();

    // Domingos no hay atención
    if (dayOfWeek === 0) return [];

    // Definir hora de inicio y fin según el día
    const startHour = 9; // 9:00 AM
    const endHour = dayOfWeek === 4 ? 14 : 18; // Jueves hasta las 2:00 PM, demás días hasta las 6:00 PM

    // Consultar eventos existentes en Google Calendar para esa fecha
    const timeMin = new Date(`${dateStr}T00:00:00-05:00`).toISOString();
    const timeMax = new Date(`${dateStr}T23:59:59-05:00`).toISOString();

    const response = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const busyEvents = response.data.items || [];

    // Generar turnos de 1 hora y descartar los ocupados
    const availableSlots: string[] = [];

    for (let hour = startHour; hour < endHour; hour++) {
      const slotStart = new Date(`${dateStr}T${hour.toString().padStart(2, '0')}:00:00-05:00`);
      const slotEnd = new Date(`${dateStr}T${(hour + 1).toString().padStart(2, '0')}:00:00-05:00`);

      const isBusy = busyEvents.some((event) => {
        if (!event.start?.dateTime || !event.end?.dateTime) return false;
        const eventStart = new Date(event.start.dateTime);
        const eventEnd = new Date(event.end.dateTime);

        return slotStart < eventEnd && slotEnd > eventStart;
      });

      if (!isBusy) {
        availableSlots.push(`${hour.toString().padStart(2, '0')}:00`);
      }
    }

    return availableSlots;
  }
}

