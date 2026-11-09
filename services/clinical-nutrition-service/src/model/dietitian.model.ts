/**
-- ==============================================================================
-- @fileoverview Model entitas domain Asuhan Gizi ADIME & Perencanaan Menu Individual (Tahap 6).
-- Mengikuti BRD Bab V.5.3, V.5.4, V.5.5, V.5.6, Bab XI, serta aturan bisnis:
-- - AB-007 (Pengecekan Alergi)
-- - AB-009 (Diet awal sah dapat digunakan sebelum penilaian ahli gizi lengkap)
-- - AB-010 (Pemeriksaan ulang pesanan pada perubahan diet)
-- - AB-011 (Menu individual mengacu pada kebutuhan dan instruksi pasien)
-- - AB-014 (Kebutuhan bahan dihitung dari pesanan dan resep)
-- - AB-020 (Wajib verifikasi dua pengenal pasien)
-- - AB-026 (Evaluasi gizi dilakukan oleh tenaga berwenang)
-- - AB-027 (Aplikasi tidak menentukan perubahan terapi secara mandiri)
-- - AB-028 (Setiap tindak lanjut mempunyai penanggung jawab dan status)
-- ==============================================================================
 */

import type {
  BentukMakanan,
  ItemBahanResepDto,
  JadwalMakanMenu,
  KategoriMenu,
  KeputusanTindakLanjutGizi,
  StatusAsuhanGizi,
  StatusKesesuaianMenu,
  StatusPengesahanMenu,
} from "../../../../packages/shared-types/src/index.ts";

/**
 * Entitas database asuhan gizi terstandar (ADIME: Asesmen, Diagnosis PES, Intervensi, Monitoring & Evaluasi).
 */
export interface EntitasAsuhanGiziAdime {
  id: string;
  nomorAsuhan: string;
  episodeId: string;
  pasienId: string;
  nomorRekamMedis: string;
  namaPasien: string;
  bangsalId: string;
  skriningId: string | null;
  ahliGiziId: string;
  ahliGiziNama: string;
  antropometriBbKg: number | null;
  antropometriTbCm: number | null;
  antropometriImt: number | null;
  klasifikasiImt: string | null;
  biokimia: string | null;
  klinisFisik: string | null;
  riwayatDiet: string | null;
  diagnosisGiziPes: string;
  targetEnergiKkal: number;
  targetProteinGram: number;
  targetLemakGram: number;
  targetKarbohidratGram: number;
  targetCairanMl: number | null;
  targetSeratGram: number | null;
  targetNatriumMg: number | null;
  tujuanIntervensi: string;
  rencanaIntervensi: string;
  rencanaMonitoringEvaluasi: string;
  tanggalEvaluasiUlang: string;
  statusAsuhan: StatusAsuhanGizi;
  waktuBerlaku: string;
  versi: number;
  dibuatPada: string;
  diperbaruiPada: string;
}

/**
 * Entitas master katalog menu dan resep standar rumah sakit.
 * Disiapkan ahli gizi sebagai rujukan rencana menu dan kebutuhan bahan gudang/dapur.
 */
export interface EntitasKatalogMenuResep {
  id: string;
  kodeMenu: string;
  namaMenu: string;
  kategoriMakanan: KategoriMenu;
  bentukMakanan: BentukMakanan;
  jenisDietTerkait: string;
  energiKkal: number;
  proteinGram: number;
  lemakGram: number;
  karbohidratGram: number;
  komposisiBahan: readonly ItemBahanResepDto[];
  alergen: readonly string[];
  aktif: boolean;
  dibuatPada: string;
}

/**
 * Entitas rencana menu individual per pasien per tanggal pelayanan dan jadwal makan.
 */
export interface EntitasRencanaMenuIndividual {
  id: string;
  episodeId: string;
  pasienId: string;
  nomorRekamMedis: string;
  namaPasien: string;
  asuhanGiziId: string;
  instruksiDietId: string;
  tanggalPelayanan: string;
  jadwalMakan: JadwalMakanMenu;
  menuId: string;
  namaMenu: string;
  bentukMakanan: BentukMakanan;
  porsi: number;
  energiKkal: number;
  proteinGram: number;
  lemakGram: number;
  karbohidratGram: number;
  statusKesesuaian: StatusKesesuaianMenu;
  alasanTidakSesuai: string | null;
  statusPengesahan: StatusPengesahanMenu;
  disahkanOleh: string | null;
  disahkanPada: string | null;
  catatanKhusus: string | null;
  versi: number;
  dibuatPada: string;
  diperbaruiPada: string;
}

/**
 * Entitas monitoring dan evaluasi berkala asuhan gizi oleh ahli gizi.
 */
export interface EntitasEvaluasiAsuhanGizi {
  id: string;
  asuhanGiziId: string;
  episodeId: string;
  pasienId: string;
  ahliGiziId: string;
  ahliGiziNama: string;
  tanggalEvaluasi: string;
  evaluasiAntropometri: string | null;
  evaluasiBiokimia: string | null;
  evaluasiAsupan: string;
  persentasePemenuhanAsupan: number | null;
  hambatanAsupan: string | null;
  keputusanTindakLanjut: KeputusanTindakLanjutGizi;
  rekomendasiKeDokter: string | null;
  dibuatPada: string;
}

