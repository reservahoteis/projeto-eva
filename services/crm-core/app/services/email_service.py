"""EmailService — envio de emails transacionais via SMTP.

Usa apenas bibliotecas nativas do Python (smtplib, email.mime, ssl, asyncio).
Nenhuma dependência externa é necessária.

Uso:
    from app.services.email_service import email_service

    await email_service.send_welcome_email(
        to_email="admin@hotel.com",
        tenant_name="Hotel Copacabana",
        admin_name="João Silva",
        login_url="https://hoteisreserva.com.br/login",
        temp_password="SenhaTemporaria123!",
    )

Se SMTP não estiver configurado (SMTP_HOST vazio), o serviço loga um aviso
e retorna False — nunca levanta exceção para não bloquear a criação do tenant.
"""

from __future__ import annotations

import asyncio
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import structlog

logger = structlog.get_logger()


class EmailService:
    """Serviço de envio de emails via SMTP com suporte a STARTTLS."""

    def __init__(self) -> None:
        # Lazy-load de settings para evitar circular import no nível de módulo
        from app.core.config import settings

        self.smtp_host: str = settings.SMTP_HOST
        self.smtp_port: int = settings.SMTP_PORT
        self.smtp_user: str = settings.SMTP_USER
        self.smtp_password: str = settings.SMTP_PASSWORD
        self.from_email: str = settings.SMTP_FROM_EMAIL
        self.from_name: str = settings.SMTP_FROM_NAME
        self.frontend_url: str = settings.FRONTEND_URL
        # Habilitado apenas quando host e usuário estiverem configurados
        self.enabled: bool = bool(self.smtp_host and self.smtp_user)

    # ------------------------------------------------------------------
    # Métodos públicos
    # ------------------------------------------------------------------

    async def send_welcome_email(
        self,
        to_email: str,
        tenant_name: str,
        admin_name: str,
        login_url: str,
        temp_password: str,
    ) -> bool:
        """Envia email de boas-vindas com credenciais para o novo admin do tenant.

        Retorna True se enviado com sucesso, False caso contrário.
        Nunca levanta exceção — falha de email não deve bloquear criação do tenant.
        """
        if not self.enabled:
            logger.warning(
                "email_service_disabled",
                reason="SMTP_HOST ou SMTP_USER não configurados",
                to_email=to_email,
            )
            return False

        subject = f"Bem-vindo ao Smart Hotéis — {tenant_name}"
        html = self._render_welcome_template(
            tenant_name=tenant_name,
            admin_name=admin_name,
            login_email=to_email,
            login_url=login_url,
            temp_password=temp_password,
        )
        return await self._send(to_email, subject, html)

    # ------------------------------------------------------------------
    # Métodos internos
    # ------------------------------------------------------------------

    async def _send(self, to: str, subject: str, html: str) -> bool:
        """Envia email de forma assíncrona rodando o SMTP em thread separada."""
        try:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, self._send_sync, to, subject, html)
            logger.info("email_sent", to=to, subject=subject)
            return True
        except Exception as exc:
            logger.error("email_send_failed", to=to, subject=subject, error=str(exc))
            return False

    def _send_sync(self, to: str, subject: str, html: str) -> None:
        """Envio SMTP síncrono com STARTTLS (roda em executor thread)."""
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{self.from_name} <{self.from_email}>"
        msg["To"] = to

        msg.attach(MIMEText(html, "html", "utf-8"))

        context = ssl.create_default_context()
        with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=30) as server:
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()
            server.login(self.smtp_user, self.smtp_password)
            server.sendmail(self.from_email, to, msg.as_string())

    def _render_welcome_template(
        self,
        tenant_name: str,
        admin_name: str,
        login_email: str,
        login_url: str,
        temp_password: str,
    ) -> str:
        """Renderiza o template HTML do email de boas-vindas.

        Template inline responsivo, compatível com Gmail, Outlook e Apple Mail.
        Cores: primária #2563eb (azul), fundo #f8fafc.
        """
        onboarding_url = f"{self.frontend_url}/crm/onboarding"

        return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Bem-vindo ao Smart Hotéis</title>
  <!--[if mso]>
  <noscript>
    <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  </noscript>
  <![endif]-->
  <style>
    body, table, td, a {{ -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }}
    table, td {{ mso-table-lspace: 0pt; mso-table-rspace: 0pt; }}
    img {{ -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }}
    body {{ margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }}
    .email-wrapper {{ width: 100%; background-color: #f8fafc; padding: 32px 16px; box-sizing: border-box; }}
    .email-container {{ max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.07); }}
    .header {{ background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #3b82f6 100%); padding: 40px 40px 32px; text-align: center; }}
    .header-logo {{ font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; margin: 0 0 4px; }}
    .header-tagline {{ font-size: 13px; color: rgba(255,255,255,0.8); margin: 0; letter-spacing: 0.5px; text-transform: uppercase; }}
    .content {{ padding: 40px; }}
    .greeting {{ font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 12px; }}
    .intro {{ font-size: 15px; color: #475569; line-height: 1.7; margin: 0 0 28px; }}
    .credentials-box {{ background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #2563eb; border-radius: 8px; padding: 24px; margin: 0 0 28px; }}
    .credentials-title {{ font-size: 13px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px; margin: 0 0 16px; }}
    .credential-row {{ display: flex; margin-bottom: 14px; align-items: flex-start; }}
    .credential-row:last-child {{ margin-bottom: 0; }}
    .credential-label {{ font-size: 13px; color: #64748b; font-weight: 600; min-width: 120px; padding-top: 2px; }}
    .credential-value {{ font-size: 14px; color: #0f172a; font-family: 'Courier New', Courier, monospace; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 4px; padding: 4px 10px; word-break: break-all; }}
    .credential-value.password {{ color: #dc2626; font-weight: 700; }}
    .warning-box {{ background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px 20px; margin: 0 0 28px; display: flex; gap: 12px; }}
    .warning-icon {{ font-size: 18px; line-height: 1; flex-shrink: 0; }}
    .warning-text {{ font-size: 14px; color: #92400e; line-height: 1.6; }}
    .warning-text strong {{ color: #78350f; }}
    .cta-section {{ text-align: center; margin: 0 0 32px; }}
    .cta-button {{ display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; padding: 14px 32px; border-radius: 8px; letter-spacing: 0.2px; }}
    .cta-button:hover {{ background-color: #1d4ed8; }}
    .divider {{ border: none; border-top: 1px solid #e2e8f0; margin: 0 0 28px; }}
    .steps-title {{ font-size: 15px; font-weight: 700; color: #0f172a; margin: 0 0 16px; }}
    .step {{ display: flex; gap: 12px; margin-bottom: 12px; align-items: flex-start; }}
    .step-number {{ background-color: #2563eb; color: #ffffff; font-size: 12px; font-weight: 700; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; text-align: center; line-height: 22px; }}
    .step-text {{ font-size: 14px; color: #475569; line-height: 1.6; padding-top: 2px; }}
    .footer {{ background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 28px 40px; text-align: center; }}
    .footer-text {{ font-size: 13px; color: #94a3b8; line-height: 1.6; margin: 0 0 8px; }}
    .footer-link {{ color: #2563eb; text-decoration: none; }}
    .footer-company {{ font-size: 12px; color: #cbd5e1; margin: 0; }}
    @media only screen and (max-width: 600px) {{
      .content {{ padding: 24px 20px; }}
      .header {{ padding: 28px 20px 24px; }}
      .footer {{ padding: 24px 20px; }}
      .credential-row {{ flex-direction: column; gap: 4px; }}
      .credential-label {{ min-width: auto; }}
    }}
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">

      <!-- Cabeçalho -->
      <div class="header">
        <p class="header-logo">Smart Hotéis</p>
        <p class="header-tagline">Plataforma de CRM para Hotelaria</p>
      </div>

      <!-- Conteúdo principal -->
      <div class="content">

        <p class="greeting">Olá, {admin_name}!</p>
        <p class="intro">
          O hotel <strong>{tenant_name}</strong> foi cadastrado com sucesso na plataforma Smart Hotéis.
          Abaixo estão suas credenciais de acesso para o primeiro login. Guarde-as em local seguro.
        </p>

        <!-- Box de credenciais -->
        <div class="credentials-box">
          <p class="credentials-title">Suas Credenciais de Acesso</p>

          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding-bottom:14px;">
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="font-size:13px;color:#64748b;font-weight:600;width:130px;vertical-align:top;padding-top:6px;">
                      URL de Login
                    </td>
                    <td style="font-size:14px;color:#2563eb;font-family:'Courier New',Courier,monospace;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:4px;padding:4px 10px;word-break:break-all;">
                      <a href="{login_url}" style="color:#2563eb;text-decoration:none;">{login_url}</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:14px;">
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="font-size:13px;color:#64748b;font-weight:600;width:130px;vertical-align:top;padding-top:6px;">
                      Email
                    </td>
                    <td style="font-size:14px;color:#0f172a;font-family:'Courier New',Courier,monospace;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:4px;padding:4px 10px;">
                      {login_email}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td>
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="font-size:13px;color:#64748b;font-weight:600;width:130px;vertical-align:top;padding-top:6px;">
                      Senha Temporária
                    </td>
                    <td style="font-size:14px;color:#dc2626;font-weight:700;font-family:'Courier New',Courier,monospace;background-color:#ffffff;border:1px solid #fca5a5;border-radius:4px;padding:4px 10px;letter-spacing:1px;">
                      {temp_password}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </div>

        <!-- Aviso de segurança -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
          <tr>
            <td style="background-color:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px 20px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:top;padding-right:12px;font-size:18px;line-height:1;">
                    ⚠️
                  </td>
                  <td style="font-size:14px;color:#92400e;line-height:1.6;">
                    <strong style="color:#78350f;">Importante:</strong> Esta é uma senha temporária.
                    Por segurança, você deverá criar uma nova senha no primeiro acesso.
                    Não compartilhe esta senha com ninguém.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Botão CTA -->
        <div class="cta-section">
          <a href="{login_url}" class="cta-button"
             style="display:inline-block;background-color:#2563eb;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 32px;border-radius:8px;letter-spacing:0.2px;">
            Acessar a Plataforma
          </a>
        </div>

        <hr class="divider" style="border:none;border-top:1px solid #e2e8f0;margin:0 0 28px;" />

        <!-- Próximos passos -->
        <p class="steps-title">Próximos passos após o primeiro acesso</p>

        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding-bottom:12px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:top;padding-right:12px;">
                    <div style="background-color:#2563eb;color:#ffffff;font-size:12px;font-weight:700;width:22px;height:22px;border-radius:50%;text-align:center;line-height:22px;display:inline-block;">
                      1
                    </div>
                  </td>
                  <td style="font-size:14px;color:#475569;line-height:1.6;padding-top:2px;">
                    Faça login e <strong>redefina sua senha</strong> para uma de sua escolha
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:12px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:top;padding-right:12px;">
                    <div style="background-color:#2563eb;color:#ffffff;font-size:12px;font-weight:700;width:22px;height:22px;border-radius:50%;text-align:center;line-height:22px;display:inline-block;">
                      2
                    </div>
                  </td>
                  <td style="font-size:14px;color:#475569;line-height:1.6;padding-top:2px;">
                    Complete o <a href="{onboarding_url}" style="color:#2563eb;text-decoration:none;font-weight:600;">onboarding do hotel</a> para configurar o sistema
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td>
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:top;padding-right:12px;">
                    <div style="background-color:#2563eb;color:#ffffff;font-size:12px;font-weight:700;width:22px;height:22px;border-radius:50%;text-align:center;line-height:22px;display:inline-block;">
                      3
                    </div>
                  </td>
                  <td style="font-size:14px;color:#475569;line-height:1.6;padding-top:2px;">
                    Configure seu canal do WhatsApp para começar a atender hóspedes
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

      </div><!-- /content -->

      <!-- Rodapé -->
      <div class="footer">
        <p class="footer-text">
          Precisa de ajuda? Entre em contato com o suporte:
          <a href="mailto:suporte@botreserva.com.br" class="footer-link">suporte@botreserva.com.br</a>
        </p>
        <p class="footer-company">&copy; 2025 Smart Hotéis — Todos os direitos reservados.</p>
      </div>

    </div>
  </div>
</body>
</html>"""


# ---------------------------------------------------------------------------
# Singleton — importar e usar diretamente nos serviços
# ---------------------------------------------------------------------------

email_service = EmailService()
