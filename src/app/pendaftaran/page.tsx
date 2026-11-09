/**
 * @fileoverview Halaman Next.js App Router untuk Peran Petugas Pendaftaran (`/pendaftaran`).
 * Menampilkan ruang kerja pencarian/pembuatan pasien, pencegahan duplikasi (`AB-001`),
 * verifikasi dua pengenal (`AB-020`), koreksi identitas teraudit (`AB-030`), dan antrean kunjungan dokter.
 */

import { PendaftaranWorkspace } from "@/features/pendaftaran/components/pendaftaran-workspace";

export default function WorkspacePage() {
  return <PendaftaranWorkspace />;
}

