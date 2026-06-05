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
      <circle cx="6" cy="6" r="3" />
      <path d="M8.12 8.12 12 12" />
      <path d="M20 4 8.12 15.88" />
      <circle cx="6" cy="18" r="3" />
      <path d="M14.8 14.8 20 20" />
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
          Modo de divisão
        </label>
        <select
          name="modo"
          defaultValue="paginas"
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
          }}
        >
          <option value="paginas">Por intervalo de páginas</option>
          <option value="individual">Uma página por arquivo</option>
        </select>
      </div>
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
          Páginas (ex: 1-3, 5, 7-9)
        </label>
        <input
          name="paginas"
          type="text"
          placeholder="Deixe em branco para extrair todas"
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
    </div>
  );
}

export default function DividirPage() {
  return (
    <PdfToolPage
      titulo="Dividir PDFs"
      descricao="Divida PDFs por intervalo de páginas ou uma por arquivo"
      icone={<Icone />}
      extraFields={<ExtraFields />}
      endpoint="/api/pdf/dividir"
      buildFormData={(files, extras) => {
        const fd = new FormData();
        fd.append("file", files[0]);
        fd.append("modo", extras.modo || "paginas");
        fd.append("paginas", extras.paginas || "");
        return fd;
      }}
    />
  );
}
