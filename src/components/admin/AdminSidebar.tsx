"use client";

import {
  BookOpenText,
  Building2,
  CalendarDays,
  ChevronRight,
  CircleUserRound,
  FlaskConical,
  HandHeart,
  Images,
  LayoutGrid,
  Settings,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  {
    label: "Контент",
    items: [
      { label: "Статьи", href: "/admin/content/articles", icon: BookOpenText },
      { label: "Медиа", icon: Images },
    ],
  },
  {
    label: "Наука",
    items: [
      { label: "Ученые", icon: UsersRound },
      { label: "Организации", icon: Building2 },
      { label: "Исследования", icon: FlaskConical },
      { label: "Проекты", icon: LayoutGrid },
    ],
  },
  {
    label: "Программы",
    items: [
      { label: "Наставничество", icon: HandHeart },
      { label: "Research Program", icon: Sparkles },
      { label: "События", icon: CalendarDays },
    ],
  },
  {
    label: "Система",
    items: [
      { label: "Пользователи и роли", icon: CircleUserRound },
      { label: "Audit log", icon: ShieldCheck },
      { label: "Настройки", icon: Settings },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="admin-sidebar">
      <div className="admin-brand">
        <span className="admin-brand-mark">СМУ</span>
        <span>
          <strong>SMU Admin</strong>
          <small>Научная платформа</small>
        </span>
      </div>

      <nav className="admin-nav" aria-label="Административная навигация">
        {navigation.map((section) => (
          <section key={section.label} className="admin-nav-section">
            <h2>{section.label}</h2>
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = item.href ? pathname.startsWith(item.href) : false;

              if (!item.href) {
                return (
                  <span className="admin-nav-item is-disabled" key={item.label}>
                    <Icon aria-hidden="true" />
                    <span>{item.label}</span>
                    <small>скоро</small>
                  </span>
                );
              }

              return (
                <Link
                  className={`admin-nav-item${active ? " is-active" : ""}`}
                  href={item.href}
                  key={item.label}
                >
                  <Icon aria-hidden="true" />
                  <span>{item.label}</span>
                  <ChevronRight aria-hidden="true" className="nav-chevron" />
                </Link>
              );
            })}
          </section>
        ))}
      </nav>
    </aside>
  );
}
