import nodemailer, { type Transporter } from 'nodemailer';
import path from 'node:path';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from?: string;
  fromName?: string;
}

export async function sendPhotoEmail(
  smtp: SmtpConfig,
  to: string,
  filepath: string,
  eventName?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!smtp.host || !smtp.user) {
    return { ok: false, error: 'SMTP non configuré (host/user manquant)' };
  }

  try {
    const transporter = createTransport(smtp);
    const filename = path.basename(filepath);
    const fromAddr = smtp.from || smtp.user;
    const from = smtp.fromName ? `"${smtp.fromName}" <${fromAddr}>` : fromAddr;

    await transporter.sendMail({
      from,
      to,
      subject: eventName ? `Votre photo — ${eventName}` : 'Votre photo PhotoBooth',
      text: `Bonjour,\n\nVoici votre photo souvenir ${eventName ? `de "${eventName}"` : ''}.\n\nMerci d'avoir participé !\n`,
      html: emailHtml(eventName),
      attachments: [{ filename, path: filepath }],
    });

    return { ok: true };
  } catch (e: any) {
    console.error('[mailer] erreur envoi:', e);
    return { ok: false, error: e?.message ?? 'Erreur SMTP inconnue' };
  }
}

export async function sendVideoLinkEmail(
  smtp: SmtpConfig,
  to: string,
  shareUrl: string,
  eventName?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!smtp.host || !smtp.user) {
    return { ok: false, error: 'SMTP non configuré (host/user manquant)' };
  }
  if (!shareUrl) {
    return { ok: false, error: 'Lien de partage manquant' };
  }

  try {
    const transporter = createTransport(smtp);
    const fromAddr = smtp.from || smtp.user;
    const from = smtp.fromName ? `"${smtp.fromName}" <${fromAddr}>` : fromAddr;

    await transporter.sendMail({
      from,
      to,
      subject: eventName ? `Votre vidéo — ${eventName}` : 'Votre vidéo PhotoBooth',
      text: `Bonjour,\n\nVoici le lien vers votre vidéo souvenir${
        eventName ? ` de "${eventName}"` : ''
      } :\n${shareUrl}\n\nLe lien est valable 24 heures.\n`,
      html: videoEmailHtml(shareUrl, eventName),
    });

    return { ok: true };
  } catch (e: any) {
    console.error('[mailer] erreur envoi vidéo:', e);
    return { ok: false, error: e?.message ?? 'Erreur SMTP inconnue' };
  }
}

export async function testSmtp(smtp: SmtpConfig): Promise<{ ok: boolean; error?: string }> {
  if (!smtp.host || !smtp.user) {
    return { ok: false, error: 'host et user requis' };
  }
  try {
    const transporter = createTransport(smtp);
    await transporter.verify();
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Erreur SMTP' };
  }
}

function createTransport(smtp: SmtpConfig): Transporter {
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port || 587,
    secure: smtp.secure,
    auth: smtp.user ? { user: smtp.user, pass: smtp.password } : undefined,
  });
}

function emailHtml(eventName?: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0e1f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#faf6ef">
  <div style="max-width:560px;margin:0 auto;padding:48px 24px;text-align:center">
    <h1 style="font-family:Georgia,serif;font-style:italic;font-weight:400;font-size:42px;background:linear-gradient(135deg,#e8c79a,#d4a574);-webkit-background-clip:text;background-clip:text;color:transparent;margin:0 0 12px">
      Votre photo
    </h1>
    <p style="color:rgba(250,246,239,.7);font-size:16px;line-height:1.6;margin:0 0 24px">
      ${eventName ? `Souvenir de <strong>${escapeHtml(eventName)}</strong>` : 'Voici votre photo souvenir'}
    </p>
    <p style="color:rgba(250,246,239,.5);font-size:14px;line-height:1.6;margin:0">
      La photo est jointe à cet email.
    </p>
  </div>
</body></html>`;
}

function videoEmailHtml(shareUrl: string, eventName?: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0e1f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#faf6ef">
  <div style="max-width:560px;margin:0 auto;padding:48px 24px;text-align:center">
    <h1 style="font-family:Georgia,serif;font-style:italic;font-weight:400;font-size:42px;background:linear-gradient(135deg,#e8c79a,#d4a574);-webkit-background-clip:text;background-clip:text;color:transparent;margin:0 0 12px">
      Votre vidéo
    </h1>
    <p style="color:rgba(250,246,239,.7);font-size:16px;line-height:1.6;margin:0 0 24px">
      ${eventName ? `Souvenir de <strong>${escapeHtml(eventName)}</strong>` : 'Voici votre message vidéo'}
    </p>
    <p style="margin:32px 0">
      <a href="${shareUrl}" style="display:inline-block;padding:16px 32px;border-radius:999px;background:linear-gradient(135deg,#ff8e72,#e26b4f);color:#fff;text-decoration:none;font-weight:600">
        Voir la vidéo
      </a>
    </p>
    <p style="color:rgba(250,246,239,.5);font-size:13px;line-height:1.6;margin:0">
      Lien valable 24 heures. Pensez à télécharger la vidéo pour la conserver.
    </p>
  </div>
</body></html>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
