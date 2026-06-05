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
      <path d="m14 10 7-7" />
      <path d="M20 10h-6V4" />
      <path d="m3 21 7-7" />
      <path d="M4 14h6v6" />
    </svg>
  );
}

export default function ComprimirPage() {
  return (
    <PdfToolPage
      titulo="Comprimir PDFs"
      descricao="Comprima PDFs com até 90% de redução de tamanho"
      icone={<Icone />}
      endpoint="/api/pdf/comprimir"
      buildFormData={(files) => {
        const fd = new FormData();
        fd.append("file", files[0]);
        return fd;
      }}
    />
  );
}
