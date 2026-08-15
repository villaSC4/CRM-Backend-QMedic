"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppService = void 0;
const whatsapp_web_js_1 = require("whatsapp-web.js");
const qrcode_terminal_1 = __importDefault(require("qrcode-terminal"));
const patient_repository_1 = require("../repositories/patient.repository");
const chat_repository_1 = require("../repositories/chat.repository");
class WhatsAppService {
    static client;
    static async init() {
        this.client = new whatsapp_web_js_1.Client({
            authStrategy: new whatsapp_web_js_1.LocalAuth({ dataPath: './auth_info_wwebjs' }),
            webVersionCache: {
                type: 'remote',
                remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html',
            },
            puppeteer: {
                headless: true,
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu',
                ],
            },
        });
        this.client.on('qr', (qr) => {
            console.log('\n📲 ESCANEA ESTE CÓDIGO QR CON WHATSAPP (Número de pruebas):');
            qrcode_terminal_1.default.generate(qr, { small: true });
        });
        this.client.on('ready', () => {
            console.log('✅ WhatsApp conectado y listo para recibir y enviar mensajes.');
        });
        this.client.on('auth_failure', (msg) => {
            console.error('❌ Fallo de autenticación en WhatsApp:', msg);
        });
        this.client.on('message', async (msg) => {
            if (msg.from.endsWith('@g.us') || msg.from === 'status@broadcast')
                return;
            const contact = await msg.getContact();
            const rawIdentifier = msg.from;
            const identifier = contact.number ? contact.number.replace(/\D/g, '') : rawIdentifier.split('@')[0];
            const displayName = contact.name || contact.pushname || `Lead ${identifier}`;
            const body = msg.body;
            if (!body)
                return;
            console.log(`📩 Mensaje recibido de ${displayName} (${identifier} - ID: ${rawIdentifier}): ${body}`);
            try {
                let patient = await patient_repository_1.PatientRepository.findByPhone(identifier);
                let patientId;
                if (!patient) {
                    patientId = await patient_repository_1.PatientRepository.create({
                        full_name: displayName,
                        phone: identifier,
                    });
                }
                else {
                    patientId = patient.id;
                }
                const conversationId = await chat_repository_1.ChatRepository.getOrCreateConversation(patientId);
                await chat_repository_1.ChatRepository.saveMessage({
                    conversationId,
                    sender: 'PATIENT',
                    body,
                });
            }
            catch (error) {
                console.error('Error al guardar mensaje en MySQL:', error);
            }
        });
        this.client.initialize();
    }
    static async sendMessage(target, text) {
        if (!this.client) {
            throw new Error('El cliente de WhatsApp no está inicializado');
        }
        let finalChatId = target.trim();
        if (!finalChatId.includes('@')) {
            if (finalChatId.length > 13 && !finalChatId.startsWith('51')) {
                finalChatId = `${finalChatId}@lid`;
            }
            else {
                const clean = finalChatId.replace(/\D/g, '');
                const formatted = clean.length === 9 && clean.startsWith('9') ? `51${clean}` : clean;
                finalChatId = `${formatted}@c.us`;
            }
        }
        console.log(`📤 Enviando mensaje a ${finalChatId}: ${text}`);
        try {
            const chat = await this.client.getChatById(finalChatId);
            return await chat.sendMessage(text);
        }
        catch (err) {
            return await this.client.sendMessage(finalChatId, text);
        }
    }
}
exports.WhatsAppService = WhatsAppService;
