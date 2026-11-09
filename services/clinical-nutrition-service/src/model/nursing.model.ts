/**
 * @fileoverview Model Domain dan DTO untuk Asuhan Keperawatan Bangsal (Tahap 5 — Perawat).
 * Mengimplementasikan BRD Versi 4.0 Bab V.5.1, V.5.2, Bab X.10.1–10.2:
 * - Pemeriksaan keamanan makanan awal oleh perawat (AB-003, AB-007, AB-008, AB-020).
 * - Skrining risiko gangguan gizi (MST) & pemicu penugasan ahli gizi (BRD Bab V.5.2).
 * - Observasi klinis asupan & kontrak skala Comstock (BRD Bab X.10.1, 10.2).
 */

import type {
  JadwalMakan,
  KategoriPenurunanBb,
  KategoriRisikoGizi,
  KemampuanMenelan,
  KeputusanKeamananMakanan,
  KondisiPemberianMakanan,
  SkalaComstock,
  StatusKesadaran,
  StatusPuasaNpo,
} from "../../../../packages/shared-types/src/index.ts";

export const KATEGORI_PENURUNAN_BB: readonly KategoriPenurunanBb[] = [
  "tidak_ada",
  "ragu_pakaian_longgar",
  "1_sampai_5_kg",
  "6_sampai_10_kg",
  "11_sampai_15_kg",
  "lebih_15_kg",
] as const;

export const KEMAMPUAN_MENELAN: readonly KemampuanMenelan[] = [
  "normal",
  "disfagia_ringan",
  "disfagia_berat_tersedak",
  "menggunakan_ngt",
] as const;

export const STATUS_KESADARAN: readonly StatusKesadaran[] = [
  "kompos_mentis",
  "apatis",
  "somnolen",
  "sopor",
  "koma",
] as const;

export const STATUS_PUASA_NPO: readonly StatusPuasaNpo[] = [
  "tidak_puasa",
  "puasa_terjadwal",
  "puasa_npo_klinis",
] as const;

export const KEPUTUSAN_KEAMANAN_MAKANAN: readonly KeputusanKeamananMakanan[] = [
  "aman_lolos",
  "ditahan_safety_hold",
] as const;

export const SKALA_COMSTOCK: readonly SkalaComstock[] = [
  "skala_0",
  "skala_25",
  "skala_50",
  "skala_75",
  "skala_100",
  "belum_diobservasi",
] as const;

export const JADWAL_MAKAN: readonly JadwalMakan[] = [
  "pagi",
  "siang",
  "malam",
  "selingan_pagi",
  "selingan_sore",
] as const;

export const KONDISI_PEMBERIAN_MAKANAN: readonly KondisiPemberianMakanan[] = [
  "dikonsumsi_seluruhnya",
  "dikonsumsi_sebagian",
  "tidak_dikonsumsi",
  "tidak_disajikan",
  "ditolak_pasien",
  "puasa_medis",
  "belum_diobservasi",
] as const;

export const ALASAN_TIDAK_HABIS = [
  "mual_muntah",
  "tidak_nafsu_makan",
  "gangguan_menelan",
  "tidak_suka_menu",
  "kenyang",
  "pasien_tidur",
  "nyeri_perut",
  "pantangan_pribadi",
  "lainnya",
] as const;
export type AlasanTidakHabis = (typeof ALASAN_TIDAK_HABIS)[number];

export interface EntitasSkriningGizi {
  id: string;
  nomorSkrining: string;
  episodeId: string;
  pasienId: string;
  nomorRekamMedis: string;
  namaPasien: string;
  bangsalId: string;
  perawatId: string;
  perawatNama: string;
  metodeSkrining: "mst";
  penurunanBeratBadan: KategoriPenurunanBb;
  skorPenurunanBb: number;
  asupanMakanBerkurang: boolean;
  skorAsupanMakan: number;
  totalSkor: number;
  kategoriRisiko: KategoriRisikoGizi;
  perluPenilaianLanjut: boolean;
  catatanSkrining: string | null;
  diskriningPada: string;
  dibuatPada: string;
  diperbaruiPada: string;
}

export interface EntitasVerifikasiKeamananMakanan {
  id: string;
  nomorVerifikasi: string;
  episodeId: string;
  pasienId: string;
  nomorRekamMedis: string;
  namaPasien: string;
  bangsalId: string;
  tempatTidurId: string;
  nomorTempatTidur: string;
  instruksiDietId: string | null;
  perawatId: string;
  perawatNama: string;
  konfirmasiTanggalLahir: string;
  apakahIdentitasSesuai: boolean;
  apakahDietSesuai: boolean;
  apakahAlergiTerkonfirmasi: boolean;
  kemampuanMenelan: KemampuanMenelan;
  statusKesadaran: StatusKesadaran;
  statusPuasaNpo: StatusPuasaNpo;
  keputusan: KeputusanKeamananMakanan;
  alasanPenahanan: string | null;
  tindakanEskalasi: string | null;
  diverifikasiPada: string;
  dibuatPada: string;
}

export interface EntitasObservasiAsupanKeperawatan {
  id: string;
  episodeId: string;
  pasienId: string;
  nomorRekamMedis: string;
  namaPasien: string;
  bangsalId: string;
  tempatTidurId: string;
  perawatId: string;
  perawatNama: string;
  tanggalMakan: string;
  jadwalMakan: JadwalMakan;
  skalaComstock: SkalaComstock;
  persentaseKonsumsi: number;
  kondisiPemberian: KondisiPemberianMakanan;
  alasanTidakHabis: string | null;
  catatanObservasi: string | null;
  peringatanAsupanRendah: boolean;
  diobservasiPada: string;
  dibuatPada: string;
}

