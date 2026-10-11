import Link from "next/link";
import { ResearchProgramProjectsService } from "@/server/services/research-program-projects.service";
import { PublicResearchOutputs } from "@/components/science/PublicResearchOutputs";
import type { ScientistLocale } from "@/types/domain/scientist";
export async function PublicProgramProjects({ programId, locale }: { programId: string; locale: ScientistLocale }) {
  const projects = await new ResearchProgramProjectsService().publicByProgram(programId, locale);
  if (!projects.length) return null;
  const title = { ru: "Проекты программы", kk: "Бағдарлама жобалары", en: "Program projects" }[locale];
  const members = { ru: "Команда проекта", kk: "Жоба командасы", en: "Project team" }[locale];
  return <section><h2>{title}</h2>{projects.map(p => <article key={p.id}>
    <h3><Link href={`/${locale}/projects/${p.slug}`}>{p.title}</Link></h3>
    {p.members.length ? <><h4>{members}</h4><ul>{p.members.map(s => <li key={s.id}><Link href={`/${locale}/scientists/${s.slug}`}>{s.name}</Link></li>)}</ul></> : null}
    <PublicResearchOutputs workId={p.id} locale={locale} />
  </article>)}</section>;
}
export async function ProjectPrograms({ workId, locale }: { workId: string; locale: ScientistLocale }) {
  const programs = await new ResearchProgramProjectsService().publicByProject(workId, locale);
  if (!programs.length) return null;
  return <section className="science-work-body"><h2>{locale === "kk" ? "Зерттеу бағдарламалары" : "Research Program"}</h2>
    <ul>{programs.map(p => <li key={p.id}><Link href={`/${locale}/research-program/${p.slug}`}>{p.title}</Link></li>)}</ul>
  </section>;
}
