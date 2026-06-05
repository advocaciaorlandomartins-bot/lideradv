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
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  );
}

export default function ImagensPage() {
  return (
    <PdfToolPage
      titulo="Converter imagens em PDFs"
      descricao="Converta imagens JPG e PNG em um único PDF"
      icone={<Icone />}
      multiplos
      accept=".jpg,.jpeg,.png"
      endpoint="/api/pdf/imagens"
      buildFormData={(files) => {
        const fd = new FormData();
        files.forEach((f) => fd.append("files", f));
        return fd;
      }}
    />
  );
}
