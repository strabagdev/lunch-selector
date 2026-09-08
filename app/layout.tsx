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
    statusBarStyle: "black-translucent",
    title: "Registro de almuerzo",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#07090d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full overflow-hidden antialiased">
      <body className="flex h-dvh min-h-dvh flex-col overflow-hidden">
        <PwaProvider />
        {children}
      </body>
    </html>
  );
}
