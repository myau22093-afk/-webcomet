import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { YandexMetrika } from "@/components/YandexMetrika";
import { AnalyticsRoot } from "@/components/analytics/AnalyticsRoot";
import { SessionKeepAlive } from "@/components/SessionKeepAlive";
import "./globals.css";

const SITE_URL = "https://webcomet.ru";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "WebComet.ru — создай сайт за 5 минут",
    template: "%s — WebComet.ru",
  },
  description:
    "AI-платформа WebComet.ru для генерации сайтов, изображений и чата. Премиальный дизайн за минуты.",
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: SITE_URL,
    siteName: "WebComet.ru",
    title: "WebComet.ru — создай сайт за 5 минут",
    description:
      "AI-платформа WebComet.ru для генерации сайтов, изображений и чата. Премиальный дизайн за минуты.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: "/favicon.ico?v=14", sizes: "any" },
      { url: "/favicon-32.png?v=14", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/apple-touch-icon.png?v=14", sizes: "180x180" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="overflow-x-clip antialiased">
      <head>
        <link rel="icon" href="/favicon.ico?v=14" sizes="any" />
        <link rel="icon" href="/favicon-32.png?v=14" type="image/png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=14" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Outfit:wght@500;600;700;800&family=Syne:wght@600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap"
        />
      </head>
      <body className="flex min-h-dvh flex-col font-sans text-foreground">
        <YandexMetrika />
        <AnalyticsRoot />
        <SessionKeepAlive />
        {children}
        <Toaster position="top-center" richColors theme="dark" />
      </body>
    </html>
  );
}
