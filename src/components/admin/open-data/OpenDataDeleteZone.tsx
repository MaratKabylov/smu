"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { openDataErrorMessage } from "@/lib/open-data-constants";

type Props = {
  title: string;
  description: string;
  confirmLabel: string;
  buttonLabel: string;
  redirectTo: string;
  onDelete: () => Promise<{ success?: boolean; error?: string }>;
};

export function OpenDataDeleteZone({
  title,
  description,
  confirmLabel,
  buttonLabel,
  redirectTo,
  onDelete,
}: Props) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!confirmed) return;

    setError(null);
    startTransition(async () => {
      const result = await onDelete();
      if (result.error) {
        setError(openDataErrorMessage(result.error));
        return;
      }
      router.push(redirectTo);
      router.refresh();
    });
  };

  return (
    <>
      {error ? (
        <div role="alert" className="notice error-notice" style={{ marginTop: "20px" }}>
          {error}
        </div>
      ) : null}

      <section className="danger-zone opendata-danger-zone">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <form onSubmit={handleSubmit}>
          <label className="confirm-check">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={isPending}
              required
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>{confirmLabel}</span>
          </label>
          <button
            type="submit"
            className="danger-button"
            disabled={!confirmed || isPending}
          >
            <Trash2 size={15} aria-hidden="true" />
            <span>{isPending ? "Удаление…" : buttonLabel}</span>
          </button>
        </form>
      </section>
    </>
  );
}
