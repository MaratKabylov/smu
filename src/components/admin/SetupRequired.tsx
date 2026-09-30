import { Check, Copy, Database, ShieldCheck } from "lucide-react";

export function SetupRequired() {
  return (
    <main className="setup-page">
      <section className="setup-card">
        <div className="setup-eyebrow">
          <ShieldCheck aria-hidden="true" />
          Этап 1 · Foundation
        </div>
        <h1>Основа админ-панели готова к подключению</h1>
        <p className="setup-lead">
          Интерфейс не открывает административные данные, пока Supabase и
          серверная проверка ролей не настроены. Это безопасное состояние для
          первого запуска.
        </p>

        <div className="setup-grid">
          <article>
            <span className="setup-step">01</span>
            <Database aria-hidden="true" />
            <h2>Примените миграцию</h2>
            <p>
              Создайте проект Supabase и выполните миграцию RBAC из каталога
              supabase/migrations.
            </p>
          </article>
          <article>
            <span className="setup-step">02</span>
            <Copy aria-hidden="true" />
            <h2>Заполните окружение</h2>
            <p>
              Скопируйте .env.example в .env.local и добавьте URL и ключи
              проекта.
            </p>
          </article>
          <article>
            <span className="setup-step">03</span>
            <Check aria-hidden="true" />
            <h2>Назначьте роль</h2>
            <p>
              Добавьте первому пользователю super_admin. Дальше роли
              управляются только на сервере.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
