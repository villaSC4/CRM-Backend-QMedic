import { Request, Response } from 'express';
import { ChatRepository } from '../repositories/chat.repository';
import { WhatsAppService } from '../services/whatsapp.service';
import { PatientRepository } from '../repositories/patient.repository'; 

export class CRMChatController {
  /**
   * Obtener lista de conversaciones con leads y pacientes
   */
  static async getConversations(req: Request, res: Response) {
    try {
      const conversations = await ChatRepository.getAllConversations();
      return res.status(200).json({ success: true, data: conversations });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false, message: 'Error al obtener conversaciones' });
    }
  }

  /**
   * Obtener mensajes de una conversación
   */
  static async getMessages(req: Request, res: Response) {
    try {
      const conversationId = Number(req.params.conversationId);
      const messages = await ChatRepository.getMessagesByConversationId(conversationId);
      return res.status(200).json({ success: true, data: messages });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false, message: 'Error al obtener mensajes' });
    }
  }

  /**
   * Enviar mensaje de WhatsApp desde el CRM al paciente
   */
  static async sendMessage(req: Request, res: Response) {
    try {
      let { conversationId, phone, body } = req.body;

      if (!body || !phone) {
        return res.status(400).json({ success: false, message: 'Faltan parámetros requeridos (phone, body)' });
      }

      // 1. Si no hay conversationId o viene un paciente, buscar o crear la conversación automáticamente
      if (!conversationId) {
        let patient = await PatientRepository.findByPhone(phone);
        let patientId: number;
        if (!patient) {
          patientId = await PatientRepository.create({ full_name: `Paciente ${phone}`, phone });
        } else {
          patientId = patient.id!;
        }
        conversationId = await ChatRepository.getOrCreateConversation(patientId);
      }

      // 2. Enviar vía WhatsApp Web Client (Pasamos el teléfono o el identificador completo si trae @lid)
      await WhatsAppService.sendMessage(phone, body);

      // 3. Guardar mensaje saliente en MySQL
      const messageId = await ChatRepository.saveMessage({
        conversationId: Number(conversationId),
        sender: 'RECEPTIONIST',
        body,
      });

      return res.status(201).json({ success: true, messageId });
    } catch (error: any) {
      console.error('Error al enviar mensaje por WhatsApp:', error);
      return res.status(500).json({ success: false, message: error.message || 'Error al enviar mensaje' });
    }
  }
}