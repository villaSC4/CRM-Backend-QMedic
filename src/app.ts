import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection } from './config/database';
import { CRMAppointmentController } from './controllers/crm-appointment.controller';
import { WhatsAppService } from './services/whatsapp.service';
import { CRMChatController } from './controllers/crm-chat.controller';
import { CRMPatientController } from './controllers/crm-patient.controller';
import authRoutes from './routes/authRoutes';


dotenv.config();

const app = express();

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json());

app.use('/api/auth', authRoutes);

// Rutas de Pacientes
app.get(['/api/v1/crm/patients', '/patients'], CRMPatientController.getAllPatients);
app.put(['/api/v1/crm/patients/:id/notes', '/patients/:id/notes'], CRMPatientController.updateNotes);

// Rutas de Chats WhatsApp
app.get(['/api/v1/crm/chats', '/chats'], CRMChatController.getConversations);
app.get(['/api/v1/crm/chats/:conversationId/messages', '/chats/:conversationId/messages'], CRMChatController.getMessages);
app.post(['/api/v1/crm/chats/send', '/chats/send'], CRMChatController.sendMessage);

// Rutas de Citas y Google Calendar
app.get(['/api/v1/crm/appointments', '/appointments'], CRMAppointmentController.getAllAppointments);
app.get(['/api/v1/crm/appointments/slots', '/appointments/slots'], CRMAppointmentController.getSlots);
app.post(['/api/v1/crm/appointments', '/appointments'], CRMAppointmentController.createAppointment);
app.patch(['/api/v1/crm/appointments/:id/status', '/appointments/:id/status'], CRMAppointmentController.updateStatus);

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  await testConnection();
  console.log(`🚀 Servidor CRM QMEDIC corriendo en el puerto ${PORT}`);
  
  await WhatsAppService.init();
});