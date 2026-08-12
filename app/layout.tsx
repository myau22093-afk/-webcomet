import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "WebComet.ru — создай сайт за 5 минут",
  description:
    "AI-платформа WebComet.ru для генерации сайтов, изображений и чата. Премиальный дизайн за минуты.",
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
    <html lang="ru" className="h-full antialiased">
      <head>
        <link rel="icon" href="/favicon.ico?v=14" sizes="any" />
        <link rel="icon" href="/favicon-32.png?v=14" type="image/png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=14" />
      </head>
      <body className="flex min-h-full flex-col font-sans text-foreground">
        {children}
        <Toaster position="top-center" richColors theme="dark" />
      </body>
    </html>
  );
}
