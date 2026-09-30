import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { SetupRequired } from "@/components/admin/SetupRequired";
import { getAdminAccess } from "@/server/services/access.service";

export default async function AdminPanelLayout({
  children,
}: {
  children: ReactNode;
}) {
  const result = await getAdminAccess();

  if (result.state === "setup") return <SetupRequired />;
  if (result.state === "unauthenticated") redirect("/admin/login");

  if (result.state === "forbidden") {
    return (
      <main className="centered-state">
        <p className="state-code">403</p>
        <h1>Недостаточно прав</h1>
        <p>Для входа в SMU Admin требуется разрешение admin.access.</p>
      </main>
    );
  }

  return <AdminShell email={result.email}>{children}</AdminShell>;
}
