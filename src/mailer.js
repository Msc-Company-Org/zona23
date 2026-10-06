// Envio de e-mail opcional, por API HTTP (formato Resend), sem dependência nova.
// Sem MAIL_API_KEY e MAIL_FROM, o link por e-mail fica desligado e a equipe envia pelo WhatsApp.
export function mailerFromEnv(env = process.env) {
  if (!env.MAIL_API_KEY || !env.MAIL_FROM) return null;
  const endpoint = env.MAIL_API_URL || "https://api.resend.com/emails";
  return {
    async send({ to, subject, text }) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.MAIL_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, text }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error(`provedor de e-mail respondeu ${response.status}`);
    },
  };
}
