import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(value: unknown) {
  if (typeof value !== "number") return "-";
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatDateTime(value: unknown) {
  if (!value || typeof value !== "string") return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function compactText(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}
