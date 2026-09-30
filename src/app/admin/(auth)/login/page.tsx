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
    <main className="login-page">
      <section className="login-card">
        <div className="login-mark">СМУ</div>
        <p className="login-kicker">Защищенная зона</p>
        <h1>Вход в SMU Admin</h1>
        <p>
          Управление учеными, материалами и исследовательскими программами.
        </p>

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
    </main>
  );
}
