"use client";
import { useState, useTransition } from "react";
import { searchResearchProgramProjects, saveResearchProgramProjects } from "@/server/actions/research-program-projects.actions";
import type { ProgramProjects, ProgramProjectOption } from "@/lib/validation/research-program-projects";
import { SubmitButton } from "@/components/science/SubmitButton";
export function ResearchProgramProjectsEditor({ programId, graph, options: initial }: {
  programId: string; graph: ProgramProjects; options: ProgramProjectOption[];
}) {
  const [workIds, setWorkIds] = useState(graph.workIds);
  const [participants, setParticipants] = useState(graph.participants);
  const [options, setOptions] = useState(initial);
  const [query, setQuery] = useState("");
  const [workId, setWorkId] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [scientistId, setScientistId] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const search = () => startTransition(async () => {
    setError("");
    try {
      const result = await searchResearchProgramProjects(query);
      if (!result.ok) { setError("Не удалось выполнить поиск."); return; }
      setOptions(previous => [...new Map([...previous.filter(p => workIds.includes(p.id)), ...result.options].map(p => [p.id, p])).values()]);
    } catch { setError("Не удалось выполнить поиск. Повторите попытку."); }
  });
  return <section className="article-editor-panel" id="projects"><h2>Проекты и участники программы</h2>
    <p className="field-hint">Свяжите программу с существующими научными проектами. Для назначения принятой заявки сначала добавьте профиль участника в команду проекта. Публично отображаются только открытые проекты, профили и результаты; сведения заявок остаются закрытыми.</p>
    <form action={saveResearchProgramProjects.bind(null, programId)} className="translation-fields">
      <input type="hidden" name="projects" value={JSON.stringify({ expectedVersion: graph.version, workIds, participants })} />
      {error ? <p role="alert">{error}</p> : null}
      <label>Поиск проекта RU / KK<input value={query} maxLength={120} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); search(); } }} /></label>
      <button type="button" className="secondary-button" disabled={pending} onClick={search}>Найти проект</button>
      <label>Научный проект<select value={workId} onChange={e => { setWorkId(e.target.value); setScientistId(""); }}><option value="">Выберите проект</option>{options.map(p => <option key={p.id} value={p.id}>{p.title} · {p.status}</option>)}</select></label>
      <button type="button" className="secondary-button" disabled={!workId || workIds.includes(workId) || workIds.length >= 20} onClick={() => setWorkIds([...workIds, workId])}>Добавить проект</button>
      <ul>{workIds.map(id => <li key={id}>{options.find(p => p.id === id)?.title ?? "Проект недоступен"} <button type="button" onClick={() => { setWorkIds(workIds.filter(w => w !== id)); setParticipants(participants.filter(p => p.workId !== id)); }}>Удалить проект</button></li>)}</ul>
      <label>Принятая заявка<select value={applicationId} onChange={e => setApplicationId(e.target.value)}><option value="">Выберите заявку</option>{graph.applications.map(a => <option key={a.id} value={a.id}>{a.name} · {a.status}</option>)}</select></label>
      <label>Профиль в команде выбранного проекта<select value={scientistId} onChange={e => setScientistId(e.target.value)}><option value="">Выберите профиль</option>{options.find(p => p.id === workId)?.members.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <button type="button" className="secondary-button" disabled={!workIds.includes(workId) || !applicationId || !scientistId || participants.length >= 500 || participants.some(p => p.workId === workId && (p.applicationId === applicationId || p.scientistId === scientistId))}
        onClick={() => { setParticipants([...participants, { workId, applicationId, scientistId }]); setApplicationId(""); setScientistId(""); }}>Назначить участника</button>
      <ul>{participants.map((p, i) => <li key={p.workId + p.applicationId}>{graph.applications.find(a => a.id === p.applicationId)?.name ?? "Заявка недоступна"} → {options.find(w => w.id === p.workId)?.title ?? "Проект недоступен"} · {options.find(w => w.id === p.workId)?.members.find(s => s.id === p.scientistId)?.name ?? "Профиль недоступен"} <button type="button" onClick={() => setParticipants(participants.filter((_, index) => index !== i))}>Удалить назначение</button></li>)}</ul>
      <div><SubmitButton label="Сохранить связи" /></div>
    </form>
  </section>;
}
