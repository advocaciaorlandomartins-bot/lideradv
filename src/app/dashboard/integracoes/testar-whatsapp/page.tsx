"use client";

import { useState } from "react";

const MODELOS = [
  {
    label: "Lembrete honorário — 10 dias",
    tipo: "honorario_10d",
    mensagem: `Olá! Passando pra lembrar que seu honorário no valor de *R$ 1.500,00* vence em *19/07/2026* (faltam 10 dias).\n\nSe já realizou o pagamento, pode desconsiderar esta mensagem. Qualquer dúvida, pode falar com o escritório! 😊`,
  },
  {
    label: "Lembrete honorário — 5 dias",
    tipo: "honorario_5d",
    mensagem: `Oi! Sua cobrança de honorários de *R$ 1.500,00* vence em *19/07/2026* — faltam apenas 5 dias.\n\nSe ainda não realizou o pagamento, é uma boa hora pra se organizar. Caso já tenha pago, desconsidere esta mensagem. Obrigado! 🙏`,
  },
  {
    label: "Lembrete honorário — dia do vencimento",
    tipo: "honorario_vence_hoje",
    mensagem: `Oi! Hoje é o dia do vencimento do seu honorário de *R$ 1.500,00*.\n\nPor favor, realize o pagamento para evitar pendências. Se já pagou, desconsidere esta mensagem — e muito obrigado pela pontualidade! 🙏`,
  },
  {
    label: "Confirmação de pagamento (conta quitada)",
    tipo: "honorario_pago_quitado",
    mensagem: `✅ Confirmamos o recebimento do seu pagamento de *R$ 1.500,00* em 09/07/2026.\n\nSua conta está totalmente quitada! Muito obrigado pela confiança e pontualidade! 🎉`,
  },
  {
    label: "Confirmação de pagamento (saldo restante)",
    tipo: "honorario_pago_saldo",
    mensagem: `✅ Confirmamos o recebimento do seu pagamento de *R$ 500,00* em 09/07/2026.\n\nSeu saldo restante é de *R$ 1.000,00*. Em breve você receberá os próximos lembretes de vencimento. Qualquer dúvida, estamos à disposição! 😊`,
  },
  {
    label: "Lembrete INSS — 15 dias antes",
    tipo: "inss_15d",
    mensagem: `Oi! 👋 Aqui é do escritório. Passando pra avisar que sua Avaliação Social BPC/LOAS está marcada para segunda-feira, dia 19/10/2026 às 09:00, no APS Maceió Centro.\n\nFaltam 15 dias — já é uma boa hora pra ir se organizando com documentos e transporte. Se precisar de ajuda ou tiver dúvidas, é só chamar. Estamos contigo! 😊`,
  },
  {
    label: "Lembrete INSS — 2 dias antes",
    tipo: "inss_2d",
    mensagem: `Oi! Sua Avaliação Social BPC/LOAS é daqui a 2 dias — segunda-feira, 19/10/2026 às 09:00.\n\n📍 Local: APS Maceió Centro\n\nAproveite para confirmar como vai chegar lá e já deixar os documentos separadinhos. Se precisar de algo, é só falar com a gente!`,
  },
  {
    label: "Lembrete INSS — 1 dia antes (manhã)",
    tipo: "inss_1d_manha",
    mensagem: `Bom dia! 🌅 Amanhã é o grande dia! Sua Avaliação Social BPC/LOAS está marcada para:\n\n📅 19/10/2026 (segunda-feira)\n⏰ 09:00\n📍 APS Maceió Centro\n\nLembre de chegar 15 minutos antes e trazer RG, CPF e qualquer documentação médica ou social. Boa sorte — estamos torcendo por você! 🍀`,
  },
];

export default function TestarWhatsAppPage() {
  const [telefone, setTelefone] = useState("82988010729");
  const [mensagem, setMensagem] = useState(MODELOS[0].mensagem);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{
    ok?: boolean;
    error?: string;
  } | null>(null);

  async function enviar() {
    setEnviando(true);
    setResultado(null);
    try {
      const res = await fetch("/api/admin/testar-lembrete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telefone: telefone.replace(/\D/g, ""),
          mensagem,
        }),
      });
      const data = await res.json();
      setResultado(data);
    } catch (e) {
      setResultado({ error: String(e) });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-slate-900">
          Testar Mensagens WhatsApp
        </h1>
        <p className="font-body text-sm text-muted">
          Envia uma mensagem de teste pelo PrevBot para validar a integração.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <label className="mb-1.5 block font-body text-sm font-medium text-slate-700">
            Telefone destino
          </label>
          <input
            type="tel"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="82988010729"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 font-body text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div>
          <label className="mb-1.5 block font-body text-sm font-medium text-slate-700">
            Modelo de mensagem
          </label>
          <select
            onChange={(e) =>
              setMensagem(MODELOS[Number(e.target.value)].mensagem)
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-body text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {MODELOS.map((m, i) => (
              <option key={m.tipo} value={i}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block font-body text-sm font-medium text-slate-700">
            Mensagem
          </label>
          <textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            rows={8}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 font-body text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <button
          onClick={enviar}
          disabled={enviando || !telefone || !mensagem}
          className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-body text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {enviando ? (
            <>
              <svg
                className="h-4 w-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Enviando...
            </>
          ) : (
            <>
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
              Enviar via WhatsApp
            </>
          )}
        </button>

        {resultado && (
          <div
            className={`rounded-lg p-3 font-body text-sm ${resultado.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
          >
            {resultado.ok
              ? "✅ Mensagem enviada com sucesso!"
              : `❌ Erro: ${resultado.error}`}
          </div>
        )}
      </div>
    </div>
  );
}
