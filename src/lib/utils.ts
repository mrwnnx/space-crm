import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const STATUS_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
  gray: { dot: "bg-gray-400", bg: "bg-gray-50", text: "text-gray-700" },
  blue: { dot: "bg-blue-500", bg: "bg-blue-50", text: "text-blue-700" },
  purple: { dot: "bg-purple-500", bg: "bg-purple-50", text: "text-purple-700" },
  green: { dot: "bg-green-500", bg: "bg-green-50", text: "text-green-700" },
  "dark-green": { dot: "bg-emerald-600", bg: "bg-emerald-50", text: "text-emerald-700" },
  red: { dot: "bg-red-500", bg: "bg-red-50", text: "text-red-700" },
  orange: { dot: "bg-orange-500", bg: "bg-orange-50", text: "text-orange-700" },
  amber: { dot: "bg-amber-500", bg: "bg-amber-50", text: "text-amber-700" },
};

export function statusColor(color: string) {
  return STATUS_COLORS[color] ?? STATUS_COLORS.gray;
}

export function initials(name: string): string {
  return (
    name
      .split(" ")
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

export function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatRelative(date: Date | string | null): string {
  if (!date) return "Jamais";
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  if (days < 7) return `Il y a ${days}j`;
  if (days < 30) return `Il y a ${Math.floor(days / 7)}sem`;
  return formatDate(d);
}
