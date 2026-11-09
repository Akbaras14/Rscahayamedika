/**
 * @fileoverview Halaman Next.js App Router untuk Peran Petugas Rawat Inap (`/rawat-inap`).
 * Menampilkan ruang kerja penerimaan pengajuan dokter, alokasi tempat tidur tanpa tabrakan (`AB-002`),
 * verifikasi dua pengenal (`AB-020`), pemindahan tempat tidur teraudit (`AB-030`, `AB-034`),
 * dan pemulangan administratif pasien beserta penghentian jadwal pesanan gizi (`AB-031`).
 */

import { RawatInapWorkspace } from "@/features/rawat-inap/components/rawat-inap-workspace";

export default function WorkspacePage() {
  return <RawatInapWorkspace />;
}

