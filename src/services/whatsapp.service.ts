import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { PatientRepository } from '../repositories/patient.repository';
import { ChatRepository } from '../repositories/chat.repository';

export class WhatsAppService {
  private static client: Client;

  static async init() {
    this.client = new Client({
      authStrategy: new LocalAuth({ dataPath: './auth_info_wwebjs' }),
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
          '--single-process',
          '--disable-extensions',
          '--disable-software-rasterizer',
          '--js-flags=--max-old-space-size=200',
        ],
      },
    });

    this.client.on('loading_screen', (percent, message) => {
      console.log(`⏳ Cargando WhatsApp Web: ${percent}% - ${message}`);
    });

    this.client.on('qr', (qr) => {
      console.log('\n📲 ESCANEA ESTE CÓDIGO QR CON WHATSAPP (Número de pruebas):');
      qrcode.generate(qr, { small: true });
    });

    this.client.on('authenticated', () => {
      console.log('🔑 WhatsApp autenticado correctamente.');
    });

    this.client.on('ready', () => {
      console.log('✅ WhatsApp conectado y listo para recibir y enviar mensajes.');
    });

    this.client.on('auth_failure', (msg) => {
      console.error('❌ Fallo de autenticación en WhatsApp:', msg);
    });

    this.client.on('disconnected', (reason) => {
      console.log('⚠️ WhatsApp desconectado:', reason);
    });

    this.client.on('message', async (msg) => {
      if (msg.from.endsWith('@g.us') || msg.from === 'status@broadcast') return;

      const contact = await msg.getContact();

      const rawIdentifier = msg.from; 
      const identifier = contact.number ? contact.number.replace(/\D/g, '') : rawIdentifier.split('@')[0];
      const displayName = contact.name || contact.pushname || `Lead ${identifier}`;
      const body = msg.body;

      if (!body) return;

      console.log(`📩 Mensaje recibido de ${displayName} (${identifier} - ID: ${rawIdentifier}): ${body}`);

      try {
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

    console.log('🤖 Iniciando Chromium y conectando a WhatsApp Web...');
    this.client.initialize().catch((err) => {
      console.error('❌ Error crítico al inicializar WhatsApp Web:', err);
    });
  }

  static async sendMessage(target: string, text: string) {
    if (!this.client) {
      throw new Error('El cliente de WhatsApp no está inicializado');
    }

    let finalChatId = target.trim();

    if (!finalChatId.includes('@')) {
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
      const chat = await this.client.getChatById(finalChatId);
      return await chat.sendMessage(text);
    } catch (err) {
      return await this.client.sendMessage(finalChatId, text);
    }
  }
}