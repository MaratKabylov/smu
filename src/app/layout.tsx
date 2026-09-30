import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "СМУ — Совет молодых ученых",
    template: "%s · СМУ",
  },
  description:
    "Цифровая платформа научного сообщества Актюбинской области.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
