"use client";

import { useState, useTransition } from "react";
import type { OpenDataCategoryRow, OpenDataCategoryStatus } from "@/types/domain/open-data";
import { openDataCategoryStatusLabels } from "@/lib/validation/open-data";
import {
  saveOpenDataCategoryAction,
  deleteOpenDataCategoryAction,
} from "@/server/actions/open-data.actions";
import { Edit2, Plus, Trash2, X } from "lucide-react";

type Props = {
  categories: OpenDataCategoryRow[];
};

export function OpenDataCategoriesManager({ categories }: Props) {
  const [editingCategory, setEditingCategory] = useState<Partial<OpenDataCategoryRow> | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleOpenAdd = () => {
    setEditingCategory({
      slug: "",
      title_ru: "",
      title_kk: "",
      description_ru: "",
      description_kk: "",
      icon: "folder",
      dataset_count: null,
      status: "collecting",
      sort_order: categories.length + 1,
      is_visible: true,
      show_on_homepage: false,
    });
    setError(null);
  };

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);

    const rawCount = form.get("dataset_count");
    const count = rawCount !== null && rawCount !== "" ? Number(rawCount) : null;

    const data = {
      id: editingCategory?.id,
      slug: String(form.get("slug") ?? "").trim(),
      title_ru: String(form.get("title_ru") ?? "").trim(),
      title_kk: String(form.get("title_kk") ?? "").trim(),
      description_ru: String(form.get("description_ru") ?? "").trim(),
      description_kk: String(form.get("description_kk") ?? "").trim(),
      icon: String(form.get("icon") ?? "folder").trim(),
      dataset_count: count,
      status: (form.get("status") as OpenDataCategoryStatus) ?? "collecting",
      sort_order: Number(form.get("sort_order") ?? 0),
      is_visible: form.get("is_visible") === "on",
      show_on_homepage: form.get("show_on_homepage") === "on",
    };

    startTransition(async () => {
      const res = await saveOpenDataCategoryAction(data);
      if (res.error) {
        setError(res.error);
      } else {
        setEditingCategory(null);
      }
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Вы уверены, что хотите удалить категорию "${name}"? Все связанные поступления будут также удалены.`)) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteOpenDataCategoryAction(id);
      if (res.error) {
        setError(res.error);
      }
    });
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div>
          <h2 style={{ margin: "0 0 4px" }}>Категории данных</h2>
          <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
            Направления сбора данных. На главной странице отображается не более шести выбранных категорий.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenAdd}
          className="button-primary"
          style={{ display: "flex", alignItems: "center", gap: "6px" }}
        >
          <Plus size={16} /> Добавить категорию
        </button>
      </div>

      {error ? (
        <p role="alert" className="notice error-notice" style={{ marginBottom: "16px" }}>
          {error}
        </p>
      ) : null}

      {editingCategory ? (
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
              {editingCategory.id ? "Редактирование категории" : "Новая категория"}
            </h3>
            <button
              type="button"
              onClick={() => setEditingCategory(null)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSave}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
              <label>
                <strong>Slug (лат. идентификатор) *</strong>
                <input
                  name="slug"
                  defaultValue={editingCategory.slug ?? ""}
                  required
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  placeholder="ecology, transport, water-resources..."
                  style={{ width: "100%", marginTop: "4px" }}
                />
              </label>
              <label>
                <strong>Иконка (lucide-id)</strong>
                <input
                  name="icon"
                  defaultValue={editingCategory.icon ?? "folder"}
                  placeholder="leaf, users, droplets, truck, map-pin..."
                  style={{ width: "100%", marginTop: "4px" }}
                />
              </label>

              <label>
                <strong>Название (RU) *</strong>
                <input
                  name="title_ru"
                  defaultValue={editingCategory.title_ru ?? ""}
                  required
                  style={{ width: "100%", marginTop: "4px" }}
                />
              </label>
              <label>
                <strong>Название (KZ) *</strong>
                <input
                  name="title_kk"
                  defaultValue={editingCategory.title_kk ?? ""}
                  required
                  style={{ width: "100%", marginTop: "4px" }}
                />
              </label>

              <label>
                <strong>Краткое описание (RU)</strong>
                <textarea
                  name="description_ru"
                  defaultValue={editingCategory.description_ru ?? ""}
                  rows={2}
                  style={{ width: "100%", marginTop: "4px" }}
                />
              </label>
              <label>
                <strong>Краткое описание (KZ)</strong>
                <textarea
                  name="description_kk"
                  defaultValue={editingCategory.description_kk ?? ""}
                  rows={2}
                  style={{ width: "100%", marginTop: "4px" }}
                />
              </label>

              <label>
                <strong>Количество наборов данных</strong>
                <input
                  type="number"
                  min="0"
                  name="dataset_count"
                  defaultValue={editingCategory.dataset_count !== null && editingCategory.dataset_count !== undefined ? editingCategory.dataset_count : ""}
                  placeholder="Оставьте пустым, если не заполнено"
                  style={{ width: "100%", marginTop: "4px" }}
                />
              </label>
              <label>
                <strong>Статус сбора данных *</strong>
                <select
                  name="status"
                  defaultValue={editingCategory.status ?? "collecting"}
                  style={{ width: "100%", marginTop: "4px", padding: "8px" }}
                >
                  <option value="planned">Запланировано</option>
                  <option value="collecting">Ведётся сбор</option>
                  <option value="processing">Ведётся обработка</option>
                  <option value="collected">Данные собраны</option>
                </select>
              </label>

              <label>
                <strong>Порядок сортировки</strong>
                <input
                  type="number"
                  name="sort_order"
                  defaultValue={editingCategory.sort_order ?? 0}
                  style={{ width: "100%", marginTop: "4px" }}
                />
              </label>
              <div style={{ display: "flex", gap: "20px", alignItems: "center", marginTop: "24px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    name="is_visible"
                    defaultChecked={editingCategory.is_visible ?? true}
                  />
                  Видимость на странице /open-data
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    name="show_on_homepage"
                    defaultChecked={editingCategory.show_on_homepage ?? false}
                  />
                  На главной странице
                </label>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button type="submit" className="button-primary" disabled={isPending}>
                {isPending ? "Сохранение..." : "Сохранить категорию"}
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() => setEditingCategory(null)}
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
              <th>Категория (RU / KZ)</th>
              <th>Slug / Иконка</th>
              <th>Наборов данных</th>
              <th>Статус</th>
              <th>Главная</th>
              <th>Видимость</th>
              <th style={{ width: "100px", textAlign: "right" }}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id}>
                <td style={{ color: "#64748b" }}>{c.sort_order}</td>
                <td>
                  <strong>{c.title_ru}</strong>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>{c.title_kk}</div>
                </td>
                <td>
                  <code style={{ fontSize: "12px" }}>{c.slug}</code>
                  <div style={{ fontSize: "11px", color: "#94a3b8" }}>{c.icon}</div>
                </td>
                <td>
                  {c.dataset_count !== null ? (
                    <strong>{c.dataset_count}</strong>
                  ) : (
                    <span style={{ color: "#94a3b8" }}>—</span>
                  )}
                </td>
                <td>
                  <span className={`status-badge status-${c.status === "collected" ? "published" : c.status === "collecting" ? "published" : "draft"}`}>
                    {openDataCategoryStatusLabels.ru[c.status] ?? c.status}
                  </span>
                </td>
                <td>
                  {c.show_on_homepage ? (
                    <span className="status-badge status-published">Да</span>
                  ) : (
                    <span style={{ color: "#94a3b8" }}>Нет</span>
                  )}
                </td>
                <td>
                  {c.is_visible ? (
                    <span className="status-badge status-published">Видна</span>
                  ) : (
                    <span className="status-badge status-draft">Скрыта</span>
                  )}
                </td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <button
                    type="button"
                    onClick={() => setEditingCategory(c)}
                    title="Редактировать"
                    style={{ background: "none", border: "none", cursor: "pointer", marginRight: "8px", color: "#0284c7" }}
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id, c.title_ru)}
                    title="Удалить"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#e11d48" }}
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {categories.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                  Категории пока не добавлены.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
