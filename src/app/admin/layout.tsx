import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: {
    default: "СМУ — Совет молодых ученых",
    template: "%s · СМУ",
  },
  description:
    "Цифровая платформа научного сообщества Актюбинской области.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
