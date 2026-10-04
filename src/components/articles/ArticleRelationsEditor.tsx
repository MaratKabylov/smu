"use client";
import { startTransition, useEffect, useRef, useState } from "react";
import { searchArticleRelations } from "@/server/actions/article-relations.actions";
import { articleRelationKinds, articleRelationTypes, relationKindLabels, relationTypeLabels, type ArticleRelationKind, type ArticleRelationLink, type ArticleRelationOption } from "@/types/domain/article-relations";

export function ArticleRelationsEditor({ value, disabled, onChange }: {
  value: ArticleRelationLink[]; disabled: boolean; onChange: (links: ArticleRelationLink[]) => void;
}) {
  const [kind, setKind] = useState<ArticleRelationKind>("scientist");
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<ArticleRelationOption[]>([]);
  const [known, setKnown] = useState<Record<string, ArticleRelationOption>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);
  const initial = useRef(value);
  useEffect(() => {
    let active = true;
    // Resolve current selections independently of the first search page.
    startTransition(async () => {
      for (const currentKind of articleRelationKinds) {
        const ids = initial.current.filter(link => link.kind === currentKind).map(link => link.entityId);
        if (!ids.length) continue;
        const result = await searchArticleRelations(currentKind, "", ids);
        if (active && result.ok) setKnown(previous => ({ ...previous, ...Object.fromEntries(result.options.map(item => [`${item.kind}:${item.entityId}`, item])) }));
      }
    });
    return () => { active = false; };
  }, []);
  const search = () => {
    const request = ++generation.current;
    setLoading(true); setError("");
    startTransition(async () => {
      const result = await searchArticleRelations(kind, query);
      if (request !== generation.current) return;
      setLoading(false);
      if (!result.ok) { setError(result.error); return; }
      setOptions(result.options);
      setKnown(previous => ({ ...previous, ...Object.fromEntries(result.options.map(item => [`${item.kind}:${item.entityId}`, item])) }));
    });
  };
  return <fieldset className="article-editor-panel" disabled={disabled}>
    <legend>Связанные научные объекты · до 50</legend>
    <input type="hidden" name="relations" value={JSON.stringify(value)} />
    <p className="field-hint">Выберите опубликованные объекты. Роль связи описывает участие в материале. Для недоступных связей удалите выбор перед сохранением.</p>
    <div className="form-three-columns">
      <label>Тип объекта<select value={kind} onChange={event => { generation.current++; setKind(event.target.value as ArticleRelationKind); setOptions([]); setLoading(false); }}>
        {articleRelationKinds.map(item => <option key={item} value={item}>{relationKindLabels.ru[item]}</option>)}
      </select></label>
      <label>Название RU / KK<input value={query} maxLength={120} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); search(); } }} /></label>
      <button type="button" className="secondary-button" disabled={loading} onClick={search}>{loading ? "Загрузка…" : "Найти объекты"}</button>
    </div>
    {error ? <p role="alert">{error}</p> : null}
    <ul className="relation-options">{options.map(item => {
      const selected = value.some(link => link.kind === item.kind && link.entityId === item.entityId);
      return <li key={`${item.kind}:${item.entityId}`}><span>{item.titleRu} / {item.titleKk}</span><button type="button" className="secondary-button" disabled={selected || value.length >= 50} onClick={() => onChange([...value, { kind: item.kind, entityId: item.entityId, relationType: "mentioned" }])}>{selected ? "Выбрано" : "Добавить"}</button></li>;
    })}</ul>
    {!loading && options.length === 50 ? <p className="field-hint">Первые 50 результатов. Уточните название.</p> : null}
    <ol className="relation-options">{value.map((link, index) => {
      const key = `${link.kind}:${link.entityId}`;
      return <li key={key}><span><small>{relationKindLabels.ru[link.kind]}</small>{known[key]?.titleRu ?? `Объект ${link.entityId}`}</span>
        <label>Роль связи<select aria-label={`Роль связи ${index + 1}`} value={link.relationType} onChange={event => onChange(value.map((item, position) => position === index ? { ...item, relationType: event.target.value as ArticleRelationLink["relationType"] } : item))}>
          {articleRelationTypes.map(role => <option key={role} value={role}>{relationTypeLabels.ru[role]}</option>)}
        </select></label>
        <button type="button" className="secondary-button" disabled={index === 0} onClick={() => { const next = [...value]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; onChange(next); }} aria-label={`Поднять связь ${index + 1}`}>↑</button>
        <button type="button" className="secondary-button" onClick={() => onChange(value.filter((_, position) => position !== index))} aria-label={`Удалить связь ${index + 1}`}>Удалить</button>
      </li>;
    })}</ol>
  </fieldset>;
}
