/**
 * @fileoverview Halaman Next.js App Router untuk Peran Dokter Penanggung Jawab Pelayanan / DPJP (`/dokter`).
 * Menampilkan ruang kerja klinis pemeriksaan pasien, verifikasi dua pengenal (`AB-020`), pencatatan alergi (`AB-007`),
 * penetapan instruksi diet awal sah (`AB-003`, `AB-004`, `AB-005`, `AB-008`, `AB-009`),
 * revisi diet berversi (`AB-004`, `AB-010`, `AB-030`), dan pengajuan rawat inap (`BRD Bab IV.4.3`).
 */

import { DokterWorkspace } from "@/features/dokter/components/dokter-workspace";

export default function WorkspacePage() {
  return <DokterWorkspace />;
}

