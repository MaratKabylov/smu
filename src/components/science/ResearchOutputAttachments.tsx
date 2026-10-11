"use client";
import { useState } from "react";
import { searchOutputWorks } from "@/server/actions/research-output.actions";
import type { ResearchOutputInput } from "@/lib/validation/research-output";
export type OutputWorkOption = { id: string; title: string; kind: "research" | "project"; status: "draft" | "published" | "archived" };
export function ResearchOutputAttachments({ initialFiles, initialWorkIds, initialWorks, initialUploads }: {
  initialFiles: ResearchOutputInput["files"]; initialWorkIds: string[]; initialWorks: OutputWorkOption[];
  initialUploads: { id: string; file_name: string; file_size: number }[];
}) {
  const [files, setFiles] = useState(initialFiles);
  const [workIds, setWorkIds] = useState(initialWorkIds);
  const [works, setWorks] = useState(initialWorks);
  const [uploads, setUploads] = useState(initialUploads);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [workId, setWorkId] = useState("");
  const search = async () => {
    setPending(true); setError("");
    try {
      const result = await searchOutputWorks(query);
      if (!result.ok) throw new Error();
      setWorks(previous => [...result.options, ...previous.filter(w => workIds.includes(w.id) && !result.options.some(o => o.id === w.id))]);
    } catch { setError("Не удалось найти работы. Повторите поиск."); }
    finally { setPending(false); }
  };
  const upload = async (file?: File) => {
    if (!file) return;
    setPending(true); setError("");
    try {
      const form = new FormData(); form.set("file", file);
      const response = await fetch("/api/admin/results/uploads", { method: "POST", body: form });
      if (!response.ok) throw new Error();
      const item: { id: string; name: string; size: number } = await response.json();
      setUploads(previous => [{ id: item.id, file_name: item.name, file_size: item.size }, ...previous]);
      setFiles(previous => [...previous, { id: item.id, isPublic: false }]);
    } catch { setError("Не удалось загрузить файл. Допустимы PDF, CSV в UTF-8 и ZIP до 4 МБ."); }
    finally { setPending(false); }
  };
  return <section className="article-editor-panel"><h2>Связанные работы и файлы</h2>
    {error ? <p role="alert" className="notice error-notice">{error}</p> : null}
    <label>Поиск работы<input value={query} maxLength={120} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void search(); } }} /></label>
    <button type="button" disabled={pending} onClick={() => void search()}>Найти работу</button>
    <label>Исследование / проект<select value={workId} onChange={e => setWorkId(e.target.value)}><option value="">Выберите работу</option>{works.filter(w => !workIds.includes(w.id)).map(w => <option key={w.id} value={w.id}>{w.title} · {w.status}</option>)}</select></label>
    <button type="button" disabled={!workId || workIds.length >= 20} onClick={() => { setWorkIds([...workIds, workId]); setWorkId(""); }}>Связать работу</button>
    <ul className="relation-options">{workIds.map(id => <li key={id}><input type="hidden" name="workIds" value={id} /><span>{works.find(w => w.id === id)?.title ?? "Работа недоступна — удалите связь"}</span><button type="button" onClick={() => setWorkIds(workIds.filter(w => w !== id))}>Удалить связь</button></li>)}</ul>
    <p className="field-hint">Укажите от 1 до 20 работ. Для публикации результата все связанные работы должны быть опубликованы.</p>
    <input type="hidden" name="files" value={JSON.stringify(files)} />
    <label>Загрузить файл<input type="file" accept=".pdf,.csv,.zip" disabled={pending || files.length >= 20} onChange={e => { void upload(e.target.files?.[0]); e.target.value = ""; }} /></label>
    <p className="field-hint">PDF, CSV в UTF-8 или ZIP до 4 МБ. Новый файл закрыт. Отметьте публичный доступ, если его можно распространять вместе с результатом.</p>
    <label>Ранее загруженные файлы<select value="" disabled={files.length >= 20} onChange={e => { if (e.target.value) setFiles([...files, { id: e.target.value, isPublic: false }]); }}><option value="">Выберите файл</option>{uploads.filter(u => !files.some(f => f.id === u.id)).map(u => <option key={u.id} value={u.id}>{u.file_name}</option>)}</select></label>
    <ul className="relation-options">{files.map(file => <li key={file.id}><span>{uploads.find(u => u.id === file.id)?.file_name ?? "Файл недоступен"}</span><label><input type="checkbox" checked={file.isPublic} onChange={e => setFiles(files.map(f => f.id === file.id ? { ...f, isPublic: e.target.checked } : f))} />Публичный доступ</label><button type="button" onClick={() => setFiles(files.filter(f => f.id !== file.id))}>Убрать файл</button></li>)}</ul>
    <button type="submit" className="primary-button" disabled={pending}>{pending ? "Подождите…" : "Сохранить новую версию"}</button>
  </section>;
}
