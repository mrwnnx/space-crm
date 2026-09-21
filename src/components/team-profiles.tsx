"use client";

import { createContext, useContext, type ReactNode } from "react";
import { actorName } from "@/lib/actors";
import { cn, isHumanActor } from "@/lib/utils";
import type { TeamProfile } from "@/lib/profiles";

/**
 * Les profils de l'équipe, disponibles partout où un auteur s'affiche.
 *
 * Chargés une fois par le layout du dashboard (trois comptes, une requête) et
 * distribués par contexte : le fil d'activité, le kanban, l'échéancier ou la
 * boîte WhatsApp traduisent un email en nom sans requête supplémentaire.
 */
type Resolved = { name: string; avatarUrl: string | null; initials: string };

type Ctx = {
  resolve: (email: string | null | undefined) => Resolved;
  me: TeamProfile | null;
};

const TeamProfilesContext = createContext<Ctx>({
  resolve: (email) => fallback(email),
  me: null,
});

export function initialsOf(name: string): string {
  // `Array.from` et non `[0]` : un emoji en tête casserait l'hydratation.
  return name
    .split(/[.\-_\s]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => Array.from(p)[0]!.toUpperCase())
    .join("");
}

/** Sans profil : le nom codé en dur (« Marwen », « Fatma »), sinon l'avant-@. */
function fallback(email: string | null | undefined): Resolved {
  const name = actorName(email ?? null);
  return { name, avatarUrl: null, initials: initialsOf(name) };
}

export function TeamProfilesProvider({
  profiles,
  me,
  children,
}: {
  profiles: TeamProfile[];
  me: string | null;
  children: ReactNode;
}) {
  const byEmail = new Map(profiles.map((p) => [p.email.toLowerCase(), p]));
  const resolve = (email: string | null | undefined): Resolved => {
    const p = email ? byEmail.get(email.toLowerCase()) : undefined;
    if (!p) return fallback(email);
    const name = p.name ?? fallback(email).name;
    return { name, avatarUrl: p.avatarUrl, initials: initialsOf(name) };
  };
  const mine = me ? byEmail.get(me.toLowerCase()) ?? { email: me, name: null, avatarUrl: null } : null;
  return (
    <TeamProfilesContext.Provider value={{ resolve, me: mine }}>
      {children}
    </TeamProfilesContext.Provider>
  );
}

export function useTeamProfiles() {
  return useContext(TeamProfilesContext);
}

/** La pastille d'un auteur : sa photo si elle existe, sinon ses initiales. */
export function ActorAvatar({
  email,
  size = 16,
  className,
}: {
  email: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const { resolve } = useTeamProfiles();
  if (!isHumanActor(email)) return null;
  const { name, avatarUrl, initials } = resolve(email);
  const style = { width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.55)) };
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URL du bucket public, déjà réduite à 256 px
      <img
        src={avatarUrl}
        alt={name}
        title={name}
        style={style}
        className={cn("shrink-0 rounded-full object-cover", className)}
      />
    );
  }
  return (
    <span
      title={name}
      style={style}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary",
        className
      )}
    >
      {initials}
    </span>
  );
}
