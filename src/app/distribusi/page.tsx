/**
 * @fileoverview Halaman Ruang Kerja Petugas Distribusi.
 * Rute: /distribusi
 */

import type { Metadata } from "next";
import { DeliveryWorkspace } from "@/features/delivery/components/delivery-workspace";

export const metadata: Metadata = {
  title: "Petugas Distribusi & Handover Bangsal | HPNMS",
  description:
    "Ruang kerja operasional Petugas Distribusi untuk pengelompokan troli bangsal, verifikasi dua identitas pasien (AB-020), pemeriksaan diet terkini (AB-021), penyerahan makanan (AB-023), penahanan klinis, dan laporan insiden.",
};

export default function WorkspacePage() {
  return <DeliveryWorkspace />;
}

