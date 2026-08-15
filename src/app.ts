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

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);

app.get('/api/v1/crm/patients', CRMPatientController.getAllPatients);
app.put('/api/v1/crm/patients/:id/notes', CRMPatientController.updateNotes);
app.get('/api/v1/crm/chats', CRMChatController.getConversations);
app.get('/api/v1/crm/chats/:conversationId/messages', CRMChatController.getMessages);
app.post('/api/v1/crm/chats/send', CRMChatController.sendMessage);
app.get('/api/v1/crm/appointments', CRMAppointmentController.getAllAppointments);
app.get('/api/v1/crm/appointments/slots', CRMAppointmentController.getSlots);
app.post('/api/v1/crm/appointments', CRMAppointmentController.createAppointment);
app.patch('/api/v1/crm/appointments/:id/status', CRMAppointmentController.updateStatus);

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  await testConnection();
  console.log(`🚀 Servidor CRM QMEDIC corriendo en el puerto ${PORT}`);
  
  await WhatsAppService.init();
});