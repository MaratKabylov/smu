import { BookOpenText, Plus, ShieldCheck } from "lucide-react";
import { canCreateArticle } from "@/lib/permissions/permissions";
import { getAdminAccess } from "@/server/services/access.service";

export default async function ArticlesPage() {
  const result = await getAdminAccess();
  const mayCreate = result.state === "allowed" && canCreateArticle(result.access);

  return (
    <div className="content-page">
      <nav className="breadcrumbs" aria-label="Хлебные крошки">
        <span>Контент</span>
        <span>/</span>
        <strong>Статьи</strong>
      </nav>

      <div className="page-heading">
        <div>
          <p className="page-kicker">Журнал СМУ</p>
          <h1>Статьи</h1>
          <p>Редакционные материалы и их версии на русском и казахском.</p>
        </div>
        {mayCreate ? (
          <button className="primary-button" disabled title="Этап Articles">
            <Plus aria-hidden="true" />
            Создать статью
          </button>
        ) : null}
      </div>

      <section className="data-panel" aria-labelledby="articles-table-title">
        <div className="data-panel-header">
          <div>
            <h2 id="articles-table-title">Все материалы</h2>
            <p>Рабочая область подготовлена без демонстрационных данных.</p>
          </div>
          <span className="foundation-badge">
            <ShieldCheck aria-hidden="true" />
            RBAC включен
          </span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Заголовок</th>
                <th>Язык</th>
                <th>Тип</th>
                <th>Автор</th>
                <th>Статус</th>
                <th>Обновлено</th>
              </tr>
            </thead>
          </table>
          <div className="empty-state">
            <span className="empty-icon">
              <BookOpenText aria-hidden="true" />
            </span>
            <h3>Модель статей — следующий этап</h3>
            <p>
              Сначала подключите Supabase и проверьте роли. Затем здесь появятся
              CRUD, RU/KK-переводы и редакционный workflow.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
