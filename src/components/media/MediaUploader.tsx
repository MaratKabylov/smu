"use client";

import { useRef, useState } from "react";
import { CheckCircle2, ImagePlus, LoaderCircle, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import {
  ARTICLE_MEDIA_MAX_BYTES,
  ARTICLE_MEDIA_MIME_TYPES,
} from "@/lib/validation/media";

type UploadState = "idle" | "preparing" | "uploading" | "complete" | "error";

type UploadTicket = {
  mediaAssetId: string;
  bucket: "article-media";
  path: string;
  token: string;
};

async function getImageDimensions(file: File) {
  try {
    const bitmap = await createImageBitmap(file);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dimensions;
  } catch {
    return { width: null, height: null };
  }
}

export function MediaUploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [message, setMessage] = useState("");

  async function upload(file: File) {
    if (
      !ARTICLE_MEDIA_MIME_TYPES.includes(
        file.type as (typeof ARTICLE_MEDIA_MIME_TYPES)[number],
      )
    ) {
      setState("error");
      setMessage("Поддерживаются JPG, PNG, WebP и GIF.");
      return;
    }

    if (file.size > ARTICLE_MEDIA_MAX_BYTES) {
      setState("error");
      setMessage("Размер файла не должен превышать 15 МБ.");
      return;
    }

    try {
      setState("preparing");
      setMessage("Проверяем файл…");
      const dimensions = await getImageDimensions(file);
      const ticketResponse = await fetch("/api/admin/media/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          bucket: "article-media",
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
          ...dimensions,
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
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept={ARTICLE_MEDIA_MIME_TYPES.join(",")}
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
