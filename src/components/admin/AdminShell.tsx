import type { ReactNode } from "react";
import Link from "next/link";
import { Bell, ExternalLink, LogOut, Search } from "lucide-react";
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
          <div className="admin-topbar-navigation">
            <span className="admin-environment">
              <span className="environment-dot" aria-hidden="true" />
              <span>Рабочая среда</span>
            </span>
            <Link className="admin-topbar-link" href="/admin/search">
              <Search aria-hidden="true" />
              <span>Поиск</span>
            </Link>
            <Link className="admin-topbar-link" href="/ru">
              <ExternalLink aria-hidden="true" />
              <span>На сайт</span>
            </Link>
          </div>
          <div className="admin-account">
            <Link className="icon-button" href="/ru/account/notifications" aria-label="Уведомления"><Bell aria-hidden="true" /></Link>
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
