/**
 * @fileoverview Halaman Next.js App Router untuk Peran Petugas Gudang (`/gudang`).
 * Menyediakan ruang kerja manajemen inventaris bahan baku: pemeriksaan kualitas & suhu (AB-015),
 * pemantauan stok layak vs dialokasikan (AB-016), pengeluaran aktual FEFO bertelusur lot (AB-017, AB-018),
 * dan rekonsiliasi stok opname dengan alasan wajib (BRD Bab VII.6, AB-030).
 */

import { WarehouseWorkspace } from "@/features/inventory/components/warehouse-workspace";

export default function WorkspacePage() {
  return <WarehouseWorkspace />;
}

