import type { Metadata, Viewport } from "next";
import { Inter, Bebas_Neue } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const bebasNeue = Bebas_Neue({
  variable: "--font-bebas",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GARBINBET",
  description:
    "Aposte no placar dos jogos do Brasil na Copa do Mundo.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GARBINBET",
  },
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
  openGraph: {
    title: "GARBINBET",
    description: "Aposte no placar dos jogos do Brasil na Copa do Mundo.",
    siteName: "GARBINBET",
    images: ["/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "GARBINBET",
    description: "Aposte no placar dos jogos do Brasil na Copa do Mundo.",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0F",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${bebasNeue.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster
          theme="dark"
          richColors
          position="top-center"
          toastOptions={{
            style: {
              background: "#16161F",
              border: "1px solid #2A2A3A",
              color: "#F0F0F0",
            },
          }}
        />
      </body>
    </html>
  );
}
