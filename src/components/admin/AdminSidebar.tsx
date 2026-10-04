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
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type AdminNavigationSection = {
  label: string;
  items: Array<{ label: string; icon: LucideIcon; href?: string }>;
};

const navigation: AdminNavigationSection[] = [
  {
    label: "Контент",
    items: [
      { label: "Статьи", href: "/admin/content/articles", icon: BookOpenText },
      { label: "Медиа", href: "/admin/content/media", icon: Images },
    ],
  },
  {
    label: "Наука",
    items: [
      { label: "Ученые", href: "/admin/science/scientists", icon: UsersRound },
      { label: "Организации", icon: Building2 },
      { label: "Исследования", href: "/admin/science/research", icon: FlaskConical },
      { label: "Проекты", href: "/admin/science/projects", icon: LayoutGrid },
      { label: "Научные публикации", href: "/admin/science/publications", icon: BookOpenText },
    ],
  },
  {
    label: "Программы",
    items: [
      { label: "Наставничество", href: "/admin/programs/mentorship", icon: HandHeart },
      { label: "Research Program", href: "/admin/programs/research-program", icon: Sparkles },
      { label: "События", href: "/admin/programs/events", icon: CalendarDays },
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
