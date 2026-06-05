"use client";
import PdfToolPage from "@/components/dashboard/ferramentas-pdf/pdf-tool-page";

function Icone() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#9333ea"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      <path d="M20 3v4" />
      <path d="M22 5h-4" />
      <path d="M4 17v2" />
      <path d="M5 18H3" />
    </svg>
  );
}

function InfoIA() {
  return (
    <div
      style={{
        borderRadius: 12,
        background: "rgba(243,232,255,0.4)",
        border: "1px solid rgba(192,132,252,0.3)",
        padding: "12px 16px",
        fontSize: 13,
        color: "#6b21a8",
      }}
    >
      🤖 A IA analisa o conteúdo de cada página e divide o PDF por tipo de
      documento (ex: certidão, contrato, petição, procuração). Cada tipo vira um
      arquivo separado no ZIP.
    </div>
  );
}

export default function DividirIaPage() {
  return (
    <PdfToolPage
      titulo="Dividir por tipo de documento"
      descricao="Divide o PDF por tipo de documento usando Inteligência Artificial"
      icone={<Icone />}
      badge="IA"
      extraFields={<InfoIA />}
      endpoint="/api/pdf/dividir"
      buildFormData={(files) => {
        const fd = new FormData();
        fd.append("file", files[0]);
        fd.append("modo", "individual");
        return fd;
      }}
    />
  );
}
