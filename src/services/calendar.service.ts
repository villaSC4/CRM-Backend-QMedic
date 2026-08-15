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
  static isWithinWorkingHours(dateInput: Date): boolean {
    const dayOfWeek = dateInput.getDay();
    const hour = dateInput.getHours();

    if (dayOfWeek === 0) return false;

    if (dayOfWeek === 4) {
      return hour >= 9 && hour < 14;
    }

    return hour >= 9 && hour < 18;
  }

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

  static async getAvailableSlots(dateStr: string): Promise<string[]> {
    const targetDate = new Date(`${dateStr}T00:00:00`);
    const dayOfWeek = targetDate.getDay();

    if (dayOfWeek === 0) return [];

    const startHour = 9;
    const endHour = dayOfWeek === 4 ? 14 : 18;

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
