"use client";

import { useRef, useState, useTransition } from "react";
import { uploadEmailImageAction } from "@/app/actions";

/**
 * Téléverse une image et rend son URL publique à l'appelant.
 * Le fichier part dans un bucket Supabase public : un client mail n'a pas de
 * session, l'image doit être lisible sans authentification.
 */
export function ImageUploadButton({
  label = "Ajouter une image",
  onUploaded,
}: {
  label?: string;
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const res = await uploadEmailImageAction(fd);
      setMessage({ ok: res.ok, text: res.message });
      if (res.ok && res.url) onUploaded(res.url);
      if (inputRef.current) inputRef.current.value = ""; // permet de renvoyer le même fichier
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isPending}
        className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted disabled:opacity-50"
      >
        {isPending ? "Envoi…" : label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        onChange={pick}
        className="hidden"
      />
      {message && (
        <span
          className={
            message.ok ? "text-[11px] text-amber-700" : "text-[11px] text-red-600"
          }
        >
          {message.text}
        </span>
      )}
    </>
  );
}
