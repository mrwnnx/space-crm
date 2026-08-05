"use client";

import { useState, useTransition } from "react";
import { saveWpConnectionAction, testWpConnectionAction } from "@/app/actions";

type PublicConnection = {
  siteUrl: string;
  username: string;
  hasPassword: boolean;
  lastTestedAt: Date | null;
  lastTestOk: boolean | null;
  lastTestMessage: string | null;
};

export function WpConnectionForm({ connection }: { connection: PublicConnection | null }) {
  const [siteUrl, setSiteUrl] = useState(connection?.siteUrl ?? "https://thespace.academy");
  const [username, setUsername] = useState(connection?.username ?? "");
  const [appPassword, setAppPassword] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData();
    formData.set("siteUrl", siteUrl);
    formData.set("username", username);
    formData.set("appPassword", appPassword);
    startTransition(async () => {
      const res = await saveWpConnectionAction(formData);
      setFeedback(res);
      if (res.ok) setAppPassword("");
    });
  }

  function test() {
    startTransition(async () => {
      setFeedback(await testWpConnectionAction());
    });
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Field
        label="URL du site"
        value={siteUrl}
        onChange={setSiteUrl}
        placeholder="https://thespace.academy"
      />
      <Field
        label="Nom d'utilisateur WordPress"
        value={username}
        onChange={setUsername}
        placeholder="marwen"
      />
      <div>
        <label className="mb-1 block text-xs font-medium text-foreground">
          Application Password
        </label>
        <input
          type="password"
          value={appPassword}
          onChange={(e) => setAppPassword(e.target.value)}
          placeholder={
            connection?.hasPassword
              ? "•••• enregistré — laisser vide pour le conserver"
              : "xxxx xxxx xxxx xxxx xxxx xxxx"
          }
          autoComplete="new-password"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"
        />
        <p className="mt-1 text-[10px] text-muted-foreground/60">
          WordPress → Utilisateurs → Profil → Application Passwords. Il n'est jamais
          réaffiché après enregistrement.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-foreground px-3 py-2 text-xs font-medium text-background disabled:opacity-50"
        >
          {isPending ? "..." : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={test}
          disabled={isPending || !connection?.hasPassword}
          className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground disabled:opacity-40"
        >
          Tester la connexion
        </button>
      </div>

      {feedback && (
        <p
          className={`rounded-lg px-3 py-2 text-xs ${
            feedback.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {feedback.message}
        </p>
      )}

      {!feedback && connection?.lastTestedAt && (
        <p className="text-[10px] text-muted-foreground/70">
          Dernier test {new Date(connection.lastTestedAt).toLocaleString("fr-FR")} —{" "}
          <span className={connection.lastTestOk ? "text-green-700" : "text-red-700"}>
            {connection.lastTestMessage}
          </span>
        </p>
      )}
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-foreground">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"
      />
    </div>
  );
}
