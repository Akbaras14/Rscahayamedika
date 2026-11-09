/**
 * @fileoverview Halaman Ruang Kerja Kepala Instalasi Gizi.
 */

import type { Metadata } from "next";
import { HeadNutritionWorkspace } from "@/features/head-nutrition/components/head-nutrition-workspace";

export const metadata: Metadata = {
  title: "Kepala Instalasi Gizi | HPNMS",
  description:
    "Pengawasan mutu gizi, investigasi akar masalah insiden (RCA), tindakan korektif tertutup, evaluasi sisa makanan bangsal, dan rekonsiliasi downtime.",
};

export default function WorkspacePage() {
  return <HeadNutritionWorkspace />;
}

