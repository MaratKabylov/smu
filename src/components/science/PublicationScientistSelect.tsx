"use client";

import { startTransition, useState } from "react";
import { Search, UserCheck } from "lucide-react";
import type { ArticleRelationOption } from "@/types/domain/article-relations";
import { searchArticleRelations } from "@/server/actions/article-relations.actions";

export function PublicationScientistSelect({
  options: initialOptions,
  initialId = "",
  disabled = false,
}: {
  options: ArticleRelationOption[];
  initialId?: string;
  disabled?: boolean;
}) {
  const [options, setOptions] = useState(initialOptions);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(initialId);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  return (
    <div className="pub-lead-scientist-select">
      <div className="pub-search-row">
        <label className="pub-search-field">
          <span className="visually-hidden">Поиск учёного RU / KK</span>
          <Search size={15} aria-hidden="true" />
          <input
            maxLength={120}
            value={query}
            disabled={disabled || pending}
            placeholder="Быстрый поиск учёного RU / KK..."
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
              }
            }}
          />
        </label>
        <button
          className="secondary-button"
          type="button"
          disabled={disabled || pending}
          onClick={() => {
            setPending(true);
            setError("");
            startTransition(async () => {
              const result = await searchArticleRelations("scientist", query);
              setPending(false);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setOptions((previous) => [
                ...result.options,
                ...previous.filter(
                  (item) => item.entityId === selected && !result.options.some((found) => found.entityId === item.entityId)
                ),
              ]);
            });
          }}
        >
          {pending ? "Загрузка…" : "Найти учёного"}
        </button>
      </div>

      {error ? (
        <p role="alert" className="notice error-notice" style={{ marginTop: "10px" }}>
          {error}
        </p>
      ) : null}

      <div style={{ marginTop: "14px" }}>
        <label className="pub-select-label">
          <span className="wp-field-label" style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
            <UserCheck size={15} aria-hidden="true" />
            Профиль основного автора <span className="required-star">*</span>
          </span>
          <select
            name="scientistId"
            required
            disabled={disabled || pending}
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            className="pub-select-control"
            style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", background: "#fff" }}
          >
            <option value="">Выберите исследователя из каталога</option>
            {selected && !options.some((item) => item.entityId === selected) ? (
              <option value={selected}>Текущий учёный недоступен — замените выбор</option>
            ) : null}
            {options.map((item) => (
              <option key={item.entityId} value={item.entityId}>
                {item.titleRu} / {item.titleKk}
              </option>
            ))}
          </select>
        </label>
      </div>

      {options.length >= 50 ? (
        <p className="field-hint" style={{ marginTop: "6px" }}>
          Уточните название или фамилию, чтобы найти учёного за пределами первых 50 результатов.
        </p>
      ) : null}
    </div>
  );
}
