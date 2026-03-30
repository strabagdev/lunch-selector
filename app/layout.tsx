import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaProvider } from "./pwa-provider";

export const metadata: Metadata = {
  applicationName: "Registro de almuerzo",
  title: {
    default: "Registro de almuerzo",
    template: "%s | Registro de almuerzo",
  },
  description: "MVP para seleccionar almuerzos diarios por persona.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Registro de almuerzo",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <PwaProvider />
        {children}
      </body>
    </html>
  );
}
