"use client";

import { useActionState } from "react";
import type { OpenDataSettingsRow } from "@/types/domain/open-data";
import { saveOpenDataSettingsAction } from "@/server/actions/open-data.actions";

type Props = {
  settings: OpenDataSettingsRow | null;
};

export function OpenDataSettingsForm({ settings }: Props) {
  const [state, formAction, pending] = useActionState(
    async (prev: { error?: string; success?: boolean }, formData: FormData) => {
      const data = {
        title_ru: String(formData.get("title_ru") ?? ""),
        title_kk: String(formData.get("title_kk") ?? ""),
        subtitle_ru: String(formData.get("subtitle_ru") ?? ""),
        subtitle_kk: String(formData.get("subtitle_kk") ?? ""),
        short_description_ru: String(formData.get("short_description_ru") ?? ""),
        short_description_kk: String(formData.get("short_description_kk") ?? ""),
        description_ru: String(formData.get("description_ru") ?? ""),
        description_kk: String(formData.get("description_kk") ?? ""),
        status: String(formData.get("status") ?? "collecting"),
        status_text_ru: String(formData.get("status_text_ru") ?? ""),
        status_text_kk: String(formData.get("status_text_kk") ?? ""),
        collaboration_text_ru: String(formData.get("collaboration_text_ru") ?? ""),
        collaboration_text_kk: String(formData.get("collaboration_text_kk") ?? ""),
        is_published: formData.get("is_published") === "on",
        show_on_homepage: formData.get("show_on_homepage") === "on",
        data_updated_at: String(formData.get("data_updated_at") ?? new Date().toISOString().split("T")[0]),
      };

      return saveOpenDataSettingsAction(data);
    },
    {}
  );

  return (
    <form action={formAction} className="site-content-form">
      {state.error ? (
        <p role="alert" className="notice error-notice">
          {state.error}
        </p>
      ) : state.success ? (
        <p role="status" className="notice">
          Настройки успешно сохранены
        </p>
      ) : null}

      <fieldset disabled={pending} style={{ border: "none", padding: 0, margin: 0 }}>
        <div style={{ display: "flex", gap: "24px", marginBottom: "20px", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600 }}>
            <input
              type="checkbox"
              name="is_published"
              defaultChecked={settings?.is_published ?? true}
            />
            Публикация страницы /open-data
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600 }}>
            <input
              type="checkbox"
              name="show_on_homepage"
              defaultChecked={settings?.show_on_homepage ?? true}
            />
            Отображать блок на главной странице
          </label>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>
            Дата актуальности информации
          </label>
          <input
            type="date"
            name="data_updated_at"
            defaultValue={settings?.data_updated_at ?? new Date().toISOString().split("T")[0]}
            required
            style={{ maxWidth: "250px" }}
          />
        </div>

        <div className="translation-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "24px" }}>
          <section className="article-editor-panel" style={{ padding: "16px", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
            <h3 style={{ marginTop: 0 }}>Русский язык (RU)</h3>
            <label style={{ display: "block", marginBottom: "12px" }}>
              <strong>Заголовок инициативы</strong>
              <input
                name="title_ru"
                defaultValue={settings?.title_ru ?? "Open Data Aktobe"}
                required
                style={{ width: "100%", marginTop: "4px" }}
              />
            </label>
            <label style={{ display: "block", marginBottom: "12px" }}>
              <strong>Подзаголовок</strong>
              <input
                name="subtitle_ru"
                defaultValue={settings?.subtitle_ru ?? "Данные сегодня — открытия завтра."}
                required
                style={{ width: "100%", marginTop: "4px" }}
              />
            </label>
            <label style={{ display: "block", marginBottom: "12px" }}>
              <strong>Краткое описание (для главной страницы)</strong>
              <textarea
                name="short_description_ru"
                defaultValue={settings?.short_description_ru ?? ""}
                rows={3}
                required
                style={{ width: "100%", marginTop: "4px" }}
              />
            </label>
            <label style={{ display: "block", marginBottom: "12px" }}>
              <strong>Полное описание (Hero страницы /open-data)</strong>
              <textarea
                name="description_ru"
                defaultValue={settings?.description_ru ?? ""}
                rows={6}
                required
                style={{ width: "100%", marginTop: "4px" }}
              />
            </label>
            <label style={{ display: "block", marginBottom: "12px" }}>
              <strong>Статус инициативы (текст)</strong>
              <input
                name="status_text_ru"
                defaultValue={settings?.status_text_ru ?? "Ведётся сбор и систематизация данных."}
                required
                style={{ width: "100%", marginTop: "4px" }}
              />
            </label>
            <label style={{ display: "block", marginBottom: "12px" }}>
              <strong>Текст приглашения к сотрудничеству</strong>
              <textarea
                name="collaboration_text_ru"
                defaultValue={settings?.collaboration_text_ru ?? ""}
                rows={4}
                required
                style={{ width: "100%", marginTop: "4px" }}
              />
            </label>
          </section>

          <section className="article-editor-panel" style={{ padding: "16px", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
            <h3 style={{ marginTop: 0 }}>Казахский язык (KZ)</h3>
            <label style={{ display: "block", marginBottom: "12px" }}>
              <strong>Заголовок (KZ)</strong>
              <input
                name="title_kk"
                defaultValue={settings?.title_kk ?? "Open Data Aktobe"}
                required
                style={{ width: "100%", marginTop: "4px" }}
              />
            </label>
            <label style={{ display: "block", marginBottom: "12px" }}>
              <strong>Подзаголовок (KZ)</strong>
              <input
                name="subtitle_kk"
                defaultValue={settings?.subtitle_kk ?? "Бүгінгі деректер — ертеңгі жаңалықтар."}
                required
                style={{ width: "100%", marginTop: "4px" }}
              />
            </label>
            <label style={{ display: "block", marginBottom: "12px" }}>
              <strong>Краткое описание (KZ)</strong>
              <textarea
                name="short_description_kk"
                defaultValue={settings?.short_description_kk ?? ""}
                rows={3}
                required
                style={{ width: "100%", marginTop: "4px" }}
              />
            </label>
            <label style={{ display: "block", marginBottom: "12px" }}>
              <strong>Полное описание (KZ)</strong>
              <textarea
                name="description_kk"
                defaultValue={settings?.description_kk ?? ""}
                rows={6}
                required
                style={{ width: "100%", marginTop: "4px" }}
              />
            </label>
            <label style={{ display: "block", marginBottom: "12px" }}>
              <strong>Статус инициативы (KZ)</strong>
              <input
                name="status_text_kk"
                defaultValue={settings?.status_text_kk ?? "Деректерді жинау және жүйелеу жұмыстары жүргізілуде."}
                required
                style={{ width: "100%", marginTop: "4px" }}
              />
            </label>
            <label style={{ display: "block", marginBottom: "12px" }}>
              <strong>Текст приглашения к сотрудничеству (KZ)</strong>
              <textarea
                name="collaboration_text_kk"
                defaultValue={settings?.collaboration_text_kk ?? ""}
                rows={4}
                required
                style={{ width: "100%", marginTop: "4px" }}
              />
            </label>
          </section>
        </div>

        <input type="hidden" name="status" defaultValue={settings?.status ?? "collecting"} />

        <div style={{ marginTop: "16px" }}>
          <button type="submit" className="button-primary" disabled={pending}>
            {pending ? "Сохранение..." : "Сохранить настройки"}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
