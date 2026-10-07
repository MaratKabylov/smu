import type { ReactNode } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { logout } from "@/server/actions/auth.actions";

type AdminShellProps = {
  children: ReactNode;
  email: string | null;
};

export function AdminShell({ children, email }: AdminShellProps) {
  return (
    <div className="admin-shell">
      <AdminSidebar />
      <div className="admin-workspace">
        <header className="admin-topbar">
          <div>
            <span className="environment-dot" aria-hidden="true" />
            <span>Рабочая среда</span>
            <Link href="/admin/search">Поиск</Link>
          </div>
          <div className="admin-account">
            <span>{email ?? "Пользователь СМУ"}</span>
            <form action={logout}>
              <button className="icon-button" type="submit" aria-label="Выйти">
                <LogOut aria-hidden="true" />
              </button>
            </form>
          </div>
        </header>
        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}
