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
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function ExtraFields() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 600,
            color: "#555",
            marginBottom: 6,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Nova senha *
        </label>
        <input
          name="senha"
          type="password"
          required
          placeholder="Crie uma senha para o PDF"
          style={{
            width: "100%",
            height: 40,
            borderRadius: 10,
            border: "1px solid #e8e4df",
            background: "white",
            padding: "0 12px",
            fontSize: 14,
            color: "#2d2d2d",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>
      <p style={{ fontSize: 12, color: "#666", margin: 0 }}>
        O PDF será protegido com impressão em baixa resolução, sem edição, sem
        cópia de texto.
      </p>
    </div>
  );
}

export default function ProtegerPage() {
  return (
    <PdfToolPage
      titulo="Proteger PDFs"
      descricao="Adicione senha e restrições de uso ao seu PDF"
      icone={<Icone />}
      extraFields={<ExtraFields />}
      endpoint="/api/pdf/proteger"
      buildFormData={(files, extras) => {
        const fd = new FormData();
        fd.append("file", files[0]);
        fd.append("senha", extras.senha || "");
        return fd;
      }}
    />
  );
}
