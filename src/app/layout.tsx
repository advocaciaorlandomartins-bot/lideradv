import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";
import ServiceWorkerRegister from "@/components/pwa/ServiceWorkerRegister";
import OfflineBanner from "@/components/pwa/OfflineBanner";

const garamond = Plus_Jakarta_Sans({
  variable: "--font-garamond",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const lato = Inter({
  variable: "--font-lato",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "LiderAdv — Sistema de Gestão Jurídica",
  description:
    "Gestão completa para advogados: clientes, processos, perícias, controle financeiro e busca automática de processos por OAB.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LiderAdv",
  },
  icons: {
    apple: "/logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1d4ed8",
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
      <body className="h-full antialiased">
        {/* Aplica tema antes da hidratação para evitar flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('lideradv-theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}`,
          }}
        />
        <OfflineBanner />
        <ServiceWorkerRegister />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
