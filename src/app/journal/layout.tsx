import type { ReactNode } from "react";

export default function JournalLayout({ children }: { children: ReactNode }) {
  return <div className="journal-site">{children}</div>;
}
