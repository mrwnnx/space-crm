"use client";

import { useRef, useState, useTransition } from "react";
import { updateProfileAction } from "@/app/actions";

type Me = { email: string; name: string | null; avatarUrl: string | null };

/** Côté navigateur : la photo est recadrée au carré et réduite à 256 px avant
 *  d'être envoyée — un portrait d'iPhone fait 4 Mo pour finir en pastille de
 *  22 px. Le serveur ne reçoit qu'un JPEG de quelques dizaines de Ko. */
const SIDE = 256;
async function shrink(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = SIDE;
  canvas.height = SIDE;
  const ctx = canvas.getContext("2d")!;
  const s = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - s) / 2;
  const sy = (bitmap.height - s) / 2;
  ctx.drawImage(bitmap, sx, sy, s, s, 0, 0, SIDE, SIDE);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  if (!blob) throw new Error("Impossible de traiter cette image.");
  return new File([blob], "avatar.jpg", { type: "image/jpeg" });
}

export function ProfileForm({ me }: { me: Me }) {
  const [name, setName] = useState(me.name ?? "");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(me.avatarUrl);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function pickFile(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    try {
      const small = await shrink(file);
      setAvatar(small);
      setPreview(URL.createObjectURL(small));
    } catch {
      setMessage({ ok: false, text: "Image illisible — choisissez un JPG, PNG ou WebP." });
    }
  }

  function save() {
    setMessage(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("name", name);
      if (avatar) fd.set("avatar", avatar);
      const res = await updateProfileAction(fd);
      if ("error" in res) {
        setMessage({ ok: false, text: res.error ?? "Enregistrement impossible." });
        return;
      }
      setAvatar(null);
      if (res.avatarUrl) setPreview(res.avatarUrl);
      setMessage({ ok: true, text: "Profil enregistré." });
    });
  }

  const initials = (name.trim() || me.email).slice(0, 1).toUpperCase();

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          title="Changer la photo"
          className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-primary/10 text-xl font-semibold text-primary"
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- aperçu local ou URL du bucket
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center">{initials}</span>
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
            Changer
          </span>
        </button>
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {preview ? "Changer la photo" : "Ajouter une photo"}
          </button>
          <p className="mt-1 text-[12px] text-muted-foreground">JPG, PNG ou WebP. Recadrée en carré.</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => pickFile(e.target.files?.[0])}
            className="hidden"
          />
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-[12px] text-muted-foreground">Nom affiché</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="Prénom Nom"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
      </label>

      <p className="text-[12px] text-muted-foreground">
        Compte : <span className="text-foreground">{me.email}</span>
      </p>

      {message && (
        <p
          className={
            message.ok
              ? "rounded-lg border border-green-500/30 bg-green-500/5 p-3 text-xs text-green-700"
              : "rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-600"
          }
        >
          {message.text}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}
