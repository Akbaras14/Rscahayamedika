/**
 * @fileoverview Pembungkus ikon semantik Lucide React sesuai peta wajib UI_UX.md Bagian 5.1.
 * Menjamin ukuran konsisten (16-20px) dan atribut aksesibilitas (`aria-hidden` atau `aria-label`).
 */

import {
  ArrowLeft,
  Ban,
  Bell,
  CalendarDays,
  CircleCheck,
  Download,
  History,
  LayoutDashboard,
  ListFilter,
  Package,
  Pencil,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Truck,
  Users,
  X,
  type LucideProps,
} from "lucide-react";

export const PETA_IKON_SEMANTIK = {
  LayoutDashboard,
  Users,
  Search,
  Plus,
  Save,
  Pencil,
  Trash2,
  ArrowLeft,
  Bell,
  CalendarDays,
  Package,
  Truck,
  ShieldCheck,
  TriangleAlert,
  Ban,
  CircleCheck,
  History,
  ListFilter,
  Download,
  X,
} as const;

export type NamaIkonSemantik = keyof typeof PETA_IKON_SEMANTIK;

export interface SemanticIconProps extends Omit<LucideProps, "ref"> {
  nama: NamaIkonSemantik;
  labelAksesibel?: string;
}

/**
 * Menampilkan ikon semantik Lucide yang telah disetujui dalam design system HPNMS.
 */
export function SemanticIcon({
  nama,
  labelAksesibel,
  className = "size-4 shrink-0",
  ...props
}: SemanticIconProps) {
  const KomponenIkon = PETA_IKON_SEMANTIK[nama];
  if (labelAksesibel) {
    return (
      <KomponenIkon
        role="img"
        aria-label={labelAksesibel}
        className={className}
        {...props}
      />
    );
  }
  return <KomponenIkon aria-hidden="true" className={className} {...props} />;
}

