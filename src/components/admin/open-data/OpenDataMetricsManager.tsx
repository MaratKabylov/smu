"use client";

import { useState, useTransition } from "react";
import type { OpenDataMetricRow } from "@/types/domain/open-data";
import {
  saveOpenDataMetricAction,
  deleteOpenDataMetricAction,
} from "@/server/actions/open-data.actions";
import { Edit2, Plus, Trash2, X } from "lucide-react";

type Props = {
  metrics: OpenDataMetricRow[];
};

export function OpenDataMetricsManager({ metrics }: Props) {
  const [editingMetric, setEditingMetric] = useState<Partial<OpenDataMetricRow> | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleOpenAdd = () => {
    setEditingMetric({
      code: "",
      title_ru: "",
      title_kk: "",
      value_numeric: null,
      value_text_ru: null,
      value_text_kk: null,
      unit_ru: "",
      unit_kk: "",
      icon: "database",
      sort_order: metrics.length + 1,
      is_visible: true,
      show_on_homepage: false,
    });
    setError(null);
  };

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);

    const rawValNum = form.get("value_numeric");
    const valNum = rawValNum !== null && rawValNum !== "" ? Number(rawValNum) : null;

    const data = {
      id: editingMetric?.id,
      code: String(form.get("code") ?? "").trim(),
      title_ru: String(form.get("title_ru") ?? "").trim(),
      title_kk: String(form.get("title_kk") ?? "").trim(),
      value_numeric: valNum,
      value_text_ru: String(form.get("value_text_ru") ?? "").trim() || null,
      value_text_kk: String(form.get("value_text_kk") ?? "").trim() || null,
      unit_ru: String(form.get("unit_ru") ?? "").trim(),
      unit_kk: String(form.get("unit_kk") ?? "").trim(),
      icon: String(form.get("icon") ?? "database").trim(),
      sort_order: Number(form.get("sort_order") ?? 0),
      is_visible: form.get("is_visible") === "on",
      show_on_homepage: form.get("show_on_homepage") === "on",
    };

    startTransition(async () => {
      const res = await saveOpenDataMetricAction(data);
      if (res.error) {
        setError(res.error);
      } else {
        setEditingMetric(null);
      }
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Вы уверены, что хотите удалить показатель "${name}"?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteOpenDataMetricAction(id);
      if (res.error) {
        setError(res.error);
      }
    });
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div>
          <h2 style={{ margin: "0 0 4px" }}>Информационные показатели</h2>
          <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
            Показатели отображаются на странице /open-data и на главной странице (до 4 показателей).
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenAdd}
          className="button-primary"
          style={{ display: "flex", alignItems: "center", gap: "6px" }}
        >
          <Plus size={16} /> Добавить показатель
        </button>
      </div>

      {error ? (
        <p role="alert" className="notice error-notice" style={{ marginBottom: "16px" }}>
          {error}
        </p>
      ) : null}

      {editingMetric ? (
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
              {editingMetric.id ? "Редактирование показателя" : "Новый показатель"}
            </h3>
            <button
              type="button"
              onClick={() => setEditingMetric(null)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSave}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
              <label>
                <strong>Код показателя (лат., уникальный) *</strong>
                <input
                  name="code"
                  defaultValue={editingMetric.code ?? ""}
                  required
                  pattern="[A-Za-z0-9_-]+"
                  style={{ width: "100%", marginTop: "4px" }}
                />
              </label>
              <label>
                <strong>Иконка (lucide-id)</strong>
                <input
                  name="icon"
                  defaultValue={editingMetric.icon ?? "database"}
                  placeholder="database, layers, file-text, sparkles..."
                  style={{ width: "100%", marginTop: "4px" }}
                />
              </label>

              <label>
                <strong>Название (RU) *</strong>
                <input
                  name="title_ru"
                  defaultValue={editingMetric.title_ru ?? ""}
                  required
                  style={{ width: "100%", marginTop: "4px" }}
                />
              </label>
              <label>
                <strong>Название (KZ) *</strong>
                <input
                  name="title_kk"
                  defaultValue={editingMetric.title_kk ?? ""}
                  required
                  style={{ width: "100%", marginTop: "4px" }}
                />
              </label>

              <label>
                <strong>Числовое значение (если применимо)</strong>
                <input
                  type="number"
                  min="0"
                  step="any"
                  name="value_numeric"
                  defaultValue={editingMetric.value_numeric !== null && editingMetric.value_numeric !== undefined ? editingMetric.value_numeric : ""}
                  placeholder="Оставьте пустым, если не заполнено"
                  style={{ width: "100%", marginTop: "4px" }}
                />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <label>
                  <strong>Единица (RU)</strong>
                  <input
                    name="unit_ru"
                    defaultValue={editingMetric.unit_ru ?? ""}
                    placeholder="ГБ, записей, млн..."
                    style={{ width: "100%", marginTop: "4px" }}
                  />
                </label>
                <label>
                  <strong>Единица (KZ)</strong>
                  <input
                    name="unit_kk"
                    defaultValue={editingMetric.unit_kk ?? ""}
                    placeholder="ГБ, жазба..."
                    style={{ width: "100%", marginTop: "4px" }}
                  />
                </label>
              </div>

              <label>
                <strong>Текстовое значение (RU, если не число)</strong>
                <input
                  name="value_text_ru"
                  defaultValue={editingMetric.value_text_ru ?? ""}
                  placeholder="Например: Актюбинская область, 2020-2026"
                  style={{ width: "100%", marginTop: "4px" }}
                />
              </label>
              <label>
                <strong>Текстовое значение (KZ)</strong>
                <input
                  name="value_text_kk"
                  defaultValue={editingMetric.value_text_kk ?? ""}
                  placeholder="Мысалы: Ақтөбе облысы, 2020-2026"
                  style={{ width: "100%", marginTop: "4px" }}
                />
              </label>

              <label>
                <strong>Порядок сортировки</strong>
                <input
                  type="number"
                  name="sort_order"
                  defaultValue={editingMetric.sort_order ?? 0}
                  style={{ width: "100%", marginTop: "4px" }}
                />
              </label>
              <div style={{ display: "flex", gap: "20px", alignItems: "center", marginTop: "24px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    name="is_visible"
                    defaultChecked={editingMetric.is_visible ?? true}
                  />
                  Видимость на странице /open-data
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    name="show_on_homepage"
                    defaultChecked={editingMetric.show_on_homepage ?? false}
                  />
                  На главной странице
                </label>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button type="submit" className="button-primary" disabled={isPending}>
                {isPending ? "Сохранение..." : "Сохранить показатель"}
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() => setEditingMetric(null)}
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
              <th style={{ width: "50px" }}>#</th>
              <th>Показатель (RU / KZ)</th>
              <th>Код</th>
              <th>Значение</th>
              <th>Главная</th>
              <th>Видимость</th>
              <th style={{ width: "100px", textAlign: "right" }}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => {
              const displayVal =
                m.value_numeric !== null
                  ? `${m.value_numeric} ${m.unit_ru}`.trim()
                  : m.value_text_ru
                  ? `${m.value_text_ru} ${m.unit_ru}`.trim()
                  : "— (не заполнено)";

              return (
                <tr key={m.id}>
                  <td style={{ color: "#64748b" }}>{m.sort_order}</td>
                  <td>
                    <strong>{m.title_ru}</strong>
                    <div style={{ fontSize: "12px", color: "#64748b" }}>{m.title_kk}</div>
                  </td>
                  <td>
                    <code style={{ fontSize: "12px" }}>{m.code}</code>
                  </td>
                  <td>
                    <span style={{ fontWeight: m.value_numeric !== null || m.value_text_ru ? 600 : 400, color: m.value_numeric !== null || m.value_text_ru ? "#0f172a" : "#94a3b8" }}>
                      {displayVal}
                    </span>
                  </td>
                  <td>
                    {m.show_on_homepage ? (
                      <span className="status-badge status-published">Да</span>
                    ) : (
                      <span style={{ color: "#94a3b8" }}>Нет</span>
                    )}
                  </td>
                  <td>
                    {m.is_visible ? (
                      <span className="status-badge status-published">Виден</span>
                    ) : (
                      <span className="status-badge status-draft">Скрыт</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      type="button"
                      onClick={() => setEditingMetric(m)}
                      title="Редактировать"
                      style={{ background: "none", border: "none", cursor: "pointer", marginRight: "8px", color: "#0284c7" }}
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(m.id, m.title_ru)}
                      title="Удалить"
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#e11d48" }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {metrics.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                  Показатели пока не добавлены.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
