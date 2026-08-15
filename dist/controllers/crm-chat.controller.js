"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CRMChatController = void 0;
const chat_repository_1 = require("../repositories/chat.repository");
const whatsapp_service_1 = require("../services/whatsapp.service");
const patient_repository_1 = require("../repositories/patient.repository");
class CRMChatController {
    static async getConversations(req, res) {
        try {
            const conversations = await chat_repository_1.ChatRepository.getAllConversations();
            return res.status(200).json({ success: true, data: conversations });
        }
        catch (error) {
            console.error(error);
            return res.status(500).json({ success: false, message: 'Error al obtener conversaciones' });
        }
    }
    static async getMessages(req, res) {
        try {
            const conversationId = Number(req.params.conversationId);
            const messages = await chat_repository_1.ChatRepository.getMessagesByConversationId(conversationId);
            return res.status(200).json({ success: true, data: messages });
        }
        catch (error) {
            console.error(error);
            return res.status(500).json({ success: false, message: 'Error al obtener mensajes' });
        }
    }
    static async sendMessage(req, res) {
        try {
            let { conversationId, phone, body } = req.body;
            if (!body || !phone) {
                return res.status(400).json({ success: false, message: 'Faltan parámetros requeridos (phone, body)' });
            }
            if (!conversationId) {
                let patient = await patient_repository_1.PatientRepository.findByPhone(phone);
                let patientId;
                if (!patient) {
                    patientId = await patient_repository_1.PatientRepository.create({ full_name: `Paciente ${phone}`, phone });
                }
                else {
                    patientId = patient.id;
                }
                conversationId = await chat_repository_1.ChatRepository.getOrCreateConversation(patientId);
            }
            await whatsapp_service_1.WhatsAppService.sendMessage(phone, body);
            const messageId = await chat_repository_1.ChatRepository.saveMessage({
                conversationId: Number(conversationId),
                sender: 'RECEPTIONIST',
                body,
            });
            return res.status(201).json({ success: true, messageId });
        }
        catch (error) {
            console.error('Error al enviar mensaje por WhatsApp:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al enviar mensaje' });
        }
    }
}
exports.CRMChatController = CRMChatController;
