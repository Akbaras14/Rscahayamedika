/**
 * @fileoverview Model entitas data untuk `incident-audit-service` (Tahap 10 — Kepala Instalasi Gizi).
 */

import type {
  DerajatKeparahanInsiden,
  JenisUnitPelapor,
  StatusInsidenGizi,
} from "../../../../packages/shared-types/src/index.ts";

export interface LaporanInsidenKeselamatanEntitas {
  id: string;
  nomorInsiden: string;
  unitPelapor: JenisUnitPelapor;
  tanggalKejadian: string;
  jenisInsiden: string;
  derajatKeparahan: DerajatKeparahanInsiden;
  deskripsiKejadian: string;
  tindakanAwalSegera: string;
  pasienTerdampakNama: string | null;
  nomorRmPasien: string | null;
  namaBangsal: string | null;
  statusInsiden: StatusInsidenGizi;
  pelaporId: string;
  pelaporNama: string;
  penanggungJawabId: string | null;
  penanggungJawabNama: string | null;
  waktuPenutupan: string | null;
  catatanPenutupan: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvestigasiInsidenEntitas {
  id: string;
  insidenId: string;
  nomorInsiden: string;
  investigatorId: string;
  investigatorNama: string;
  tanggalInvestigasi: string;
  akarMasalahRca: string;
  faktorKontributor: string;
  rekomendasiSistemik: string;
  createdAt: string;
}

export interface TindakanPerbaikanEntitas {
  id: string;
  insidenId: string;
  nomorInsiden: string;
  deskripsiTindakan: string;
  penanggungJawabId: string;
  penanggungJawabNama: string;
  targetTanggalSelesai: string;
  tanggalRealisasi: string | null;
  statusTindakan: "direncanakan" | "sedang_berjalan" | "selesai_efektif";
  buktiPenyelesaian: string | null;
  createdAt: string;
}

export interface EvaluasiMutuGiziEntitas {
  id: string;
  tanggalEvaluasi: string;
  bangsalId: string;
  namaBangsal: string;
  totalPorsiDisajikan: number;
  rataRataSisaMakananPersen: number;
  kepatuhanCcpSuhuPersen: number;
  kepatuhanDuaIdentitasPersen: number;
  kategoriMutu: "sangat_baik" | "standar" | "perlu_perbaikan";
  catatanEvaluasi: string;
  evaluatorId: string;
  evaluatorNama: string;
  createdAt: string;
}

export interface RekonsiliasiDowntimeEntitas {
  id: string;
  nomorRekonsiliasi: string;
  tanggalInsidenDowntime: string;
  durasiDowntimeMenit: number;
  unitTerdampak: string;
  jumlahFormulirKertas: number;
  duplikasiTerdeteksi: number;
  selisihPesananSelesai: boolean;
  statusRekonsiliasi: "menunggu_pengesahan" | "disahkan" | "ditolak";
  disahkanOlehId: string | null;
  disahkanOlehNama: string | null;
  waktuPengesahan: string | null;
  catatanRekonsiliasi: string;
  createdAt: string;
}

