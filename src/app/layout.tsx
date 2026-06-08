import type { Metadata } from "next";
import { EB_Garamond, Lato } from "next/font/google";
import "./globals.css";

const garamond = EB_Garamond({
  variable: "--font-garamond",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const lato = Lato({
  variable: "--font-lato",
  subsets: ["latin"],
  weight: ["300", "400", "700"],
});

export const metadata: Metadata = {
  title: "LiderAdv — Sistema de Gestão Jurídica",
  description:
    "Gestão completa para advogados: clientes, processos, perícias, controle financeiro e busca automática de processos por OAB.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${garamond.variable} ${lato.variable} h-full`}
    >
      <body className="h-full antialiased">{children}</body>
    </html>
  );
}
