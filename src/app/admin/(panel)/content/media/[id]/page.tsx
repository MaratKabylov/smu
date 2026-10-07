import { ArrowLeft, ExternalLink, Link2, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  canDeleteMedia,
  canEditMedia,
  canViewMedia,
} from "@/lib/permissions/permissions";
import { MediaPreview } from "@/components/media/MediaPreview";
import {
  softDeleteMedia,
  updateMediaMetadata,
} from "@/server/actions/media.actions";
import { getAdminAccess } from "@/server/services/access.service";
import { MediaService } from "@/server/services/media.service";

type MediaDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
};

const errorMessages: Record<string, string> = {
  validation: "Проверьте длину полей и корректность URL источника.",
  forbidden: "Недостаточно прав для этого действия.",
  confirm_delete: "Подтвердите перенос файла в удалённые.",
  in_use: "Сначала удалите связи файла с материалами платформы.",
  action_failed: "Не удалось сохранить изменения. Повторите попытку.",
};

export default async function MediaDetailPage({
  params,
  searchParams,
}: MediaDetailPageProps) {
  const accessResult = await getAdminAccess();
  if (accessResult.state !== "allowed") return null;
  if (!canViewMedia(accessResult.access)) notFound();

  const { id } = await params;
  const state = await searchParams;
  const result = await new MediaService().getById(accessResult.access, id);
  if (!result || result.asset.deletedAt) notFound();

  const { asset, usages } = result;
  const mayEdit = canEditMedia(accessResult.access);
  const mayDelete = canDeleteMedia(accessResult.access);
  const updateAction = updateMediaMetadata.bind(null, asset.id);
  const deleteAction = softDeleteMedia.bind(null, asset.id);

  return (
    <div className="content-page">
      <Link className="back-link" href="/admin/content/media">
        <ArrowLeft aria-hidden="true" />
        Назад в медиатеку
      </Link>

      <div className="media-detail-heading">
        <div>
          <p className="page-kicker">Медиафайл</p>
          <h1>{asset.fileName}</h1>
          <p>
            {asset.mimeType} · {asset.storageBucket}
          </p>
        </div>
        {asset.previewUrl ? (
          <a
            className="secondary-button"
            href={asset.previewUrl}
            target="_blank"
            rel="noreferrer"
          >
            Открыть файл
            <ExternalLink aria-hidden="true" />
          </a>
        ) : null}
      </div>

      {state.saved === "1" ? (
        <div className="notice success-notice">Метаданные сохранены.</div>
      ) : null}
      {state.error ? (
        <div className="notice error-notice" role="alert">
          {errorMessages[state.error] ?? "Не удалось выполнить действие."}
        </div>
      ) : null}

      <div className="media-detail-grid">
        <section className="media-detail-preview">
          <MediaPreview asset={asset} large />
          <dl className="file-facts">
            <div>
              <dt>Путь</dt>
              <dd>{asset.storagePath}</dd>
            </div>
            <div>
              <dt>Размер</dt>
              <dd>{(asset.fileSize / 1024 / 1024).toFixed(2)} МБ</dd>
            </div>
            <div>
              <dt>Разрешение</dt>
              <dd>
                {asset.width && asset.height
                  ? `${asset.width} × ${asset.height}`
                  : "Не определено"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="metadata-panel">
          <div className="panel-title">
            <div>
              <h2>Описание и авторство</h2>
              <p>Alt-тексты обязательны перед публикацией изображения.</p>
            </div>
          </div>

          <form action={updateAction} className="metadata-form">
            <div className="form-two-columns">
              <label>
                Alt-текст · RU
                <input
                  name="altRu"
                  defaultValue={asset.altRu ?? ""}
                  disabled={!mayEdit}
                />
              </label>
              <label>
                Alt-текст · KK
                <input
                  name="altKk"
                  defaultValue={asset.altKk ?? ""}
                  disabled={!mayEdit}
                />
              </label>
            </div>
            <div className="form-two-columns">
              <label>
                Подпись · RU
                <textarea
                  name="captionRu"
                  defaultValue={asset.captionRu ?? ""}
                  disabled={!mayEdit}
                  rows={3}
                />
              </label>
              <label>
                Подпись · KK
                <textarea
                  name="captionKk"
                  defaultValue={asset.captionKk ?? ""}
                  disabled={!mayEdit}
                  rows={3}
                />
              </label>
            </div>
            <div className="form-two-columns">
              <label>
                Alt-текст · EN (необязательно)
                <input name="altEn" defaultValue={asset.altEn ?? ""} disabled={!mayEdit} />
              </label>
              <label>
                Подпись · EN (необязательно)
                <textarea name="captionEn" defaultValue={asset.captionEn ?? ""} disabled={!mayEdit} rows={3} />
              </label>
            </div>
            <div className="form-two-columns">
              <label>
                Правообладатель
                <input
                  name="copyrightHolder"
                  defaultValue={asset.copyrightHolder ?? ""}
                  disabled={!mayEdit}
                />
              </label>
              <label>
                URL источника
                <input
                  name="sourceUrl"
                  type="url"
                  defaultValue={asset.sourceUrl ?? ""}
                  disabled={!mayEdit}
                />
              </label>
            </div>
            {mayEdit ? (
              <button className="primary-button" type="submit">
                <Save aria-hidden="true" />
                Сохранить
              </button>
            ) : null}
          </form>
        </section>
      </div>

      <section className="usage-panel">
        <div className="panel-title">
          <div>
            <h2>Где используется</h2>
            <p>Связи с материалами и сущностями платформы.</p>
          </div>
          <span className="real-count">{usages.length}</span>
        </div>
        {usages.length > 0 ? (
          <ul className="usage-list">
            {usages.map((usage) => (
              <li key={usage.id}>
                <Link2 aria-hidden="true" />
                <span>{usage.entityType}</span>
                <code>{usage.entityId}</code>
                <small>{usage.fieldName}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="usage-empty">Файл пока не связан с другими объектами.</p>
        )}
      </section>

      {mayDelete ? (
        <section className="danger-zone">
          <div>
            <h2>Перенести в удалённые</h2>
            <p>Файл останется в Storage и сможет быть восстановлен.</p>
          </div>
          <form action={deleteAction}>
            <label className="confirm-check">
              <input type="checkbox" name="confirm" value="yes" required />
              Подтверждаю действие
            </label>
            <button className="danger-button" type="submit">
              <Trash2 aria-hidden="true" />
              Удалить
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
