import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { PatientRepository } from '../repositories/patient.repository';
import { ChatRepository } from '../repositories/chat.repository';

export class WhatsAppService {
  private static client: Client;

  static async init() {
    this.client = new Client({
      authStrategy: new LocalAuth({ dataPath: './auth_info_wwebjs' }),
      puppeteer: {
        headless: true, 
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
      qrcode.generate(qr, { small: true });
    });

    this.client.on('ready', () => {
      console.log('✅ WhatsApp conectado y listo para recibir y enviar mensajes.');
    });

    this.client.on('auth_failure', (msg) => {
      console.error('❌ Fallo de autenticación en WhatsApp:', msg);
    });

    // Escuchar mensajes entrantes
    // Escuchar mensajes entrantes
    this.client.on('message', async (msg) => {
      // Permitir chats personales que terminen en @c.us o @lid, ignorar grupos y estados
      if (msg.from.endsWith('@g.us') || msg.from === 'status@broadcast') return;

      const contact = await msg.getContact();

      // Guardamos el identificador completo (ej: 46484481429568@lid o número limpio) para mapear exacto
      const rawIdentifier = msg.from; 
      const identifier = contact.number ? contact.number.replace(/\D/g, '') : rawIdentifier.split('@')[0];
      const displayName = contact.name || contact.pushname || `Lead ${identifier}`;
      const body = msg.body;

      if (!body) return;

      console.log(`📩 Mensaje recibido de ${displayName} (${identifier} - ID: ${rawIdentifier}): ${body}`);

      try {
        // 1. Buscar o registrar paciente en MySQL usando el número limpio
        let patient = await PatientRepository.findByPhone(identifier);
        let patientId: number;

        if (!patient) {
          patientId = await PatientRepository.create({
            full_name: displayName,
            phone: identifier,
          });
        } else {
          patientId = patient.id!;
        }

        // 2. Guardar en la conversación
        const conversationId = await ChatRepository.getOrCreateConversation(patientId);
        await ChatRepository.saveMessage({
          conversationId,
          sender: 'PATIENT',
          body,
        });
      } catch (error) {
        console.error('Error al guardar mensaje en MySQL:', error);
      }
    });

    this.client.initialize();
  }

  /**
   * Enviar mensaje desde el CRM
   */
  static async sendMessage(target: string, text: string) {
    if (!this.client) {
      throw new Error('El cliente de WhatsApp no está inicializado');
    }

    let finalChatId = target.trim();

    // 1. Si ya tiene sufijo @lid o @c.us, usarlo directamente
    if (!finalChatId.includes('@')) {
      // Si tiene más de 13 dígitos y no empieza con código de país 51, es un LID
      if (finalChatId.length > 13 && !finalChatId.startsWith('51')) {
        finalChatId = `${finalChatId}@lid`;
      } else {
        const clean = finalChatId.replace(/\D/g, '');
        const formatted = clean.length === 9 && clean.startsWith('9') ? `51${clean}` : clean;
        finalChatId = `${formatted}@c.us`;
      }
    }

    console.log(`📤 Enviando mensaje a ${finalChatId}: ${text}`);

    try {
      // Intento 1: Obtener el objeto Chat directo y responder
      const chat = await this.client.getChatById(finalChatId);
      return await chat.sendMessage(text);
    } catch (err) {
      // Intento 2: Envío fallback directo por Client
      return await this.client.sendMessage(finalChatId, text);
    }
  }
}