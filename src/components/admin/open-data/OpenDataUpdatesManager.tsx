"use client";

import { useState, useTransition } from "react";
import type { OpenDataCategoryRow, OpenDataUpdateWithCategory } from "@/types/domain/open-data";
import {
  saveOpenDataUpdateAction,
  deleteOpenDataUpdateAction,
} from "@/server/actions/open-data.actions";
import { Edit2, Plus, Trash2, X } from "lucide-react";

type Props = {
  updates: OpenDataUpdateWithCategory[];
  categories: OpenDataCategoryRow[];
};

export function OpenDataUpdatesManager({ updates, categories }: Props) {
  const [editingUpdate, setEditingUpdate] = useState<Partial<OpenDataUpdateWithCategory> | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleOpenAdd = () => {
    setEditingUpdate({
      category_id: categories[0]?.id ?? "",
      title_ru: "",
      title_kk: "",
      description_ru: "",
      description_kk: "",
      source_name: "",
      source_url: null,
      period_start: null,
      period_end: null,
      received_at: new Date().toISOString().split("T")[0],
      is_published: true,
    });
    setError(null);
  };

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);

    const sourceUrl = String(form.get("source_url") ?? "").trim();
    const periodStart = String(form.get("period_start") ?? "").trim();
    const periodEnd = String(form.get("period_end") ?? "").trim();

    const data = {
      id: editingUpdate?.id,
      category_id: String(form.get("category_id") ?? ""),
      title_ru: String(form.get("title_ru") ?? "").trim(),
      title_kk: String(form.get("title_kk") ?? "").trim(),
      description_ru: String(form.get("description_ru") ?? "").trim(),
      description_kk: String(form.get("description_kk") ?? "").trim(),
      source_name: String(form.get("source_name") ?? "").trim(),
      source_url: sourceUrl || null,
      period_start: periodStart || null,
      period_end: periodEnd || null,
      received_at: String(form.get("received_at") ?? new Date().toISOString().split("T")[0]),
      is_published: form.get("is_published") === "on",
    };

    startTransition(async () => {
      const res = await saveOpenDataUpdateAction(data);
      if (res.error) {
        setError(res.error);
      } else {
        setEditingUpdate(null);
      }
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Вы уверены, что хотите удалить запись о поступлении "${name}"?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteOpenDataUpdateAction(id);
      if (res.error) {
        setError(res.error);
      }
    });
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div>
          <h2 style={{ margin: "0 0 4px" }}>Последние поступления данных</h2>
          <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
            Информационные записи о новых наборах данных (до 5 последних опубликованных отображаются на странице /open-data).
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenAdd}
          className="button-primary"
          style={{ display: "flex", alignItems: "center", gap: "6px" }}
          disabled={categories.length === 0}
        >
          <Plus size={16} /> Добавить запись
        </button>
      </div>

      {categories.length === 0 ? (
        <p className="notice" style={{ marginBottom: "16px" }}>
          Сначала создайте хотя бы одну категорию во вкладке &laquo;Категории&raquo;.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="notice error-notice" style={{ marginBottom: "16px" }}>
          {error}
        </p>
      ) : null}

      {editingUpdate ? (
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #cbd5e1",
            borderRadius: "8px",
            padding: "20px",
            marginBottom: "24px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ margin: 0 }}>
              {editingUpdate.id ? "Редактирование записи о поступлении" : "Новое поступление данных"}
            </h3>
            <button
              type="button"
              onClick={() => setEditingUpdate(null)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSave}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
              <label>
                <strong>Категория данных *</strong>
                <select
                  name="category_id"
                  defaultValue={editingUpdate.category_id ?? categories[0]?.id}
                  required
                  style={{ width: "100%", marginTop: "4px", padding: "8px" }}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title_ru} / {c.title_kk}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <strong>Дата поступления *</strong>
                <input
                  type="date"
                  name="received_at"
                  defaultValue={editingUpdate.received_at ?? new Date().toISOString().split("T")[0]}
                  required
                  style={{ width: "100%", marginTop: "4px" }}
                />
              </label>

              <label>
                <strong>Название набора данных (RU) *</strong>
                <input
                  name="title_ru"
                  defaultValue={editingUpdate.title_ru ?? ""}
                  required
                  style={{ width: "100%", marginTop: "4px" }}
                />
              </label>
              <label>
                <strong>Название набора данных (KZ) *</strong>
                <input
                  name="title_kk"
                  defaultValue={editingUpdate.title_kk ?? ""}
                  required
                  style={{ width: "100%", marginTop: "4px" }}
                />
              </label>

              <label>
                <strong>Краткое описание (RU)</strong>
                <textarea
                  name="description_ru"
                  defaultValue={editingUpdate.description_ru ?? ""}
                  rows={3}
                  style={{ width: "100%", marginTop: "4px" }}
                />
              </label>
              <label>
                <strong>Краткое описание (KZ)</strong>
                <textarea
                  name="description_kk"
                  defaultValue={editingUpdate.description_kk ?? ""}
                  rows={3}
                  style={{ width: "100%", marginTop: "4px" }}
                />
              </label>

              <label>
                <strong>Источник данных (название) *</strong>
                <input
                  name="source_name"
                  defaultValue={editingUpdate.source_name ?? ""}
                  placeholder="Казгидромет, Бюро нацстатистики..."
                  required
                  style={{ width: "100%", marginTop: "4px" }}
                />
              </label>
              <label>
                <strong>Ссылка на источник (URL)</strong>
                <input
                  type="url"
                  name="source_url"
                  defaultValue={editingUpdate.source_url ?? ""}
                  placeholder="https://..."
                  style={{ width: "100%", marginTop: "4px" }}
                />
              </label>

              <label>
                <strong>Период охвата (начало)</strong>
                <input
                  name="period_start"
                  defaultValue={editingUpdate.period_start ?? ""}
                  placeholder="2020, 01.2023..."
                  style={{ width: "100%", marginTop: "4px" }}
                />
              </label>
              <label>
                <strong>Период охвата (конец)</strong>
                <input
                  name="period_end"
                  defaultValue={editingUpdate.period_end ?? ""}
                  placeholder="2024, текущее время..."
                  style={{ width: "100%", marginTop: "4px" }}
                />
              </label>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  name="is_published"
                  defaultChecked={editingUpdate.is_published ?? true}
                />
                Опубликовать на странице
              </label>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button type="submit" className="button-primary" disabled={isPending}>
                {isPending ? "Сохранение..." : "Сохранить запись"}
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() => setEditingUpdate(null)}
                disabled={isPending}
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="table-wrap">
        <table className="articles-table">
          <thead>
            <tr>
              <th>Набор данных (RU / KZ)</th>
              <th>Категория</th>
              <th>Источник</th>
              <th>Период охвата</th>
              <th>Дата поступления</th>
              <th>Статус</th>
              <th style={{ width: "100px", textAlign: "right" }}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {updates.map((u) => (
              <tr key={u.id}>
                <td>
                  <strong>{u.title_ru}</strong>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>{u.title_kk}</div>
                </td>
                <td>
                  {u.category ? (
                    <span>{u.category.title_ru}</span>
                  ) : (
                    <span style={{ color: "#94a3b8" }}>—</span>
                  )}
                </td>
                <td>
                  {u.source_url ? (
                    <a href={u.source_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>
                      {u.source_name}
                    </a>
                  ) : (
                    u.source_name
                  )}
                </td>
                <td style={{ fontSize: "13px" }}>
                  {u.period_start || u.period_end ? (
                    `${u.period_start ?? "..."} — ${u.period_end ?? "..."}`
                  ) : (
                    <span style={{ color: "#94a3b8" }}>—</span>
                  )}
                </td>
                <td style={{ fontSize: "13px", whiteSpace: "nowrap" }}>
                  {u.received_at}
                </td>
                <td>
                  {u.is_published ? (
                    <span className="status-badge status-published">Опубликовано</span>
                  ) : (
                    <span className="status-badge status-draft">Черновик</span>
                  )}
                </td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <button
                    type="button"
                    onClick={() => setEditingUpdate(u)}
                    title="Редактировать"
                    style={{ background: "none", border: "none", cursor: "pointer", marginRight: "8px", color: "#0284c7" }}
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(u.id, u.title_ru)}
                    title="Удалить"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#e11d48" }}
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {updates.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                  Записи о поступлениях пока не добавлены.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
