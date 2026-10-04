"use client";
import { startTransition, useState } from "react";
import type { ArticleRelationOption } from "@/types/domain/article-relations";
import { searchArticleRelations } from "@/server/actions/article-relations.actions";
export function PublicationScientistSelect({ options: initialOptions, initialId = "" }: { options: ArticleRelationOption[]; initialId?: string }) {
  const [options, setOptions] = useState(initialOptions);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(initialId);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return <div><label>Поиск учёного RU / KK<input maxLength={120} value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); }} /></label>
    <button className="secondary-button" type="button" disabled={pending} onClick={() => {
      setPending(true); setError("");
      startTransition(async () => {
        const result = await searchArticleRelations("scientist", query);
        setPending(false);
        if (!result.ok) { setError(result.error); return; }
        setOptions(previous => [...result.options, ...previous.filter(item => item.entityId === selected && !result.options.some(found => found.entityId === item.entityId))]);
      });
    }}>{pending ? "Загрузка…" : "Найти учёного"}</button>
    {error ? <p role="alert">{error}</p> : null}
    <label>Учёный<select name="scientistId" required value={selected} onChange={event => setSelected(event.target.value)}><option value="">Выберите учёного</option>
      {selected && !options.some(item => item.entityId === selected) ? <option value={selected}>Текущий учёный недоступен — замените выбор</option> : null}
      {options.map(item => <option key={item.entityId} value={item.entityId}>{item.titleRu} / {item.titleKk}</option>)}
    </select></label>
    {options.length >= 50 ? <p className="field-hint">Уточните название, чтобы найти учёного за пределами первых 50 результатов.</p> : null}
  </div>;
}
