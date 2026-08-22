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
      <rect width="14" height="11" x="5" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  );
}

export default function RemoverSenhaPage() {
  return (
    <PdfToolPage
      titulo="Remover senha de PDFs"
      descricao="Remove a proteção de PDFs sem senha de abertura (ex.: bloqueados só contra edição). PDFs que pedem senha para abrir não são suportados."
      icone={<Icone />}
      endpoint="/api/pdf/remover-senha"
      buildFormData={(files) => {
        const fd = new FormData();
        fd.append("file", files[0]);
        return fd;
      }}
    />
  );
}
