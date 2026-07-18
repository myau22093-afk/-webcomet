import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "WebComet — создай сайт за 5 минут",
  description:
    "AI-платформа для генерации сайтов, изображений и чата. Премиальный дизайн за минуты.",
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "any" }],
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
        <link rel="icon" href="/favicon.ico?v=11" sizes="any" />
      </head>
      <body className="flex min-h-full flex-col font-sans text-foreground">
        {children}
        <Toaster position="top-center" richColors theme="dark" />
      </body>
    </html>
  );
}
