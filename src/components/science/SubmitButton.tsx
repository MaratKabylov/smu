"use client";
import { useFormStatus } from "react-dom";
export function SubmitButton({ label, pendingLabel = "Сохранение…" }: { label: string; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="primary-button" disabled={pending}>{pending ? pendingLabel : label}</button>;
}
