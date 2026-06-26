import { Resend } from "resend";

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

export async function enviarEmailResetSenha({
  para,
  resetUrl,
}: {
  para: string;
  resetUrl: string;
}) {
  const resend = getResend();
  if (!resend) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[reset-senha] RESEND_API_KEY não configurada.");
      console.warn("[reset-senha] Link de redefinição:", resetUrl);
    } else {
      console.warn(
        "[reset-senha] RESEND_API_KEY não configurada — e-mail não enviado."
      );
    }
    return;
  }

  await resend.emails.send({
    from: "LiderAdv <onboarding@resend.dev>",
    to: para,
    subject: "[LiderAdv] Redefinição de senha",
    html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <tr>
          <td style="background:linear-gradient(135deg,#000D25,#001848,#003080);padding:28px 32px;border-radius:14px 14px 0 0;">
            <p style="margin:0;color:#8FBEFF;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">Sistema Jurídico</p>
            <h1 style="margin:6px 0 0 0;color:#ffffff;font-size:22px;font-weight:700;">🔐 Redefinição de senha</h1>
          </td>
        </tr>

        <tr>
          <td style="background:#ffffff;padding:28px 32px;border:1px solid #e2e8f0;border-top:none;">
            <p style="margin:0 0 16px 0;color:#334155;font-size:15px;line-height:1.6;">
              Recebemos uma solicitação para redefinir a senha da sua conta <strong>${para}</strong>.
            </p>
            <p style="margin:0 0 24px 0;color:#334155;font-size:14px;line-height:1.6;">
              Clique no botão abaixo para criar uma nova senha. O link é válido por <strong>1 hora</strong>.
            </p>

            <div style="text-align:center;margin:28px 0;">
              <a href="${resetUrl}"
                 style="display:inline-block;background:#005DFF;color:#ffffff;padding:14px 32px;border-radius:50px;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.02em;">
                Redefinir minha senha →
              </a>
            </div>

            <p style="margin:24px 0 0 0;color:#94a3b8;font-size:12px;line-height:1.6;">
              Se você não solicitou a redefinição, ignore este e-mail. Sua senha permanece a mesma.<br>
              O link expira automaticamente em 1 hora.
            </p>
          </td>
        </tr>

        <tr>
          <td style="background:#f8fafc;padding:14px 32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 14px 14px;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:11px;">LiderAdv — Sistema Jurídico &nbsp;|&nbsp; Notificação automática</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
    text: `[LiderAdv] Redefinição de senha\n\nClique no link abaixo para redefinir sua senha (válido por 1 hora):\n${resetUrl}\n\nSe não solicitou, ignore este e-mail.`,
  });
}

export async function notificarEmailRecebido({
  para,
  cliente,
  clienteId,
  de,
  deNome,
  assunto,
  resumoIA,
  corpo,
}: {
  para: string;
  cliente: string;
  clienteId: string;
  de: string;
  deNome: string | null;
  assunto: string | null;
  resumoIA: string | null;
  corpo: string | null;
}) {
  const resend = getResend();
  if (!resend) {
    console.warn(
      "[email] RESEND_API_KEY não configurada — notificação ignorada."
    );
    return;
  }

  const remetente = deNome ? `${deNome} &lt;${de}&gt;` : de;
  const assuntoEmail = assunto ?? "(sem assunto)";
  const textoCorpo = corpo ? corpo.slice(0, 1200) : null;

  await resend.emails.send({
    from: "LiderAdv <onboarding@resend.dev>",
    to: para,
    subject: `[LiderAdv] Novo e-mail de ${cliente} — ${assuntoEmail}`,
    html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#000D25,#001848,#003080);padding:28px 32px;border-radius:14px 14px 0 0;">
            <p style="margin:0;color:#8FBEFF;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">Sistema Jurídico</p>
            <h1 style="margin:6px 0 0 0;color:#ffffff;font-size:22px;font-weight:700;">📬 Novo e-mail recebido</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:28px 32px;border:1px solid #e2e8f0;border-top:none;">

            <!-- Info table -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;border-collapse:collapse;">
              <tr>
                <td style="padding:7px 0;color:#64748b;font-size:12px;font-weight:600;width:80px;vertical-align:top;">CLIENTE</td>
                <td style="padding:7px 0;font-weight:700;color:#0f172a;font-size:14px;">${cliente}</td>
              </tr>
              <tr>
                <td style="padding:7px 0;color:#64748b;font-size:12px;font-weight:600;vertical-align:top;">DE</td>
                <td style="padding:7px 0;color:#334155;font-size:13px;">${remetente}</td>
              </tr>
              <tr>
                <td style="padding:7px 0;color:#64748b;font-size:12px;font-weight:600;vertical-align:top;">ASSUNTO</td>
                <td style="padding:7px 0;font-weight:600;color:#0f172a;font-size:14px;">${assuntoEmail}</td>
              </tr>
            </table>

            ${
              resumoIA
                ? `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px 18px;margin-bottom:20px;">
                     <p style="margin:0 0 6px 0;font-size:11px;font-weight:700;color:#1d4ed8;letter-spacing:0.08em;text-transform:uppercase;">✨ Resumo gerado por IA</p>
                     <p style="margin:0;color:#1e3a5f;font-size:14px;line-height:1.65;">${resumoIA}</p>
                   </div>`
                : ""
            }

            ${
              textoCorpo
                ? `<div style="border-top:1px solid #e2e8f0;padding-top:18px;">
                     <p style="margin:0 0 10px 0;font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:0.08em;text-transform:uppercase;">Mensagem original</p>
                     <div style="color:#374151;font-size:13px;line-height:1.7;white-space:pre-wrap;">${textoCorpo.replace(/</g, "&lt;").replace(/>/g, "&gt;")}${corpo!.length > 1200 ? "\n\n[mensagem truncada — veja completa no sistema]" : ""}</div>
                   </div>`
                : ""
            }

            <!-- CTA -->
            <div style="margin-top:26px;text-align:center;">
              <a href="https://lideradv.vercel.app/dashboard/clientes/${clienteId}"
                 style="display:inline-block;background:#005DFF;color:#ffffff;padding:13px 28px;border-radius:50px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.02em;">
                Ver na ficha do cliente →
              </a>
            </div>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:14px 32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 14px 14px;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:11px;">LiderAdv — Sistema Jurídico &nbsp;|&nbsp; Notificação automática</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
    text: `[LiderAdv] Novo e-mail de ${cliente}\n\nDe: ${deNome ? `${deNome} <${de}>` : de}\nAssunto: ${assuntoEmail}\n${resumoIA ? `\nResumo (IA):\n${resumoIA}\n` : ""}${textoCorpo ? `\nMensagem:\n${textoCorpo}` : ""}\n\nVer no sistema: https://lideradv.vercel.app/dashboard/clientes/${clienteId}`,
  });
}
