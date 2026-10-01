import type { ReactNode } from "react";

export default function ScientistsLayout({ children }: { children: ReactNode }) {
  return <div className="journal-site scientists-site">{children}</div>;
}
