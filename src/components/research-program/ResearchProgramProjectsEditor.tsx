"use client";

import { useState, useTransition } from "react";
import { FolderGit2, Layers, Plus, Search, Trash2, UserPlus, Users } from "lucide-react";
import {
  saveResearchProgramProjects,
  searchResearchProgramProjects,
} from "@/server/actions/research-program-projects.actions";
import type {
  ProgramProjectOption,
  ProgramProjects,
} from "@/lib/validation/research-program-projects";
import { SubmitButton } from "@/components/science/SubmitButton";

export function ResearchProgramProjectsEditor({
  programId,
  graph,
  options: initial,
}: {
  programId: string;
  graph: ProgramProjects;
  options: ProgramProjectOption[];
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

  const search = () =>
    startTransition(async () => {
      setError("");
      try {
        const result = await searchResearchProgramProjects(query);
        if (!result.ok) {
          setError("Не удалось выполнить поиск.");
          return;
        }
        setOptions((previous) => [
          ...new Map(
            [...previous.filter((p) => workIds.includes(p.id)), ...result.options].map((p) => [
              p.id,
              p,
            ])
          ).values(),
        ]);
      } catch {
        setError("Не удалось выполнить поиск. Повторите попытку.");
      }
    });

  return (
    <section className="article-editor-panel wp-editor-content-box" id="projects" style={{ marginTop: "32px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <FolderGit2 size={20} style={{ color: "var(--forest-bright)" }} aria-hidden="true" />
        <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Проекты и участники программы</h2>
      </div>
      <p className="field-hint" style={{ margin: "0 0 16px", fontSize: "13px", color: "#64748b" }}>
        Свяжите программу с существующими научными проектами. Для назначения принятой заявки сначала добавьте
        профиль участника в команду проекта. Публично отображаются только открытые проекты, профили и
        результаты; сведения заявок остаются закрытыми.
      </p>

      <form action={saveResearchProgramProjects.bind(null, programId)} className="translation-fields">
        <input
          type="hidden"
          name="projects"
          value={JSON.stringify({ expectedVersion: graph.version, workIds, participants })}
        />

        {error ? (
          <div role="alert" className="notice error-notice" style={{ marginBottom: "16px" }}>
            {error}
          </div>
        ) : null}

        {/* SEARCH AND ADD PROJECTS */}
        <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "20px" }}>
          <h3 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 650 }}>
            Связанные исследовательские проекты ({workIds.length}/20)
          </h3>

          <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
            <label style={{ flex: "1 1 240px" }}>
              <span className="visually-hidden">Поиск проекта RU / KK</span>
              <input
                value={query}
                maxLength={120}
                placeholder="Поиск научного проекта по названию RU / KK..."
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    search();
                  }
                }}
                style={{ width: "100%", padding: "8px 12px" }}
              />
            </label>
            <button
              type="button"
              className="secondary-button"
              disabled={pending}
              onClick={search}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <Search size={14} aria-hidden="true" />
              <span>Найти проект</span>
            </button>
          </div>

          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
            <label style={{ flex: "1 1 240px" }}>
              <span className="visually-hidden">Научный проект</span>
              <select
                value={workId}
                onChange={(e) => {
                  setWorkId(e.target.value);
                  setScientistId("");
                }}
                style={{ width: "100%", padding: "8px 10px" }}
              >
                <option value="">Выберите проект</option>
                {options.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} · {p.status}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="secondary-button"
              disabled={!workId || workIds.includes(workId) || workIds.length >= 20}
              onClick={() => setWorkIds([...workIds, workId])}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <Plus size={14} aria-hidden="true" />
              <span>Добавить проект</span>
            </button>
          </div>

          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
            {workIds.map((id) => (
              <li
                key={id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#ffffff",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  fontSize: "13px",
                }}
              >
                <span style={{ fontWeight: 500 }}>
                  {options.find((p) => p.id === id)?.title ?? "Проект недоступен"}
                </span>
                <button
                  type="button"
                  className="button-link"
                  style={{ color: "#e11d48", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                  onClick={() => {
                    setWorkIds(workIds.filter((w) => w !== id));
                    setParticipants(participants.filter((p) => p.workId !== id));
                  }}
                >
                  <Trash2 size={13} aria-hidden="true" />
                  <span>Удалить проект</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* ASSIGN PARTICIPANTS */}
        <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "20px" }}>
          <h3 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 650 }}>
            Назначение участников в проекты
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px", marginBottom: "12px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>Принятая заявка</span>
              <select
                value={applicationId}
                onChange={(e) => setApplicationId(e.target.value)}
                style={{ padding: "8px 10px" }}
              >
                <option value="">Выберите заявку</option>
                {graph.applications.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {a.status}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>
                Профиль в команде выбранного проекта
              </span>
              <select
                value={scientistId}
                onChange={(e) => setScientistId(e.target.value)}
                style={{ padding: "8px 10px" }}
              >
                <option value="">Выберите профиль</option>
                {options
                  .find((p) => p.id === workId)
                  ?.members.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          <button
            type="button"
            className="secondary-button"
            disabled={
              !workIds.includes(workId) ||
              !applicationId ||
              !scientistId ||
              participants.length >= 500 ||
              participants.some(
                (p) =>
                  p.workId === workId &&
                  (p.applicationId === applicationId || p.scientistId === scientistId)
              )
            }
            onClick={() => {
              setParticipants([...participants, { workId, applicationId, scientistId }]);
              setApplicationId("");
              setScientistId("");
            }}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginBottom: "16px" }}
          >
            <UserPlus size={14} aria-hidden="true" />
            <span>Назначить участника</span>
          </button>

          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
            {participants.map((p, i) => (
              <li
                key={p.workId + p.applicationId}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#ffffff",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  fontSize: "13px",
                }}
              >
                <span>
                  <strong>{graph.applications.find((a) => a.id === p.applicationId)?.name ?? "Заявка недоступна"}</strong>{" "}
                  → {options.find((w) => w.id === p.workId)?.title ?? "Проект недоступен"} ·{" "}
                  <span style={{ color: "#0284c7" }}>
                    {options.find((w) => w.id === p.workId)?.members.find((s) => s.id === p.scientistId)?.name ??
                      "Профиль недоступен"}
                  </span>
                </span>
                <button
                  type="button"
                  className="button-link"
                  style={{ color: "#e11d48", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                  onClick={() => setParticipants(participants.filter((_, index) => index !== i))}
                >
                  <Trash2 size={13} aria-hidden="true" />
                  <span>Удалить назначение</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div style={{ marginTop: "16px" }}>
          <SubmitButton label="Сохранить связи" />
        </div>
      </form>
    </section>
  );
}
