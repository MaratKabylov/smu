import { LockKeyhole } from "lucide-react";
import { login } from "@/server/actions/auth.actions";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

const errorMessages: Record<string, string> = {
  setup: "Сначала подключите Supabase в .env.local.",
  invalid: "Проверьте email и пароль. Пароль должен быть не короче 8 символов.",
  credentials: "Не удалось войти с указанными данными.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;

  return (
    <main className="login-page admin-login-page">
      <div className="admin-login-shell">
        <section className="admin-login-intro" aria-label="Административная панель СМУ">
          <div className="login-mark">СМУ</div>
          <p>Административная панель</p>
          <h1>Управление научной платформой</h1>
          <span>
            Контент, профили ученых, исследовательские программы и доступы — в единой рабочей среде.
          </span>
          <div className="admin-login-orbit" aria-hidden="true" />
        </section>

        <section className="login-card admin-login-card">
          <p className="login-kicker">Защищенная зона</p>
          <h2>Вход в SMU Admin</h2>
          <p>Используйте учетную запись с доступом к панели управления.</p>

          {error ? (
            <div className="form-error" role="alert">
              {errorMessages[error] ?? "Произошла ошибка входа."}
            </div>
          ) : null}

          <form action={login} className="login-form">
            <label>
              Email
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              Пароль
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                minLength={8}
                required
              />
            </label>
            <button type="submit">
              <LockKeyhole aria-hidden="true" />
              Войти
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
