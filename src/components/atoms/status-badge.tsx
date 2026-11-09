/**
 * @fileoverview Komponen Atom `StatusBadge` untuk menampilkan status operasional dan keselamatan.
 * Mengikuti UI_UX.md Bagian 11: selalu menampilkan teks + ikon semantik (tidak mengandalkan warna saja),
 * serta membedakan `Belum dicatat` dari `0% dikonsumsi`.
 */

import { cn } from "@/lib/utils";
import { type NamaIkonSemantik, SemanticIcon } from "./semantic-icon";

export type VarianStatusBadge =
  | "sesuai"
  | "menunggu"
  | "ditahan"
  | "belum_dicatat"
  | "konsumsi_nol"
  | "netral";

export interface StatusBadgeProps {
  varian: VarianStatusBadge;
  label: string;
  className?: string;
}

const KONFIGURASI_VARIAN: Record<
  VarianStatusBadge,
  {
    kelasWarna: string;
    ikon: NamaIkonSemantik;
  }
> = {
  sesuai: {
    kelasWarna: "border-emerald-200 bg-emerald-50/90 text-emerald-700 font-medium",
    ikon: "CircleCheck",
  },
  menunggu: {
    kelasWarna: "border-amber-200 bg-amber-50/90 text-amber-700 font-medium",
    ikon: "TriangleAlert",
  },
  ditahan: {
    kelasWarna: "border-rose-200 bg-rose-50/95 text-rose-700 font-semibold",
    ikon: "Ban",
  },
  belum_dicatat: {
    kelasWarna: "border-slate-200 bg-slate-100/90 text-slate-700 font-medium",
    ikon: "History",
  },
  konsumsi_nol: {
    kelasWarna: "border-amber-300 bg-amber-100/80 text-amber-900 font-semibold",
    ikon: "TriangleAlert",
  },
  netral: {
    kelasWarna: "border-blue-100 bg-blue-50/80 text-[#1a6bff] font-medium",
    ikon: "ShieldCheck",
  },
};

/**
 * Menampilkan badge status yang aksesibel dengan ikon dan teks eksplisit.
 */
export function StatusBadge({ varian, label, className }: StatusBadgeProps) {
  const konfig = KONFIGURASI_VARIAN[varian];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] leading-5 shadow-2xs",
        konfig.kelasWarna,
        className,
      )}
    >
      <SemanticIcon nama={konfig.ikon} className="size-3.5 shrink-0" />
      <span>{label}</span>
    </span>
  );
}

