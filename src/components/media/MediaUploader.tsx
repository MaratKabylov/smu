"use client";

import { useRef, useState } from "react";
import { CheckCircle2, ImagePlus, LoaderCircle, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { isMediaFileAllowed, mediaBucketRules } from "@/lib/validation/media";
import { mediaBuckets, type MediaBucket } from "@/types/domain/media";

type UploadState = "idle" | "preparing" | "uploading" | "complete" | "error";

type UploadTicket = {
  mediaAssetId: string;
  bucket: "media-staging";
  path: string;
  token: string;
};

export function MediaUploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [message, setMessage] = useState("");
  const [bucket, setBucket] = useState<MediaBucket>("article-media");
  const rule = mediaBucketRules[bucket];

  async function upload(file: File) {
    if (!isMediaFileAllowed(bucket, file.name, file.type, file.size)) {
      setState("error");
      setMessage(`Проверьте формат файла. Максимальный размер: ${rule.maxBytes / 1024 / 1024} МБ.`);
      return;
    }

    try {
      setState("preparing");
      setMessage("Проверяем файл…");
      const ticketResponse = await fetch("/api/admin/media/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          bucket,
        }),
      });

      if (!ticketResponse.ok) throw new Error("ticket");
      const ticket = (await ticketResponse.json()) as UploadTicket;

      setState("uploading");
      setMessage("Загружаем в медиатеку…");
      const client = createBrowserSupabaseClient();
      const { error: uploadError } = await client.storage
        .from(ticket.bucket)
        .uploadToSignedUrl(ticket.path, ticket.token, file, {
          contentType: file.type,
          cacheControl: "3600",
        });

      if (uploadError) throw uploadError;

      const completeResponse = await fetch("/api/admin/media/uploads/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaAssetId: ticket.mediaAssetId,
        }),
      });

      if (!completeResponse.ok) throw new Error("complete");

      setState("complete");
      setMessage("Файл добавлен в медиатеку.");
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch {
      setState("error");
      setMessage("Не удалось загрузить файл. Попробуйте ещё раз.");
    }
  }

  const busy = state === "preparing" || state === "uploading";

  return (
    <div className="media-uploader">
      <label>
        Назначение файла
        <select value={bucket} disabled={busy} onChange={event => {
          setBucket(event.target.value as MediaBucket);
          setMessage(""); setState("idle");
          if (inputRef.current) inputRef.current.value = "";
        }}>
          {mediaBuckets.map(value => <option key={value} value={value}>{mediaBucketRules[value].label}</option>)}
        </select>
      </label>
      <small>До {rule.maxBytes / 1024 / 1024} МБ · {rule.mimeTypes.map(mime => mime.split("/").at(-1) === "vnd.openxmlformats-officedocument.wordprocessingml.document" ? "DOCX" : mime.split("/").at(-1)?.toUpperCase()).join(", ")}</small>
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept={rule.mimeTypes.join(",")}
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <button
        className="primary-button"
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? (
          <LoaderCircle className="spin" aria-hidden="true" />
        ) : (
          <UploadCloud aria-hidden="true" />
        )}
        {busy ? "Загрузка…" : "Загрузить файл"}
      </button>

      {message ? (
        <div className={`upload-message is-${state}`} aria-live="polite">
          {state === "complete" ? (
            <CheckCircle2 aria-hidden="true" />
          ) : (
            <ImagePlus aria-hidden="true" />
          )}
          {message}
        </div>
      ) : null}
    </div>
  );
}
