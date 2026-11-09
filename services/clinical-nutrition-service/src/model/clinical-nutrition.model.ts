/**
 * @fileoverview Model Domain dan DTO untuk `clinical-nutrition-service` (Tahap 3 — Peran Dokter).
 * Mengimplementasikan BRD Versi 4.0 Bab IV.4.2 s.d. IV.4.4 & Bab XVII:
 * - Pemeriksaan awal dokter & pencatatan kondisi relevan gizi (`AB-006`).
 * - Alergi dan pembatasan yang tercatat (`AB-007`).
 * - Instruksi diet awal sah berstempel waktu & berversi (`AB-003`, `AB-004`, `AB-005`, `AB-009`).
 * - Larangan makan atau minum melalui mulut / NPO (`AB-008`).
 * - Koreksi & perubahan versi instruksi diet berstempel waktu (`AB-010`, `AB-030`).
 * - Pengajuan rawat inap berprioritas & berstatus menunggu penempatan (`BRD Bab IV.4.3`).
 */

export const JENIS_DIET_KLINIS = [
  "makanan_biasa",
  "makanan_lunak",
  "rendah_garam",
  "diabetes_melitus",
  "rendah_lemak",
  "jantung",
  "lambung",
  "ginjal_rendah_protein",
  "tktp",
  "hati",
  "khusus_kombinasi",
] as const;
export type JenisDietKlinis = (typeof JENIS_DIET_KLINIS)[number];

export const BENTUK_MAKANAN_KLINIS = [
  "biasa",
  "lunak",
  "saring",
  "cair",
] as const;
export type BentukMakananKlinis = (typeof BENTUK_MAKANAN_KLINIS)[number];

export const RUTE_PEMBERIAN_NUTRISI = [
  "oral",
  "enteral_ngt",
  "parenteral_tpn",
] as const;
export type RutePemberianNutrisi = (typeof RUTE_PEMBERIAN_NUTRISI)[number];

export const STATUS_INSTRUKSI_DIET = [
  "aktif",
  "digantikan",
  "dibatalkan",
] as const;
export type StatusInstruksiDiet = (typeof STATUS_INSTRUKSI_DIET)[number];

export const KATEGORI_ALERGEN = [
  "makanan",
  "obat",
  "lingkungan",
  "lainnya",
] as const;
export type KategoriAlergen = (typeof KATEGORI_ALERGEN)[number];

export const TINGKAT_KEPARAHAN_ALERGI = [
  "ringan",
  "sedang",
  "berat_anafilaksis",
] as const;
export type TingkatKeparahanAlergi = (typeof TINGKAT_KEPARAHAN_ALERGI)[number];

export const TINDAK_LANJUT_PEMERIKSAAN = [
  "selesai_rawat_jalan",
  "anjuran_rawat_inap",
  "rujuk_eksternal",
] as const;
export type TindakLanjutPemeriksaan = (typeof TINDAK_LANJUT_PEMERIKSAAN)[number];

export const PRIORITAS_RAWAT_INAP = [
  "rutin",
  "mendesak",
  "gawat_darurat",
] as const;
export type PrioritasRawatInap = (typeof PRIORITAS_RAWAT_INAP)[number];

export const STATUS_PENGAJUAN_RAWAT_INAP = [
  "menunggu_penempatan",
  "diterima",
  "ditolak",
  "dibatalkan",
] as const;
export type StatusPengajuanRawatInap =
  (typeof STATUS_PENGAJUAN_RAWAT_INAP)[number];

/**
 * Pengukuran tanda vital pasien pada saat pemeriksaan dokter.
 */
export interface TandaVitalPasien {
  tekananDarahSistol: number | null;
  tekananDarahDiastol: number | null;
  denyutNadi: number | null;
  frekuensiNafas: number | null;
  suhuTubuh: number | null;
  beratBadanKg: number | null;
  tinggiBadanCm: number | null;
}

/**
 * Entitas alergi & intoleransi pasien (`AB-007`).
 */
export interface EntitasAlergiPasien {
  id: string;
  pasienId: string;
  pemeriksaanId?: string | null;
  kategoriAlergen: KategoriAlergen;
  namaAlergen: string;
  tingkatKeparahan: TingkatKeparahanAlergi;
  reaksiAlergi: string | null;
  statusAktif: boolean;
  dicatatOlehId: string;
  dicatatOlehNama: string;
  dicatatPada: string;
}

/**
 * Entitas hasil pemeriksaan klinis dokter (`BRD Bab IV.4.2`).
 */
export interface EntitasPemeriksaanKlinis {
  id: string;
  kunjunganId: string;
  pasienId: string;
  nomorRekamMedis: string;
  namaPasien: string;
  tanggalLahirPasien: string;
  dokterId: string;
  dokterNama: string;
  unitPelayanan: string;
  bangsalId: string | null;
  keluhanUtama: string;
  riwayatPenyakitSekarang: string | null;
  tandaVital: TandaVitalPasien;
  diagnosisKlinisPrimer: string;
  diagnosisKlinisSekunder: string | null;
  catatanKlinisRelevanGizi: string | null;
  tindakLanjut: TindakLanjutPemeriksaan;
  dibuatPada: string;
  diperbaruiPada: string;
}

/**
 * Entitas instruksi diet awal sah berstempel waktu dan berversi (`AB-003`, `AB-004`, `AB-005`, `AB-008`).
 */
export interface EntitasInstruksiDiet {
  id: string;
  nomorInstruksi: string;
  pasienId: string;
  kunjunganId: string;
  nomorRekamMedis: string;
  namaPasien: string;
  dokterPengesahId: string;
  dokterPengesahNama: string;
  bangsalId: string | null;
  jenisDiet: JenisDietKlinis;
  namaDietKustom: string | null;
  bentukMakanan: BentukMakananKlinis;
  rutePemberian: RutePemberianNutrisi;
  statusPuasaNpo: boolean;
  alasanPuasa: string | null;
  targetEnergiKkal: number | null;
  targetProteinGram: number | null;
  pembatasanCairanMl: number | null;
  pembatasanNatriumMg: number | null;
  instruksiKhusus: string | null;
  statusInstruksi: StatusInstruksiDiet;
  versi: number;
  berlakuSejak: string;
  berlakuHingga: string | null;
  disahkanPada: string;
  dibuatPada: string;
  diperbaruiPada: string;
}

/**
 * Entitas snapshot riwayat perubahan versi instruksi diet (`AB-004`, `AB-010`, `AB-030`).
 */
export interface EntitasRiwayatVersiInstruksiDiet {
  id: string;
  instruksiDietId: string;
  pasienId: string;
  versi: number;
  snapshotData: EntitasInstruksiDiet;
  alasanPerubahan: string;
  diubahOlehId: string;
  diubahOlehNama: string;
  diubahPada: string;
}

/**
 * Entitas pengajuan rawat inap oleh dokter (`BRD Bab IV.4.3`).
 */
export interface EntitasPengajuanRawatInap {
  id: string;
  nomorPengajuan: string;
  pasienId: string;
  kunjunganId: string;
  nomorRekamMedis: string;
  namaPasien: string;
  dokterPengajuId: string;
  dokterPengajuNama: string;
  diagnosisUtama: string;
  alasanRawatInap: string;
  prioritasRawatInap: PrioritasRawatInap;
  rekomendasiBangsal: string;
  kebutuhanKhusus: string | null;
  instruksiDietId: string | null;
  statusPengajuan: StatusPengajuanRawatInap;
  diajukanPada: string;
  diperbaruiPada: string;
}

/**
 * DTO ringkasan pasien antrean dokter beserta status pemeriksaan klinis.
 */
export interface ItemAntreanDokterDto {
  kunjunganId: string;
  nomorKunjungan: string;
  pasienId: string;
  nomorRekamMedis: string;
  namaLengkap: string;
  tanggalLahir: string;
  jenisKelamin: string;
  kodeAntrean: string;
  nomorAntreanHarian: number;
  prioritasAntrean: string;
  statusKunjungan: string;
  keluhanAdministratif: string;
  unitTujuan: string;
  dokterTujuanId: string;
  dokterTujuanNama: string;
  waktuMasukAntrean: string;
  sudahDiperiksa: boolean;
  adaInstruksiDietAktif: boolean;
  adaPengajuanRawatInap: boolean;
}

/**
 * DTO respons daftar antrean dokter.
 */
export interface DaftarAntreanDokterRespons {
  items: ItemAntreanDokterDto[];
  totalItem: number;
  halaman: number;
  ukuranHalaman: number;
  ringkasan: {
    menungguPemeriksaan: number;
    sedangDiperiksa: number;
    selesaiPemeriksaan: number;
    diajukanRawatInap: number;
  };
}

/**
 * DTO respons detail pemeriksaan & instruksi diet klinis pasien.
 */
export interface DetailKlinisPasienRespons {
  kunjunganId: string;
  pasienId: string;
  nomorRekamMedis: string;
  namaPasien: string;
  tanggalLahirPasien: string;
  pemeriksaanTerbaru: EntitasPemeriksaanKlinis | null;
  alergiAktif: EntitasAlergiPasien[];
  instruksiDietAktif: EntitasInstruksiDiet | null;
  riwayatVersiDiet: EntitasRiwayatVersiInstruksiDiet[];
  pengajuanRawatInapAktif: EntitasPengajuanRawatInap | null;
}

