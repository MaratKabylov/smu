"use client";
import { useFormStatus } from "react-dom";
export function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="primary-button" disabled={pending}>{pending ? "Сохранение…" : label}</button>;
}
