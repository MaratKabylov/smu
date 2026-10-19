import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteContentForm } from "./SiteContentForm";
import { contentLabels, pageKeys } from "@/lib/validation/site-content";
import { saveSiteContent } from "@/server/actions/site-content.actions";
import { getAdminAccess } from "@/server/services/access.service";
import { canManageSiteContent, SiteContentService } from "@/server/services/site-content.service";

export async function SiteContentAdmin({ mode, selected }: { mode: "pages" | "homepage" | "settings"; selected?: string }) {
  const access = await getAdminAccess();
  if (access.state === "unauthenticated") redirect("/admin/login");
  if (access.state !== "allowed" || !canManageSiteContent(access.access, mode === "settings")) notFound();
  if (selected && !pageKeys.some(key => key === selected)) notFound();
  const catalog = await new SiteContentService().list(access.access);
  const page = catalog.pages.find(p => p.key === (selected ?? "about"));
  return <div className="site-content-admin">
    <header className="page-heading"><div><p className="page-kicker">Управление платформой</p><h1>{mode === "pages" ? "Информационные страницы" : mode === "homepage" ? "Блоки главной страницы" : "Настройки сайта"}</h1>
      <p>{mode === "pages" ? "Фиксированные шаблоны и переводы RU/KK/EN." : mode === "homepage" ? "Включение, порядок, заголовки и количество элементов в разделах сайта." : "Название сайта, контактный адрес и социальные ссылки видны посетителям информационных страниц."}</p></div></header>
    {mode === "pages" ? <>
      <nav className="content-page-tabs" aria-label="Информационные страницы">{catalog.pages.map(p => <Link key={p.key} href={`/admin/content/pages?key=${p.key}`} aria-current={p.key === page?.key ? "page" : undefined}>{contentLabels[p.key]} · {p.status === "published" ? "Опубликовано" : "Черновик"}</Link>)}</nav>
      {page ? <section><h2>{contentLabels[page.key]}</h2><div className="heading-actions">{page.status === "published" && page.translations.map(t => <Link key={t.locale} href={`/${t.locale}/pages/${page.key}`} target="_blank">Открыть {t.locale.toUpperCase()}</Link>)}</div>
        <SiteContentForm key={page.key} kind="page" record={page} action={saveSiteContent} /></section> : null}
    </> : mode === "homepage" ? catalog.sections.map(section => <section className="article-editor-panel content-slot" key={section.key}>
      <h2>{contentLabels[section.key]}</h2><SiteContentForm kind="section" record={section} action={saveSiteContent} />
    </section>) : catalog.settings.map(setting => <section className="article-editor-panel content-slot" key={setting.key}>
      <h2>{contentLabels[setting.key]}</h2><SiteContentForm kind="setting" record={setting} action={saveSiteContent} />
    </section>)}
  </div>;
}
