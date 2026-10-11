import { ResearchOutputService } from "@/server/services/research-output.service";
import { researchOutputLabels } from "@/types/domain/research-output";
import type { ArticleLocale } from "@/types/domain/article";
export async function PublicResearchOutputs({ workId, locale }: { workId: string; locale: ArticleLocale }) {
  const outputs = await new ResearchOutputService().publicByWork(locale, workId);
  if (!outputs.length) return null;
  const text = {
    ru: { title: "Научные результаты", version: "Версия", license: "Условия использования", download: "Скачать", external: "Открыть результат" },
    kk: { title: "Ғылыми нәтижелер", version: "Нұсқа", license: "Пайдалану шарттары", download: "Жүктеп алу", external: "Нәтижені ашу" },
    en: { title: "Research outputs", version: "Version", license: "Terms of use", download: "Download", external: "Open output" },
  }[locale];
  return <section className="science-work-body"><h2>{text.title}</h2>{outputs.map(o => <article key={o.id}>
    <small>{researchOutputLabels[locale][o.kind]} · {text.version} {o.versionLabel}</small><h3>{o.title}</h3>
    {o.description.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}<p>{text.license}: {o.license}</p>
    {o.externalUrl ? <p><a href={o.externalUrl} rel="noreferrer" target="_blank">{text.external}</a></p> : null}
    <ul>{o.files.map(f => <li key={f.id}><a href={`/api/results/${o.id}/files/${f.id}?version=${o.version}`}>{text.download}: {f.name}</a> ({Math.ceil(f.size / 1024)} KB)</li>)}</ul>
  </article>)}</section>;
}
