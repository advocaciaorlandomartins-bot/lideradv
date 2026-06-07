"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Ferramenta {
  id: string;
  titulo: string;
  descricao: string;
  href: string;
  icone: React.ReactNode;
  badge: string | null;
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────

function IconMinimize2() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: "#9333ea" }}
      aria-hidden="true"
    >
      <path d="m14 10 7-7" />
      <path d="M20 10h-6V4" />
      <path d="m3 21 7-7" />
      <path d="M4 14h6v6" />
    </svg>
  );
}

function IconScissors() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: "#9333ea" }}
      aria-hidden="true"
    >
      <circle cx="6" cy="6" r="3" />
      <path d="M8.12 8.12 12 12" />
      <path d="M20 4 8.12 15.88" />
      <circle cx="6" cy="18" r="3" />
      <path d="M14.8 14.8 20 20" />
    </svg>
  );
}

function IconImage() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: "#9333ea" }}
      aria-hidden="true"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  );
}

function IconLayers() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: "#9333ea" }}
      aria-hidden="true"
    >
      <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" />
      <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" />
      <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" />
    </svg>
  );
}

function IconLockOpen() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: "#9333ea" }}
      aria-hidden="true"
    >
      <rect width="14" height="11" x="5" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: "#9333ea" }}
      aria-hidden="true"
    >
      <rect width="14" height="11" x="5" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function IconSparkles() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: "#9333ea" }}
      aria-hidden="true"
    >
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      <path d="M20 3v4" />
      <path d="M22 5h-4" />
      <path d="M4 17v2" />
      <path d="M5 18H3" />
    </svg>
  );
}

function IconPdfToImage() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: "#9333ea" }}
      aria-hidden="true"
    >
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <circle cx="10" cy="14" r="2" />
      <path d="m20 17-1.296-1.296a2 2 0 0 0-2.828 0L10 22" />
    </svg>
  );
}

// ── Dados das ferramentas ─────────────────────────────────────────────────────

const FERRAMENTAS: Ferramenta[] = [
  {
    id: "comprimir",
    titulo: "Comprimir PDFs",
    descricao: "Comprima PDFs com até 90% de redução",
    href: "/dashboard/ferramentas-pdf/comprimir",
    icone: <IconMinimize2 />,
    badge: null,
  },
  {
    id: "dividir",
    titulo: "Dividir PDFs",
    descricao: "Divida PDFs por tamanho ou número de páginas",
    href: "/dashboard/ferramentas-pdf/dividir",
    icone: <IconScissors />,
    badge: null,
  },
  {
    id: "imagens",
    titulo: "Converter imagens em PDFs",
    descricao: "Converta imagens (JPG, PNG, etc) em PDFs",
    href: "/dashboard/ferramentas-pdf/imagens",
    icone: <IconImage />,
    badge: null,
  },
  {
    id: "juntar",
    titulo: "Juntar PDFs",
    descricao: "Junte vários PDFs em um único arquivo",
    href: "/dashboard/ferramentas-pdf/juntar",
    icone: <IconLayers />,
    badge: null,
  },
  {
    id: "remover-senha",
    titulo: "Remover senha de PDFs",
    descricao: "Remova a senha de PDFs protegidos",
    href: "/dashboard/ferramentas-pdf/remover-senha",
    icone: <IconLockOpen />,
    badge: null,
  },
  {
    id: "proteger",
    titulo: "Proteger PDFs",
    descricao: "Adicione senha e restrições aos seus PDFs",
    href: "/dashboard/ferramentas-pdf/proteger",
    icone: <IconLock />,
    badge: null,
  },
  {
    id: "dividir-ia",
    titulo: "Dividir por tipo de documento",
    descricao:
      "Divide o PDF por tipo de documento com Inteligência Artificial (ProIA)",
    href: "/dashboard/ferramentas-pdf/dividir-ia",
    icone: <IconSparkles />,
    badge: "IA",
  },
  {
    id: "pdf-para-imagens",
    titulo: "Converter PDF em imagens",
    descricao: "Converta páginas de PDF em imagens (JPG, PNG, etc)",
    href: "/dashboard/ferramentas-pdf/pdf-para-imagens",
    icone: <IconPdfToImage />,
    badge: null,
  },
];

// ── Icon box ──────────────────────────────────────────────────────────────────

const iconBoxStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  background:
    "linear-gradient(to bottom right, #faf5ff, #fff, rgba(243,232,255,0.7))",
  border: "1px solid rgba(192,132,252,0.35)",
  boxShadow:
    "inset 0 0 0 1px rgba(255,255,255,0.6), 0 1px 3px rgba(0,0,0,0.08)",
  transition: "transform 0.3s ease",
};

// ── Badge IA ──────────────────────────────────────────────────────────────────

const badgeStyle: React.CSSProperties = {
  position: "absolute",
  top: -12,
  right: 16,
  display: "inline-flex",
  alignItems: "center",
  whiteSpace: "nowrap",
  borderRadius: 9999,
  background:
    "linear-gradient(to bottom right, #faf5ff, #fff, rgba(243,232,255,0.7))",
  border: "1px solid rgba(192,132,252,0.35)",
  boxShadow:
    "inset 0 0 0 1px rgba(255,255,255,0.6), 0 1px 3px rgba(167,139,250,0.25)",
  gap: 4,
  padding: "2px 8px",
  fontSize: 11,
  fontWeight: 500,
  color: "#7c3aed",
};

// ── Card ──────────────────────────────────────────────────────────────────────

function Card({ f, delay }: { f: Ferramenta; delay: number }) {
  const [hovered, setHovered] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  const cardStyle: React.CSSProperties = {
    display: "block",
    padding: 20,
    borderRadius: 16,
    background: hovered ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.7)",
    border: hovered
      ? "1px solid rgba(167,139,250,0.35)"
      : "1px solid rgba(232,228,223,0.7)",
    boxShadow: hovered
      ? "0 4px 20px rgba(167,139,250,0.12), 0 1px 4px rgba(0,0,0,0.04)"
      : "rgba(0,0,0,0.02) 0px 1px 3px 0px",
    textDecoration: "none",
    color: "inherit",
    transition:
      "all 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.5s ease, transform 0.5s cubic-bezier(0.16,1,0.3,1)",
    position: "relative",
    cursor: "pointer",
    transform: hovered
      ? "translateY(-1px)"
      : visible
        ? "translateY(0)"
        : "translateY(12px)",
    opacity: visible ? 1 : 0,
  };

  return (
    <Link
      href={f.href}
      style={cardStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {f.badge && <span style={badgeStyle}>{f.badge}</span>}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
          <div
            style={{
              ...iconBoxStyle,
              transform: hovered ? "scale(1.05)" : "scale(1)",
            }}
          >
            {f.icone}
          </div>
          <div>
            <h2
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "#2d2d2d",
                margin: "0 0 4px 0",
              }}
            >
              {f.titulo}
            </h2>
            <p
              style={{
                fontSize: 13,
                color: "#666",
                margin: 0,
                lineHeight: 1.45,
              }}
            >
              {f.descricao}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FerramentasPdfContent() {
  const [search, setSearch] = useState("");
  const [headerVisible, setHeaderVisible] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setHeaderVisible(true), 0);
    const t2 = setTimeout(() => setSearchVisible(true), 60);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const filtradas = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return FERRAMENTAS;
    return FERRAMENTAS.filter(
      (f) =>
        f.titulo.toLowerCase().includes(q) ||
        f.descricao.toLowerCase().includes(q)
    );
  }, [search]);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      {/* Breadcrumb */}
      <nav style={{ fontSize: 13, color: "#666", marginBottom: 24 }}>
        <Link
          href="/dashboard"
          style={{ color: "#666", textDecoration: "none" }}
        >
          Início
        </Link>
        <span style={{ margin: "0 6px" }}>/</span>
        <span style={{ color: "#2d2d2d" }}>Ferramentas de PDFs</span>
      </nav>

      {/* Header */}
      <header
        style={{
          marginBottom: 32,
          opacity: headerVisible ? 1 : 0,
          transform: headerVisible ? "translateY(0)" : "translateY(12px)",
          transition:
            "opacity 0.5s ease, transform 0.5s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ ...iconBoxStyle, width: 40, height: 40 }}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: "#9333ea" }}
              aria-hidden="true"
            >
              <path d="M11 21a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1" />
              <path d="M16 16a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1" />
              <path d="M21 6a2 2 0 0 0-.586-1.414l-2-2A2 2 0 0 0 17 2h-3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1z" />
            </svg>
          </div>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: "#2d2d2d",
              lineHeight: 1.08,
              margin: 0,
            }}
          >
            Ferramentas de PDFs
          </h1>
        </div>
      </header>

      {/* Search */}
      <div
        style={{
          marginBottom: 32,
          opacity: searchVisible ? 1 : 0,
          transform: searchVisible ? "translateY(0)" : "translateY(12px)",
          transition:
            "opacity 0.5s ease, transform 0.5s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <div style={{ position: "relative", width: "100%", maxWidth: 576 }}>
          <svg
            style={{
              position: "absolute",
              left: 14,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#666",
              pointerEvents: "none",
            }}
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquise a opção desejada"
            style={{
              width: "100%",
              padding: "10px 10px 10px 40px",
              fontSize: 14,
              border: "1px solid #e8e4df",
              borderRadius: 12,
              background: "rgba(255,255,255,0.75)",
              color: "#2d2d2d",
              outline: "none",
              boxSizing: "border-box",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "#a78bfa";
              e.currentTarget.style.boxShadow =
                "0 0 0 3px rgba(167,139,250,0.15)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "#e8e4df";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
        </div>
      </div>

      {/* Grid */}
      {filtradas.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "48px 0",
            color: "#666",
            fontSize: 14,
          }}
        >
          Nenhuma ferramenta encontrada para &ldquo;{search}&rdquo;.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 16,
          }}
        >
          {filtradas.map((f, i) => (
            <Card key={f.id} f={f} delay={120 + i * 60} />
          ))}
        </div>
      )}
    </div>
  );
}
