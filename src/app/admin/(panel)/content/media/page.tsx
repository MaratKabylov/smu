import { FileSearch, Search } from "lucide-react";
import Link from "next/link";
import {
  canCreateMedia,
  canViewMedia,
} from "@/lib/permissions/permissions";
import { mediaListFiltersSchema } from "@/lib/validation/media";
import { MediaPreview } from "@/components/media/MediaPreview";
import { MediaUploader } from "@/components/media/MediaUploader";
import { getAdminAccess } from "@/server/services/access.service";
import { MediaService } from "@/server/services/media.service";

type MediaPageProps = {
  searchParams: Promise<{
    q?: string;
    type?: string;
    deleted?: string;
  }>;
};

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

export default async function MediaPage({ searchParams }: MediaPageProps) {
  const accessResult = await getAdminAccess();
  if (accessResult.state !== "allowed") return null;

  if (!canViewMedia(accessResult.access)) {
    return (
      <section className="inline-state">
        <p className="state-code">403</p>
        <h1>Нет доступа к медиатеке</h1>
      </section>
    );
  }

  const params = await searchParams;
  const parsedFilters = mediaListFiltersSchema.safeParse({
    query: params.q ?? "",
    type: params.type ?? "all",
  });
  const filters = parsedFilters.success
    ? parsedFilters.data
    : { query: "", type: "all" as const };
  const assets = await new MediaService().list(accessResult.access, filters);
  const mayUpload = canCreateMedia(accessResult.access);

  return (
    <div className="content-page">
      <nav className="breadcrumbs" aria-label="Хлебные крошки">
        <span>Контент</span>
        <span>/</span>
        <strong>Медиа</strong>
      </nav>

      <div className="page-heading media-page-heading">
        <div>
          <p className="page-kicker">Централизованная библиотека</p>
          <h1>Медиа</h1>
          <p>Изображения и файлы, связанные с материалами платформы.</p>
        </div>
        {mayUpload ? <MediaUploader /> : null}
      </div>

      {params.deleted === "1" ? (
        <div className="notice success-notice">Файл перенесён в удалённые.</div>
      ) : null}

      <section className="media-toolbar" aria-label="Фильтры медиатеки">
        <form className="media-filters" action="/admin/content/media">
          <label className="search-field">
            <Search aria-hidden="true" />
            <span className="visually-hidden">Поиск по имени файла</span>
            <input
              type="search"
              name="q"
              defaultValue={filters.query}
              placeholder="Найти по имени файла"
            />
          </label>
          <label>
            <span className="visually-hidden">Тип файла</span>
            <select name="type" defaultValue={filters.type}>
              <option value="all">Все типы</option>
              <option value="image">Изображения</option>
              <option value="video">Видео</option>
              <option value="document">Документы</option>
            </select>
          </label>
          <button className="secondary-button" type="submit">
            Применить
          </button>
        </form>
        <span className="real-count">{assets.length} файлов</span>
      </section>

      {assets.length > 0 ? (
        <section className="media-grid" aria-label="Файлы медиатеки">
          {assets.map((asset) => (
            <Link
              className="media-card"
              href={`/admin/content/media/${asset.id}`}
              key={asset.id}
            >
              <MediaPreview asset={asset} />
              <div className="media-card-body">
                <strong title={asset.fileName}>{asset.fileName}</strong>
                <span>
                  {formatFileSize(asset.fileSize)} · {asset.storageBucket}
                </span>
                <small>
                  {asset.usageCount > 0
                    ? `Используется: ${asset.usageCount}`
                    : "Пока не используется"}
                </small>
              </div>
            </Link>
          ))}
        </section>
      ) : (
        <section className="data-panel media-empty-panel">
          <div className="empty-state">
            <span className="empty-icon">
              <FileSearch aria-hidden="true" />
            </span>
            <h2>{filters.query ? "Ничего не найдено" : "Медиатека пока пуста"}</h2>
            <p>
              {filters.query
                ? "Измените запрос или сбросьте фильтр типа файла."
                : "Загрузите первое изображение для будущих статей Журнала СМУ."}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
