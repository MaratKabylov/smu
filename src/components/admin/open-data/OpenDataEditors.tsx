import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { canManageOpenData } from "@/lib/permissions/permissions";
import { openDataCategoryStatusLabels } from "@/lib/open-data-constants";
import { getAdminAccess } from "@/server/services/access.service";
import { OpenDataService } from "@/server/services/open-data.service";
import { OpenDataMetricForm } from "./OpenDataMetricForm";
import { OpenDataCategoryForm } from "./OpenDataCategoryForm";
import { OpenDataUpdateForm } from "./OpenDataUpdateForm";

const basePath = "/admin/science/open-data";

async function requireOpenDataAccess() {
  const access = await getAdminAccess();
  if (access.state === "unauthenticated") redirect("/admin/login");
  if (access.state !== "allowed" || !canManageOpenData(access.access)) {
    notFound();
  }
  return access.access;
}

export async function OpenDataMetricAdminEditor({ id }: { id?: string }) {
  const access = await requireOpenDataAccess();
  if (id && !z.uuid().safeParse(id).success) notFound();

  const service = new OpenDataService();
  const [metric, existingMetrics] = await Promise.all([
    id ? service.getMetricById(access, id) : Promise.resolve(null),
    id ? Promise.resolve([]) : service.listMetrics(access),
  ]);

  if (id && !metric) notFound();

  const backHref = `${basePath}?tab=metrics`;
  const title = metric ? metric.title_ru : "Новый показатель";

  return (
    <div className="content-page">
      <nav className="breadcrumbs" aria-label="Хлебные крошки">
        <span>Наука</span>
        <span>/</span>
        <Link href={basePath}>Open Data Aktobe</Link>
        <span>/</span>
        <Link href={backHref}>Показатели</Link>
        <span>/</span>
        <strong>{metric ? "Редактирование" : "Создание"}</strong>
      </nav>

      <div className="page-heading media-page-heading">
        <div>
          <p className="page-kicker">Open Data Aktobe · Показатели</p>
          <h1>{title}</h1>
          <p>
            {metric
              ? "Редактирование информационного показателя, единиц измерения и правил отображения."
              : "Добавьте показатель для отображения на странице /open-data и в блоке на главной."}
          </p>
        </div>
        <div className="heading-actions">
          <Link href={backHref} className="secondary-button">
            <ArrowLeft size={16} aria-hidden="true" />
            <span>К показателям</span>
          </Link>
        </div>
      </div>

      <OpenDataMetricForm
        metric={metric}
        defaultSortOrder={existingMetrics.length + 1}
      />
    </div>
  );
}

export async function OpenDataCategoryAdminEditor({ id }: { id?: string }) {
  const access = await requireOpenDataAccess();
  if (id && !z.uuid().safeParse(id).success) notFound();

  const service = new OpenDataService();
  const [category, existingCategories] = await Promise.all([
    id ? service.getCategoryById(access, id) : Promise.resolve(null),
    id ? Promise.resolve([]) : service.listCategories(access),
  ]);

  if (id && !category) notFound();

  const backHref = `${basePath}?tab=categories`;
  const title = category ? category.title_ru : "Новая категория данных";

  return (
    <div className="content-page">
      <nav className="breadcrumbs" aria-label="Хлебные крошки">
        <span>Наука</span>
        <span>/</span>
        <Link href={basePath}>Open Data Aktobe</Link>
        <span>/</span>
        <Link href={backHref}>Категории</Link>
        <span>/</span>
        <strong>{category ? "Редактирование" : "Создание"}</strong>
      </nav>

      <div className="page-heading media-page-heading">
        <div>
          <p className="page-kicker">Open Data Aktobe · Категории</p>
          <h1>{title}</h1>
          <p>
            {category
              ? `Текущий статус: ${openDataCategoryStatusLabels.ru[category.status] ?? category.status}. Управление описанием, количеством наборов и отображением.`
              : "Создайте новое тематическое направление сбора научных данных Актюбинской области."}
          </p>
        </div>
        <div className="heading-actions">
          <Link href={backHref} className="secondary-button">
            <ArrowLeft size={16} aria-hidden="true" />
            <span>К категориям</span>
          </Link>
        </div>
      </div>

      <OpenDataCategoryForm
        category={category}
        defaultSortOrder={existingCategories.length + 1}
      />
    </div>
  );
}

export async function OpenDataUpdateAdminEditor({ id }: { id?: string }) {
  const access = await requireOpenDataAccess();
  if (id && !z.uuid().safeParse(id).success) notFound();

  const service = new OpenDataService();
  const [update, categories] = await Promise.all([
    id ? service.getUpdateById(access, id) : Promise.resolve(null),
    service.listCategories(access),
  ]);

  if (id && !update) notFound();

  const backHref = `${basePath}?tab=updates`;
  const title = update ? update.title_ru : "Новое поступление данных";

  return (
    <div className="content-page">
      <nav className="breadcrumbs" aria-label="Хлебные крошки">
        <span>Наука</span>
        <span>/</span>
        <Link href={basePath}>Open Data Aktobe</Link>
        <span>/</span>
        <Link href={backHref}>Поступления данных</Link>
        <span>/</span>
        <strong>{update ? "Редактирование" : "Создание"}</strong>
      </nav>

      <div className="page-heading media-page-heading">
        <div>
          <p className="page-kicker">Open Data Aktobe · Поступления</p>
          <h1>{title}</h1>
          <p>
            {update
              ? "Редактирование записи о поступившем наборе данных, источнике и периоде охвата."
              : "Зарегистрируйте новый научный набор данных для ленты последних поступлений."}
          </p>
        </div>
        <div className="heading-actions">
          <Link href={backHref} className="secondary-button">
            <ArrowLeft size={16} aria-hidden="true" />
            <span>К поступлениям</span>
          </Link>
        </div>
      </div>

      {categories.length === 0 ? (
        <div className="notice error-notice" role="alert">
          Сначала создайте хотя бы одну категорию данных во вкладке{" "}
          <Link href={`${basePath}?tab=categories`} style={{ fontWeight: 700 }}>
            «Категории»
          </Link>
          .
        </div>
      ) : null}

      <OpenDataUpdateForm update={update} categories={categories} />
    </div>
  );
}
