import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Search, ShieldCheck, UsersRound } from "lucide-react";
import { SubmitButton } from "@/components/science/SubmitButton";
import { accessFiltersSchema } from "@/lib/validation/access-management";
import { updateRolePermissions, updateUserRoles } from "@/server/actions/access-management.actions";
import { getAdminAccess } from "@/server/services/access.service";
import {
  AccessManagementService,
  canChangeAccessManagement,
  canViewAccessManagement,
} from "@/server/services/access-management.service";

type Props = {
  searchParams: Promise<{ q?: string; page?: string; error?: string; saved?: string }>;
};

const dates = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Qyzylorda",
});
const criticalPermissions = new Set(["roles.manage", "settings.manage", "media.purge"]);
const errors: Record<string, string> = {
  validation: "Проверьте выбранные роли или права и повторите сохранение.",
  forbidden: "Текущих прав недостаточно для этого изменения.",
  not_found: "Пользователь или роль больше не существует. Обновите страницу.",
  invalid_roles: "Набор ролей недействителен. Базовая роль пользователя обязательна.",
  invalid_permissions: "Набор прав недействителен. Системные права доступны только super_admin.",
  last_super_admin: "Нельзя снять роль у последнего super_admin. Сначала назначьте второго.",
  protected_role: "Права системных ролей user, admin и super_admin зафиксированы.",
};

export default async function AccessManagementPage({ searchParams }: Props) {
  const params = await searchParams;
  const parsed = accessFiltersSchema.safeParse({ query: params.q, page: params.page });
  if (!parsed.success) notFound();
  const result = await getAdminAccess();
  if (result.state === "unauthenticated") redirect("/admin/login");
  if (result.state !== "allowed" || !canViewAccessManagement(result.access)) notFound();
  const mayChange = canChangeAccessManagement(result.access);
  const filters = parsed.data;
  const catalog = await new AccessManagementService().list(result.access, filters);
  const pageUrl = (page: number) => `/admin/system/access?${new URLSearchParams({ q: filters.query, page: String(page) })}`;
  const pageCount = Math.max(1, Math.ceil(catalog.total / catalog.pageSize));

  return (
    <div className="content-page access-management-page">
      <nav className="breadcrumbs" aria-label="Хлебные крошки"><span>Система</span><span>/</span><strong>Пользователи и роли</strong></nav>
      <div className="page-heading"><div><p className="page-kicker">RBAC</p><h1>Пользователи и доступы</h1>
        <p>Администраторы видят каталог пользователей. Назначать роли и изменять права может только super_admin.</p></div>
        <span className="foundation-badge"><ShieldCheck aria-hidden="true" /> Super admin: {catalog.superAdminCount}</span>
      </div>
      {params.saved === "roles" ? <div className="notice success-notice">Роли пользователя сохранены и записаны в аудит.</div> : null}
      {params.saved === "permissions" ? <div className="notice success-notice">Права роли сохранены и записаны в аудит.</div> : null}
      {params.error ? <div className="notice error-notice" role="alert">{errors[params.error] ?? "Не удалось сохранить изменения. Обновите страницу и повторите попытку."}</div> : null}
      {!mayChange ? <div className="notice">Доступ только для просмотра. Для изменений требуется отдельное право <code>roles.manage</code>.</div> : null}

      <section className="media-toolbar" aria-label="Поиск пользователей">
        <form className="media-filters" action="/admin/system/access">
          <label className="search-field"><Search aria-hidden="true" /><span className="visually-hidden">Имя или email</span>
            <input type="search" name="q" defaultValue={filters.query} maxLength={120} placeholder="Имя или email" /></label>
          <button className="secondary-button" type="submit">Найти</button>
        </form>
      </section>

      <section className="data-panel" aria-label="Пользователи и назначенные роли">
        <div className="data-panel-header"><div><h2>Пользователи</h2><p>{catalog.total} записей · до 30 на странице</p></div></div>
        {catalog.users.length ? <div className="table-wrap"><table className="articles-table access-users-table">
          <thead><tr><th>Пользователь</th><th>Создан</th><th>Роли</th></tr></thead>
          <tbody>{catalog.users.map(user => {
            const isLastSuper = catalog.superAdminCount === 1 && user.roles.includes("super_admin");
            return <tr key={user.id}><td><strong>{user.displayName || "Без имени"}</strong><small>{user.email || "Email отсутствует"}</small>
              <small>{user.id === result.access.userId ? "Текущий аккаунт" : `ID ${user.id.slice(0, 8)}`}</small></td>
              <td><time dateTime={user.createdAt}>{dates.format(new Date(user.createdAt))}</time></td>
              <td>{mayChange ? <form className="role-assignment-form" action={updateUserRoles}>
                <input type="hidden" name="userId" value={user.id} /><input type="hidden" name="roles" value="user" />
                <input type="hidden" name="query" value={filters.query} /><input type="hidden" name="page" value={filters.page} />
                <fieldset><legend className="visually-hidden">Роли пользователя {user.displayName || user.email || user.id}</legend>
                  <label title="Базовая роль обязательна"><input type="checkbox" checked disabled />Пользователь</label>
                  {catalog.roles.filter(role => role.code !== "user").map(role => {
                    const locked = role.code === "super_admin" && isLastSuper;
                    return <label key={role.code} title={locked ? "Последний super_admin защищён" : role.name}>
                      <input type="checkbox" name={locked ? undefined : "roles"} value={role.code} defaultChecked={user.roles.includes(role.code)} disabled={locked} />{role.name}
                      {locked ? <input type="hidden" name="roles" value="super_admin" /> : null}
                    </label>;
                  })}
                </fieldset><SubmitButton label="Сохранить роли" pendingLabel="Сохранение…" />
              </form> : <div className="access-badges">{user.roles.map(code => <span className="status-badge" key={code}>{catalog.roles.find(role => role.code === code)?.name ?? code}</span>)}</div>}</td>
            </tr>;
          })}</tbody>
        </table></div> : <div className="empty-state"><span className="empty-icon"><UsersRound aria-hidden="true" /></span><h3>Пользователи не найдены</h3><p>Измените поисковый запрос.</p></div>}
      </section>
      <nav className="heading-actions access-pagination" aria-label="Страницы пользователей">
        {filters.page > 1 ? <Link className="secondary-button" href={pageUrl(filters.page - 1)}>Предыдущая страница</Link> : null}
        <span>Страница {filters.page} из {pageCount}</span>
        {filters.page < pageCount ? <Link className="secondary-button" href={pageUrl(filters.page + 1)}>Следующая страница</Link> : null}
      </nav>

      <section className="access-permissions-section" aria-labelledby="role-permissions-title">
        <div className="page-heading access-section-heading"><div><p className="page-kicker">Permissions</p><h2 id="role-permissions-title">Права ролей</h2>
          <p>Системные роли зафиксированы: user не даёт полномочий, admin получает операционные права, super_admin — все права.</p></div></div>
        <div className="access-role-grid">{catalog.roles.map(role => {
          const editable = mayChange && !role.protected;
          const available = catalog.permissions.filter(permission => !criticalPermissions.has(permission.code));
          return <article className="access-role-card" key={role.code}>
            <header><div><h3>{role.name}</h3><code>{role.code}</code></div><span>{role.permissions.length} прав</span></header>
            {editable ? <form action={updateRolePermissions}>
              <input type="hidden" name="role" value={role.code} /><input type="hidden" name="query" value={filters.query} /><input type="hidden" name="page" value={filters.page} />
              <fieldset className="permission-checklist"><legend className="visually-hidden">Права роли {role.name}</legend>
                {available.map(permission => <label key={permission.code}><input type="checkbox" name="permissions" value={permission.code} defaultChecked={role.permissions.includes(permission.code)} />
                  <span>{permission.name}<code>{permission.code}</code></span></label>)}
              </fieldset><SubmitButton label="Сохранить права" pendingLabel="Сохранение…" />
            </form> : <div className="access-permission-summary">{role.permissions.length ? role.permissions.map(code => <code key={code}>{code}</code>) : <span>Нет разрешений</span>}</div>}
            {role.protected ? <p className="access-role-note">Системная роль: набор прав изменяется только миграциями.</p> : null}
          </article>;
        })}</div>
      </section>
    </div>
  );
}
