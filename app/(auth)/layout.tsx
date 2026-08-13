import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Вход и регистрация",
  robots: { index: false, follow: true },
  alternates: { canonical: "https://webcomet.ru/" },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
