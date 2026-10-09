"use client";
import { startTransition, useState } from "react";
import { searchArticleRelations } from "@/server/actions/article-relations.actions";
import type { ArticleRelationOption } from "@/types/domain/article-relations";
import type { PublicationCoauthor } from "@/types/domain/publication";

export function PublicationRelationsEditor({ coauthors: initialAuthors = [], workIds: initialWorkIds = [], scientists: initialScientists, works: initialWorks }: {
  coauthors?: PublicationCoauthor[]; workIds?: string[]; scientists: ArticleRelationOption[]; works: ArticleRelationOption[];
}) {
  const [authors, setAuthors] = useState(initialAuthors);
  const [workIds, setWorkIds] = useState(initialWorkIds);
  const [scientists, setScientists] = useState(initialScientists);
  const [works, setWorks] = useState(initialWorks);
  const [scientistQuery, setScientistQuery] = useState("");
  const [workQuery, setWorkQuery] = useState("");
  const [scientistId, setScientistId] = useState("");
  const [workId, setWorkId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const search = (target: "scientist" | "work") => {
    setPending(true); setError("");
    startTransition(async () => {
      try {
        if (target === "scientist") {
          const result = await searchArticleRelations("scientist", scientistQuery);
          if (!result.ok) { setError(result.error); return; }
          setScientists(previous => [...result.options, ...previous.filter(item => authors.some(a => a.scientistId === item.entityId) && !result.options.some(found => found.entityId === item.entityId))]);
        } else {
          const research = await searchArticleRelations("research", workQuery);
          const projects = await searchArticleRelations("project", workQuery);
          if (!research.ok || !projects.ok) { setError("Не удалось загрузить научные работы."); return; }
          const options = [...research.options, ...projects.options];
          setWorks(previous => [...options, ...previous.filter(item => workIds.includes(item.entityId) && !options.some(found => found.entityId === item.entityId))]);
        }
      } catch { setError("Не удалось выполнить поиск. Повторите попытку."); }
      finally { setPending(false); }
    });
  };
  const move = (index: number, offset: number) => setAuthors(previous => {
    const next = [...previous];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    return next;
  });
  return <section className="article-editor-panel"><h2>Соавторы и научные работы</h2>
    <p className="field-hint">Основной учёный указывается первым. Добавьте остальных авторов в библиографическом порядке. Внешние имена и организации будут опубликованы вместе с записью.</p>
    <input type="hidden" name="coauthors" value={JSON.stringify(authors)} />
    {error ? <p role="alert" className="notice error-notice">{error}</p> : null}
    <label>Поиск соавтора RU / KK<input value={scientistQuery} maxLength={120} onChange={e => setScientistQuery(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); search("scientist"); } }} /></label>
    <button type="button" className="secondary-button" disabled={pending} onClick={() => search("scientist")}>Найти соавтора</button>
    <label>Профиль соавтора<select value={scientistId} onChange={e => setScientistId(e.target.value)}><option value="">Выберите учёного</option>{scientists.filter(s => !authors.some(a => a.scientistId === s.entityId)).map(s => <option key={s.entityId} value={s.entityId}>{s.titleRu} / {s.titleKk}</option>)}</select></label>
    <div className="preview-links"><button type="button" className="secondary-button" disabled={!scientistId || authors.length >= 30} onClick={() => { setAuthors([...authors, { scientistId, name: "", affiliation: "" }]); setScientistId(""); }}>Добавить соавтора</button>
      <button type="button" className="secondary-button" disabled={authors.length >= 30} onClick={() => setAuthors([...authors, { scientistId: null, name: "", affiliation: "" }])}>Добавить внешнего автора</button></div>
    <ol className="relation-options">{authors.map((author, index) => <li key={index}>
      {author.scientistId ? <span>{scientists.find(s => s.entityId === author.scientistId)?.titleRu ?? "Профиль недоступен — удалите или замените связь"}</span> : <div className="form-two-columns"><label>Имя внешнего автора<input required minLength={2} maxLength={240} value={author.name} onChange={e => setAuthors(authors.map((a, i) => i === index ? { ...a, name: e.target.value } : a))} /></label><label>Организация внешнего автора<input maxLength={240} value={author.affiliation} onChange={e => setAuthors(authors.map((a, i) => i === index ? { ...a, affiliation: e.target.value } : a))} /></label></div>}
      <div className="preview-links"><button type="button" disabled={index === 0} aria-label={"Переместить автора " + (index + 1) + " выше"} onClick={() => move(index, -1)}>Выше</button><button type="button" disabled={index === authors.length - 1} aria-label={"Переместить автора " + (index + 1) + " ниже"} onClick={() => move(index, 1)}>Ниже</button><button type="button" aria-label={"Удалить автора " + (index + 1)} onClick={() => setAuthors(authors.filter((_, i) => i !== index))}>Удалить</button></div>
    </li>)}</ol>
    <label>Поиск исследования или проекта RU / KK<input value={workQuery} maxLength={120} onChange={e => setWorkQuery(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); search("work"); } }} /></label>
    <button type="button" className="secondary-button" disabled={pending} onClick={() => search("work")}>Найти научную работу</button>
    <label>Исследование / проект<select value={workId} onChange={e => setWorkId(e.target.value)}><option value="">Выберите научную работу</option>{works.filter(w => !workIds.includes(w.entityId)).map(w => <option key={w.entityId} value={w.entityId}>{w.kind === "project" ? "Проект" : "Исследование"}: {w.titleRu} / {w.titleKk}</option>)}</select></label>
    <button type="button" className="secondary-button" disabled={!workId || workIds.length >= 20} onClick={() => { setWorkIds([...workIds, workId]); setWorkId(""); }}>Связать работу</button>
    <ul className="relation-options">{workIds.map(id => <li key={id}><input type="hidden" name="workIds" value={id} /><span>{works.find(w => w.entityId === id)?.titleRu ?? "Работа недоступна — удалите или замените связь"}</span><button type="button" onClick={() => setWorkIds(workIds.filter(value => value !== id))}>Убрать связь</button></li>)}</ul>
    <p className="field-hint">Доступны проверенные публичные профили и опубликованные научные работы. Уточните запрос для поиска за пределами первых 50 результатов каждого типа.</p>
  </section>;
}
