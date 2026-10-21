import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  isConfigured() {
    return Boolean(this.config.get<string>('SMTP_HOST')?.trim());
  }

  /** Retorna false quando não há SMTP configurado; o envio nunca expõe o conteúdo no retorno da API. */
  async send(message: MailMessage): Promise<boolean> {
    const transporter = this.getTransporter();
    if (!transporter) {
      this.logger.warn(`SMTP não configurado; e-mail "${message.subject}" para ${message.to} não foi enviado.`);
      return false;
    }
    await transporter.sendMail({
      from: this.config.get<string>('SMTP_FROM') || this.config.get<string>('SMTP_USER'),
      ...message,
    });
    return true;
  }

  private getTransporter() {
    if (this.transporter) return this.transporter;
    const host = this.config.get<string>('SMTP_HOST')?.trim();
    if (!host) return null;
    const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
    const user = this.config.get<string>('SMTP_USER')?.trim();
    this.transporter = createTransport({
      host,
      port,
      secure: port === 465,
      ...(user && { auth: { user, pass: this.config.get<string>('SMTP_PASS') ?? '' } }),
    });
    return this.transporter;
  }
}
