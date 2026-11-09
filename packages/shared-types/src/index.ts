/**
 * @fileoverview Kontrak tipe dasar lintas layanan (netral, bukan model domain klinis bersama).
 * Mengikuti aturan AGENTS.md Bagian 4–6 dan TECHSTACK.md Bagian 3 & 9.
 */

/**
 * Sepuluh peran resmi sesuai BRD Versi 4.0 Bab III.
 * Administrator teknis dipisahkan secara tegas dari kewenangan klinis (AB-032).
 */
export const PERAN_PENGGUNA = [
  "administrator",
  "petugas_pendaftaran",
  "dokter",
  "petugas_rawat_inap",
  "perawat",
  "ahli_gizi",
  "petugas_gudang",
  "petugas_dapur",
  "petugas_distribusi",
  "kepala_instalasi_gizi",
] as const;

export type PeranPengguna = (typeof PERAN_PENGGUNA)[number];

/**
 * Daftar izin granular untuk pemeriksaan akses berbasis peran dan objek (deny by default).
 */
export const IZIN_SISTEM = [
  "sistem:kesehatan:baca",
  "notifikasi:pribadi:baca",
  "notifikasi:pribadi:ubah",
  "admin:pengguna:baca",
  "admin:pengguna:ubah",
  "admin:konfigurasi:baca",
  "admin:konfigurasi:ubah",
  "admin:audit:baca",
  "pendaftaran:pasien:baca",
  "pendaftaran:pasien:buat",
  "pendaftaran:pasien:koreksi",
  "dokter:pemeriksaan:baca",
  "dokter:instruksi_diet:sahkan",
  "rawat_inap:penempatan:baca",
  "rawat_inap:penempatan:kelola",
  "perawat:keamanan_makanan:verifikasi",
  "perawat:skrining_gizi:kelola",
  "perawat:asupan:catat",
  "ahli_gizi:penilaian:kelola",
  "ahli_gizi:menu_individual:sahkan",
  "gudang:persediaan:kelola",
  "gudang:penerimaan:catat",
  "gudang:pengeluaran:proses",
  "gudang:opname:catat",
  "dapur:produksi:kelola",
  "dapur:rencana:kelola",
  "dapur:produksi:catat",
  "dapur:mutu:periksa",
  "dapur:label:cetak",
  "distribusi:troli:kelola",
  "distribusi:penyerahan:verifikasi",
  "distribusi:insiden:catat",
  "kepala_instalasi:pengawasan:baca",
  "kepala_instalasi:insiden:kelola",
  "kepala_instalasi:mutu:evaluasi",
  "kepala_instalasi:audit:rekonsiliasi",
] as const;

export type IzinSistem = (typeof IZIN_SISTEM)[number];

/**
 * Kode galat terstruktur standar agar pesan teknis backend tidak bocor ke klien.
 * Mengikuti UI_UX.md Bagian 9 dan AGENTS.md Bagian 6.
 */
export const KODE_GALAT = {
  VALIDASI_GAGAL: "ERR_VALIDASI_GAGAL",
  AUTENTIKASI_GAGAL: "ERR_AUTENTIKASI_GAGAL",
  SESI_BERAKHIR: "ERR_SESI_BERAKHIR",
  AKSES_DITOLAK: "ERR_AKSES_DITOLAK",
  DATA_TIDAK_DITEMUKAN: "ERR_DATA_TIDAK_DITEMUKAN",
  KONFLIK_BISNIS: "ERR_KONFLIK_BISNIS",
  PENAHANAN_KESELAMATAN: "ERR_PENAHANAN_KESELAMATAN",
  TERLALU_BANYAK_PERMINTAAN: "ERR_TERLALU_BANYAK_PERMINTAAN",
  IDEMPOTENSI_KONFLIK: "ERR_IDEMPOTENSI_KONFLIK",
  GANGGUAN_INTERNAL: "ERR_GANGGUAN_INTERNAL",
} as const;

export type KodeGalat = (typeof KODE_GALAT)[keyof typeof KODE_GALAT];

/**
 * Struktur amplop respons sukses standar REST API v1.
 */
export interface ResponsSuksesApi<T> {
  sukses: true;
  data: T;
  meta: {
    requestId: string;
    correlationId: string;
    waktuRespons: string;
  };
}

/**
 * Struktur rincian galat validasi per field yang aman ditampilkan ke pengguna.
 */
export interface RincianGalatField {
  field: string;
  pesan: string;
}

/**
 * Struktur amplop respons gagal standar REST API v1.
 * Tidak boleh memuat stack trace, query SQL, nama tabel, atau data sensitif.
 */
export interface ResponsGalatApi {
  sukses: false;
  galat: {
    kode: KodeGalat;
    pesan: string;
    kodeLaporan: string;
    rincianValidasi?: RincianGalatField[];
  };
  meta: {
    requestId: string;
    correlationId: string;
    waktuRespons: string;
  };
}

export type ResponsApi<T> = ResponsSuksesApi<T> | ResponsGalatApi;

/**
 * Kontrak status dan prioritas notifikasi sesuai UI_UX.md Bagian 7.
 */
export const KATEGORI_NOTIFIKASI = [
  "keselamatan",
  "pekerjaan",
  "operasional",
  "informasi",
] as const;

export type KategoriNotifikasi = (typeof KATEGORI_NOTIFIKASI)[number];

export const PRIORITAS_NOTIFIKASI = [
  "kritis",
  "tinggi",
  "normal",
  "rendah",
] as const;

export type PrioritasNotifikasi = (typeof PRIORITAS_NOTIFIKASI)[number];

export const STATUS_BACA_NOTIFIKASI = [
  "belum_dibaca",
  "sudah_dibaca",
] as const;

export type StatusBacaNotifikasi = (typeof STATUS_BACA_NOTIFIKASI)[number];

/**
 * Entitas item notifikasi per pengguna.
 * Status dibaca bersifat per pengguna, bukan satu status global untuk rumah sakit.
 */
export interface ItemNotifikasiKontrak {
  id: string;
  peristiwaId: string;
  penerimaId: string;
  judul: string;
  ringkasan: string;
  kategori: KategoriNotifikasi;
  prioritas: PrioritasNotifikasi;
  statusBaca: StatusBacaNotifikasi;
  tautanTujuan: string;
  waktuDibuat: string;
  waktuDibaca: string | null;
}

/**
 * Ringkasan daftar notifikasi pengguna beserta penghitung belum dibaca.
 */
export interface DaftarNotifikasiRespons {
  items: ItemNotifikasiKontrak[];
  jumlahBelumDibaca: number;
  totalItem: number;
  halaman: number;
  ukuranHalaman: number;
}

/**
 * Kontrak profil sesi pengguna terautentikasi.
 */
export interface ProfilSesiPengguna {
  id: string;
  namaPengguna: string;
  namaLengkap: string;
  peran: PeranPengguna;
  labelPeran: string;
  daftarIzin: IzinSistem[];
  daftarBangsalId: string[];
  aktif: boolean;
}

/**
 * Kontrak item navigasi adaptif berdasarkan peran dan izin aktif.
 */
export interface ItemNavigasiPeran {
  id: string;
  label: string;
  href: string;
  ikon:
    | "LayoutDashboard"
    | "Users"
    | "ShieldCheck"
    | "CalendarDays"
    | "Package"
    | "Truck"
    | "History"
    | "TriangleAlert";
  izinWajib: IzinSistem;
  statusTahap:
    | "aktif_tahap_0"
    | "aktif_tahap_1"
    | "aktif_tahap_2"
    | "aktif_tahap_3"
    | "aktif_tahap_4"
    | "aktif_tahap_5"
    | "aktif_tahap_6"
    | "aktif_tahap_7"
    | "aktif_tahap_8"
    | "aktif_tahap_9"
    | "aktif_tahap_10"
    | "menunggu_tahap_peran";
  tahapTarget: number;
}

/**
 * Kontrak amplop event outbox/inbox antarlayanan sesuai TECHSTACK.md Bagian 9.
 */
export interface AmplopPeristiwaIntegrasi<TPayload = Record<string, unknown>> {
  eventId: string;
  eventType: string;
  schemaVersion: number;
  aggregateId: string;
  occurredAt: string;
  correlationId: string;
  payload: TPayload;
}

// ============================================================================
// TAHAP 4: TIPE & KONTRAK PETUGAS RAWAT INAP
// Acuan: BRD Versi 4.0 Bab IV.4.3 & IV.4.5, Bab XVIII (AB-002, AB-020, AB-030, AB-031, AB-034)
// ============================================================================

export type StatusTempatTidur = "tersedia" | "terisi" | "pemeliharaan";

export type KelasPelayananBangsal =
  | "kelas_1"
  | "kelas_2"
  | "kelas_3"
  | "vip"
  | "vvip"
  | "icu";

export type StatusPerawatanEpisode =
  | "aktif"
  | "selesai"
  | "dirujuk"
  | "meninggal";

export type AlasanPemulangan =
  | "sembuh"
  | "rujuk_rs_lain"
  | "pulang_paksa"
  | "meninggal";

export type StatusPengajuanRawatInap =
  | "menunggu_penempatan"
  | "diterima"
  | "ditunda"
  | "ditolak"
  | "ditempatkan";

export interface ItemBangsalDto {
  id: string;
  kodeBangsal: string;
  namaBangsal: string;
  kelasPelayanan: KelasPelayananBangsal;
  kapasitasTempatTidur: number;
  jumlahTersedia: number;
  jumlahTerisi: number;
  jumlahPemeliharaan: number;
  aktif: boolean;
}

export interface ItemKamarDto {
  id: string;
  bangsalId: string;
  namaBangsal: string;
  nomorKamar: string;
  namaKamar: string;
  kapasitasTempatTidur: number;
  aktif: boolean;
}

export interface ItemTempatTidurDto {
  id: string;
  kamarId: string;
  bangsalId: string;
  namaBangsal: string;
  nomorKamar: string;
  nomorTempatTidur: string;
  statusTempatTidur: StatusTempatTidur;
  pasienId?: string;
  nomorRekamMedis?: string;
  namaPasien?: string;
  episodeId?: string;
  waktuMasuk?: string;
  aktif: boolean;
  diperbaruiPada: string;
}

export interface ItemPengajuanRawatInapDto {
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
  prioritasRawatInap: "rutin" | "mendesak" | "gawat_darurat" | "biasa" | "kritis";
  rekomendasiBangsal: string;
  kebutuhanKhusus: string;
  instruksiDietId?: string | null;
  statusPengajuan: StatusPengajuanRawatInap;
  alasanPenolakan?: string | null;
  alasanPenundaan?: string | null;
  dibuatPada: string;
}

export interface RingkasanKapasitasRawatInap {
  totalTempatTidur: number;
  totalTersedia: number;
  totalTerisi: number;
  totalPemeliharaan: number;
  totalPasienAktif: number;
  totalPengajuanMenunggu: number;
}

export interface ItemEpisodeRawatInapDto {
  id: string;
  nomorEpisode: string;
  pasienId: string;
  kunjunganId: string;
  pengajuanId: string;
  nomorRekamMedis: string;
  namaPasien: string;
  tanggalLahir: string;
  jenisKelamin: "laki_laki" | "perempuan";
  dokterDpjpId: string;
  dokterDpjpNama: string;
  diagnosisUtama: string;
  bangsalId: string;
  namaBangsal: string;
  kamarId: string;
  nomorKamar: string;
  tempatTidurId: string;
  nomorTempatTidur: string;
  waktuMasuk: string;
  waktuKeluar: string | null;
  statusPerawatan: StatusPerawatanEpisode;
  alasanPemulangan: AlasanPemulangan | null;
  catatanPemulangan: string | null;
  dipulangkanOlehNama: string | null;
  versi: number;
  dibuatPada: string;
  diperbaruiPada: string;
}

export interface ItemPenempatanTempatTidurDto {
  id: string;
  episodeRawatInapId: string;
  pasienId: string;
  tempatTidurId: string;
  bangsalId: string;
  namaBangsal: string;
  kamarId: string;
  nomorKamar: string;
  nomorTempatTidur: string;
  waktuMasuk: string;
  waktuKeluar: string | null;
  statusPenempatan: "aktif" | "selesai";
  dicatatOlehNama: string;
  dibuatPada: string;
}

export interface ItemRiwayatPerpindahanDto {
  id: string;
  episodeRawatInapId: string;
  nomorEpisode: string;
  pasienId: string;
  nomorRekamMedis: string;
  namaPasien: string;
  bangsalAsalNama: string;
  kamarAsalNomor: string;
  tempatTidurAsalNomor: string;
  bangsalTujuanNama: string;
  kamarTujuanNomor: string;
  tempatTidurTujuanNomor: string;
  alasanPemindahan: string;
  dipindahkanOlehNama: string;
  waktuPemindahan: string;
}

// ============================================================================
// TAHAP 5: TIPE & KONTRAK PERAWAT PELAKSANA BANGSAL
// Acuan: BRD Versi 4.0 Bab V.5.1, V.5.2, Bab X.10.1–10.2 (AB-003, AB-007, AB-008, AB-020, AB-032)
// ============================================================================

export type KemampuanMenelan =
  | "normal"
  | "disfagia_ringan"
  | "disfagia_berat_tersedak"
  | "menggunakan_ngt";

export type StatusKesadaran =
  | "kompos_mentis"
  | "apatis"
  | "somnolen"
  | "sopor"
  | "koma";

export type StatusPuasaNpo =
  | "tidak_puasa"
  | "puasa_terjadwal"
  | "puasa_npo_klinis";

export type KeputusanKeamananMakanan =
  | "aman_lolos"
  | "ditahan_safety_hold";

export type KategoriPenurunanBb =
  | "tidak_ada"
  | "ragu_pakaian_longgar"
  | "1_sampai_5_kg"
  | "6_sampai_10_kg"
  | "11_sampai_15_kg"
  | "lebih_15_kg";

export type KategoriRisikoGizi =
  | "risiko_rendah"
  | "risiko_tinggi";

export type SkalaComstock =
  | "skala_0"
  | "skala_25"
  | "skala_50"
  | "skala_75"
  | "skala_100"
  | "belum_diobservasi";

export type JadwalMakan =
  | "pagi"
  | "siang"
  | "malam"
  | "selingan_pagi"
  | "selingan_sore";

export type KondisiPemberianMakanan =
  | "dikonsumsi_seluruhnya"
  | "dikonsumsi_sebagian"
  | "tidak_dikonsumsi"
  | "tidak_disajikan"
  | "ditolak_pasien"
  | "puasa_medis"
  | "belum_diobservasi";

export interface ItemPasienBangsalPerawatDto {
  episodeId: string;
  nomorEpisode: string;
  pasienId: string;
  nomorRekamMedis: string;
  namaPasien: string;
  tanggalLahir: string;
  usiaTahun: number;
  jenisKelamin: "laki_laki" | "perempuan";
  bangsalId: string;
  namaBangsal: string;
  nomorKamar: string;
  nomorTempatTidur: string;
  dokterDpjpNama: string;
  diagnosisUtama: string;
  waktuMasuk: string;
  // Status Klinis & Gizi Terkini
  instruksiDietId: string | null;
  jenisDiet: string;
  bentukMakanan: string;
  statusPuasaNpo: boolean;
  alasanPuasa: string | null;
  daftarAlergenAktif: readonly string[];
  // Status Pelayanan Keperawatan
  statusVerifikasiKeamanan: "belum_diverifikasi" | "aman_lolos" | "ditahan_safety_hold";
  terakhirDiverifikasiPada: string | null;
  statusSkriningGizi: "belum_diskrining" | "sudah_diskrining";
  skorMstTerakhir: number | null;
  kategoriRisikoGizi: KategoriRisikoGizi | null;
  perluPenilaianLanjut: boolean;
}

export interface ItemVerifikasiKeamananMakananDto {
  id: string;
  nomorVerifikasi: string;
  episodeId: string;
  pasienId: string;
  nomorRekamMedis: string;
  namaPasien: string;
  bangsalId: string;
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
}

export interface ItemSkriningGiziDto {
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
}

export interface ItemObservasiAsupanDto {
  id: string;
  episodeId: string;
  pasienId: string;
  nomorRekamMedis: string;
  namaPasien: string;
  bangsalId: string;
  nomorTempatTidur: string;
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
}

// ==========================================
// TAHAP 6: AHLI GIZI / DIETISIEN
// ==========================================

export const BENTUK_MAKANAN = ["biasa", "lunak", "saring", "cair"] as const;
export type BentukMakanan = (typeof BENTUK_MAKANAN)[number];

export const KATEGORI_MENU = [
  "makanan_pokok",
  "lauk_hewani",
  "lauk_nabati",
  "sayur",
  "buah",
  "snack",
  "formula_enteral",
] as const;
export type KategoriMenu = (typeof KATEGORI_MENU)[number];

export const JADWAL_MAKAN_MENU = [
  "pagi",
  "snack_pagi",
  "siang",
  "snack_sore",
  "malam",
] as const;
export type JadwalMakanMenu = (typeof JADWAL_MAKAN_MENU)[number];

export const STATUS_ASUHAN_GIZI = [
  "aktif",
  "selesai",
  "dibatalkan",
  "direvisi",
] as const;
export type StatusAsuhanGizi = (typeof STATUS_ASUHAN_GIZI)[number];

export const STATUS_KESESUAIAN_MENU = [
  "sesuai",
  "tidak_sesuai_alergi",
  "tidak_sesuai_tekstur",
  "tidak_sesuai_diet",
] as const;
export type StatusKesesuaianMenu = (typeof STATUS_KESESUAIAN_MENU)[number];

export const STATUS_PENGESAHAN_MENU = [
  "draf",
  "disahkan",
  "dibatalkan",
  "diganti",
] as const;
export type StatusPengesahanMenu = (typeof STATUS_PENGESAHAN_MENU)[number];

export const KEPUTUSAN_TINDAK_LANJUT_GIZI = [
  "lanjutkan_rencana",
  "modifikasi_diet",
  "rujuk_dpjp",
  "selesai_asuhan",
] as const;
export type KeputusanTindakLanjutGizi =
  (typeof KEPUTUSAN_TINDAK_LANJUT_GIZI)[number];

export interface ItemPasienDietisienDto {
  episodeId: string;
  pasienId: string;
  nomorRekamMedis: string;
  namaPasien: string;
  tanggalLahir: string;
  jenisKelamin: "L" | "P";
  bangsalId: string;
  namaBangsal: string;
  nomorKamar: string;
  nomorTempatTidur: string;
  diagnosisUtama: string;
  daftarAlergi: readonly string[];
  instruksiDietAktif: string | null;
  instruksiDietAktifId: string | null;
  teksturMakanan: string | null;
  statusSkrining: KategoriRisikoGizi | "belum_skrining";
  skorMst: number | null;
  perluPenilaianLanjut: boolean;
  statusAsuhanGizi: StatusAsuhanGizi | "belum_ada";
  observasiAsupanTerakhir: number | null;
  peringatanAsupanRendah: boolean;
  jumlahRencanaMenuDisahkan: number;
}

export interface ItemBahanResepDto {
  kodeBahan: string;
  namaBahan: string;
  jumlah: number;
  satuan: string;
}

export interface ItemKatalogMenuResepDto {
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
}

export interface ItemAsuhanGiziAdimeDto {
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
}

export interface ItemRencanaMenuIndividualDto {
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
}

export interface ItemEvaluasiAsuhanGiziDto {
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

// =============================================================================
// DOMAIN PETUGAS GUDANG (TAHAP 7) — INVENTARIS & STOK MUTU
// =============================================================================

export type KategoriBahanBaku =
  | "makanan_pokok"
  | "lauk_hewani"
  | "lauk_nabati"
  | "sayuran"
  | "buah"
  | "bumbu_minyak"
  | "khusus_enteral"
  | "lainnya";

export type SatuanBahanBaku =
  | "kg"
  | "gram"
  | "liter"
  | "ml"
  | "butir"
  | "bungkus"
  | "kaleng";

export type SuhuPenyimpananBahan =
  | "suhu_ruang"
  | "chiller_dingin"
  | "freezer_beku";

export type StatusMutuPenerimaan =
  | "layak_diterima"
  | "ditolak_rusak"
  | "ditahan_karantina";

export type StatusLotBahan = "aktif" | "habis" | "kedaluwarsa" | "dibuang";

export type StatusPermintaanBahan =
  | "menunggu"
  | "dialokasikan"
  | "dikeluarkan"
  | "ditolak";

export type JenisMutasiStok =
  | "penerimaan"
  | "alokasi"
  | "pengeluaran"
  | "penyesuaian_opname"
  | "pembuangan";

export type StatusKetersediaanStok = "aman" | "menipis" | "habis";

export interface ItemKatalogBahanDto {
  id: string;
  kodeBahan: string;
  namaBahan: string;
  kategori: KategoriBahanBaku;
  satuan: SatuanBahanBaku;
  suhuPenyimpanan: SuhuPenyimpananBahan;
  stokMinimum: number;
  stokFisik: number;
  stokLayak: number;
  stokDialokasikan: number;
  stokDitahan: number;
  stokTersedia: number;
  daftarAlergen: readonly string[];
  kaloriPer100g: number;
  proteinPer100g: number;
  lemakPer100g: number;
  karbohidratPer100g: number;
  statusStok: StatusKetersediaanStok;
  dibuatPada: string;
  diperbaruiPada: string;
}

export interface ItemPenerimaanLotDto {
  id: string;
  nomorLot: string;
  bahanId: string;
  kodeBahan: string;
  namaBahan: string;
  namaPemasok: string;
  jumlahMasuk: number;
  satuan: SatuanBahanBaku;
  sisaStokLot: number;
  tanggalPenerimaan: string;
  tanggalKedaluwarsa: string;
  statusMutu: StatusMutuPenerimaan;
  catatanPemeriksaan: string;
  suhuTercatatCelsius: number | null;
  petugasPenerimaId: string;
  petugasPenerimaNama: string;
  statusLot: StatusLotBahan;
  dibuatPada: string;
}

export interface ItemRincianPermintaanBahanDto {
  bahanId: string;
  kodeBahan: string;
  namaBahan: string;
  jumlahDiminta: number;
  jumlahDialokasikan: number;
  jumlahDikeluarkan: number;
  satuan: SatuanBahanBaku;
  lotDialokasikan?: readonly {
    lotId: string;
    nomorLot: string;
    jumlah: number;
  }[];
}

export interface ItemPermintaanBahanDto {
  id: string;
  nomorPermintaan: string;
  tanggalKebutuhan: string;
  unitPeminta: string;
  keterangan: string;
  status: StatusPermintaanBahan;
  alasanPenolakan: string | null;
  daftarItem: readonly ItemRincianPermintaanBahanDto[];
  catatanSelisih: string | null;
  waktuPermintaan: string;
  waktuAlokasi: string | null;
  waktuPengeluaran: string | null;
  petugasGudangId: string | null;
  petugasGudangNama: string | null;
}

export interface ItemKartuStokMutasiDto {
  id: string;
  bahanId: string;
  kodeBahan: string;
  namaBahan: string;
  nomorLot: string | null;
  jenisMutasi: JenisMutasiStok;
  referensiDokumen: string;
  jumlahMasuk: number;
  jumlahKeluar: number;
  saldoAkhir: number;
  keterangan: string;
  waktuPencatatan: string;
  petugasNama: string;
}

export interface ItemPenyesuaianStokOpnameDto {
  id: string;
  bahanId: string;
  kodeBahan: string;
  namaBahan: string;
  stokSistemSebelum: number;
  stokFisikAktual: number;
  selisih: number;
  alasanWajib: string;
  petugasId: string;
  petugasNama: string;
  waktuPencatatan: string;
}

/**
 * ============================================================================
 * KONTRAK DATA TAHAP 8 — PERAN PETUGAS DAPUR (KITCHEN SERVICE)
 * Mengikuti BRD Bab VIII (Produksi dan Pengendalian Makanan),
 * Aturan Bisnis AB-005, AB-010, AB-012, AB-013, AB-014, AB-018, AB-019.
 * ============================================================================
 */

export const STATUS_RENCANA_PRODUKSI = [
  "draft",
  "disetujui",
  "dalam_proses",
  "selesai",
  "dibatalkan",
] as const;
export type StatusRencanaProduksi = (typeof STATUS_RENCANA_PRODUKSI)[number];

export const SESI_MAKAN_DAPUR = [
  "pagi",
  "siang",
  "malam",
  "snack_pagi",
  "snack_sore",
] as const;
export type SesiMakanDapur = (typeof SESI_MAKAN_DAPUR)[number];

export const STATUS_BATCH_PRODUKSI = [
  "persiapan",
  "memasak",
  "selesai_masak",
  "lolos_qc",
  "gagal_qc",
] as const;
export type StatusBatchProduksi = (typeof STATUS_BATCH_PRODUKSI)[number];

export const STATUS_PEMERIKSAAN_MUTU = [
  "lolos_pemeriksaan",
  "ditahan_gagal_mutu",
  "perlu_koreksi",
] as const;
export type StatusPemeriksaanMutu = (typeof STATUS_PEMERIKSAAN_MUTU)[number];

export const STATUS_PORSI_PASIEN = [
  "terencana",
  "diproses",
  "siap_kemas",
  "siap_distribusi",
  "ditahan_perubahan_klinis",
  "batal",
] as const;
export type StatusPorsiPasien = (typeof STATUS_PORSI_PASIEN)[number];

export interface ItemKebutuhanBahanKalkulasiDto {
  bahanId: string;
  kodeBahan: string;
  namaBahan: string;
  satuan: string;
  jumlahDibutuhkan: number;
  stokTersediaGudang: number;
  statusKecukupan: "cukup" | "kurang";
}

export interface ItemRencanaProduksiDto {
  id: string;
  nomorRencana: string;
  tanggalPelayanan: string;
  sesiMakan: SesiMakanDapur;
  status: StatusRencanaProduksi;
  totalEstimasiPorsi: number;
  catatan: string;
  waktuDibuat: string;
  waktuDisetujui: string | null;
  penanggungJawabId: string;
  penanggungJawabNama: string;
  kebutuhanBahan: readonly ItemKebutuhanBahanKalkulasiDto[];
}

export interface ItemLotPenggunaanProduksiDto {
  bahanId: string;
  namaBahan: string;
  nomorLot: string;
  jumlahDigunakan: number;
  satuan: string;
}

export interface ItemBatchProduksiDto {
  id: string;
  nomorBatch: string;
  rencanaProduksiId: string;
  resepId: string;
  namaMasakan: string;
  sesiMakan: SesiMakanDapur;
  jumlahPorsiTarget: number;
  jumlahPorsiRealisasi: number;
  suhuMasakCcpCelsius: number | null;
  waktuMulaiMasak: string;
  waktuSelesaiMasak: string | null;
  status: StatusBatchProduksi;
  catatanKoki: string;
  chefPenanggungJawab: string;
  lotBahanDigunakan: readonly ItemLotPenggunaanProduksiDto[];
}

export interface ItemPemeriksaanMutuProduksiDto {
  id: string;
  batchProduksiId: string;
  nomorBatch: string;
  namaMasakan: string;
  suhuSajiCelsius: number;
  ujiTekstur: "sesuai" | "tidak_sesuai";
  ujiAroma: "normal_segar" | "menyimpang";
  ujiRasa: "sesuai_standar" | "tidak_sesuai";
  ujiTampilanVisual: "bersih_menarik" | "kurang_baik";
  statusMutu: StatusPemeriksaanMutu;
  catatanPemeriksaan: string;
  pemeriksaId: string;
  pemeriksaNama: string;
  waktuPemeriksaan: string;
}

export interface ItemLabelPorsiPasienDto {
  id: string;
  nomorLabel: string;
  nomorPesanan: string;
  batchProduksiId: string | null;
  nomorBatch: string | null;
  pasienId: string;
  namaPasien: string;
  nomorRm: string;
  bangsalKamarBed: string;
  tanggalPelayanan: string;
  sesiMakan: SesiMakanDapur;
  namaMenu: string;
  bentukMakanan: string;
  jenisDiet: string;
  informasiAlergen: string;
  suhuKemasanCelsius: number | null;
  statusPorsi: StatusPorsiPasien;
  alasanPenahanan: string | null;
  waktuCetakLabel: string;
  petugasLabelNama: string;
}

export interface RingkasanDapurOverviewDto {
  totalRencanaH1: number;
  totalBatchMemasak: number;
  totalPorsiSiapDistribusi: number;
  totalPesananDitahanKlinis: number;
  pemeriksaanMutuLolos: number;
  pemeriksaanMutuDitahan: number;
}

// -----------------------------------------------------------------------------
// TAHAP 9: KONTRAK DATA PETUGAS DISTRIBUSI (MEAL DELIVERY & WARD HANDOVER)
// -----------------------------------------------------------------------------

export type StatusTroliDistribusi =
  | "persiapan"
  | "dalam_perjalanan"
  | "selesai"
  | "dibatalkan";

export type StatusSerahPorsi =
  | "menunggu_pengiriman"
  | "dalam_troli"
  | "berhasil_diserahkan"
  | "ditahan_klinis"
  | "gagal_diserahkan"
  | "dibatalkan";

export type JenisInsidenDistribusi =
  | "makanan_tumpah_rusak"
  | "diet_tidak_sesuai"
  | "pasien_puasa_npo"
  | "pasien_pindah_kamar"
  | "pasien_menolak"
  | "keterlambatan_ekstrem"
  | "lainnya";

export type MetodeVerifikasiIdentitas =
  | "gelang_pasien"
  | "tanya_pasien_keluarga"
  | "rekam_medis_bedside";

export type HubunganPenerimaMakanan =
  | "pasien_sendiri"
  | "keluarga_pasien"
  | "perawat_penanggung_jawab";

export interface ItemTroliDistribusiDto {
  id: string;
  nomorTroli: string;
  bangsalId: string;
  namaBangsal: string;
  sesiMakan: SesiMakanDapur;
  tanggalDistribusi: string;
  petugasDistribusiId: string;
  petugasDistribusiNama: string;
  status: StatusTroliDistribusi;
  totalPorsi: number;
  totalTerserah: number;
  totalDitahan: number;
  waktuBerangkat: string | null;
  waktuKembali: string | null;
  catatan: string;
}

export interface ItemPorsiDistribusiDto {
  id: string;
  troliId: string | null;
  nomorTroli: string | null;
  labelPorsiId: string;
  nomorLabel: string;
  nomorPesanan: string;
  pasienId: string;
  namaPasien: string;
  nomorRm: string;
  tanggalLahirPasien: string;
  bangsalId: string;
  namaBangsal: string;
  kamarBed: string;
  sesiMakan: SesiMakanDapur;
  namaMenu: string;
  jenisDietLabel: string;
  dietTerkiniPasien: string;
  statusKesesuaianDiet: "sesuai" | "berubah_perlu_tahan";
  statusSerah: StatusSerahPorsi;
  waktuSerah: string | null;
  namaPenerima: string | null;
  hubunganPenerima: HubunganPenerimaMakanan | null;
  alasanGagalAtauTahan: string | null;
  duaIdentitasTerverifikasi: boolean;
  petugasDistribusiNama: string | null;
}

export interface ItemLaporanInsidenDto {
  id: string;
  nomorInsiden: string;
  troliId: string | null;
  porsiDistribusiId: string | null;
  bangsalId: string;
  namaBangsal: string;
  jenisInsiden: JenisInsidenDistribusi;
  deskripsiInsiden: string;
  tindakanKoreksi: string;
  dilaporkanOlehNama: string;
  waktuKejadian: string;
  statusPenyelesaian: "terbuka" | "ditindaklanjuti" | "selesai";
}

export interface RingkasanDistribusiOverviewDto {
  totalTroliAktif: number;
  totalPorsiSiapKirim: number;
  totalPorsiBerhasilDiserahkan: number;
  totalPorsiDitahanKlinis: number;
  totalInsidenAktif: number;
}

// =============================================================================
// KONTRAK DATA TAHAP 10 — KEPALA INSTALASI GIZI (PENGAWASAN MUTU & INSIDEN)
// =============================================================================

export type DerajatKeparahanInsiden =
  | "rendah"
  | "sedang"
  | "tinggi"
  | "kritis";

export type StatusInsidenGizi =
  | "dilaporkan"
  | "dalam_investigasi"
  | "tindakan_koreksi"
  | "terverifikasi"
  | "selesai_ditutup";

export type JenisUnitPelapor =
  | "distribusi"
  | "dapur"
  | "gudang"
  | "perawat"
  | "ahli_gizi"
  | "dokter";

export interface ItemLaporanInsidenKeselamatanDto {
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
  pelaporNama: string;
  penanggungJawabNama: string | null;
  waktuPenutupan: string | null;
  catatanPenutupan: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ItemInvestigasiInsidenDto {
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

export interface ItemTindakanKoreksiDto {
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

export interface ItemEvaluasiMutuGiziDto {
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
  evaluatorNama: string;
}

export interface ItemRekonsiliasiDowntimeDto {
  id: string;
  nomorRekonsiliasi: string;
  tanggalInsidenDowntime: string;
  durasiDowntimeMenit: number;
  unitTerdampak: string;
  jumlahFormulirKertas: number;
  duplikasiTerdeteksi: number;
  selisihPesananSelesai: boolean;
  statusRekonsiliasi: "menunggu_pengesahan" | "disahkan" | "ditolak";
  disahkanOlehNama: string | null;
  waktuPengesahan: string | null;
  catatanRekonsiliasi: string;
  createdAt: string;
}

export interface RingkasanOversightOverviewDto {
  totalInsidenAktif: number;
  totalInsidenKritis: number;
  totalInsidenSelesaiDitutup: number;
  rataRataPlateWasteBangsalPersen: number;
  kepatuhanCcpPusatPersen: number;
  kepatuhanIdentitasBedsidePersen: number;
  totalRekonsiliasiDowntimePending: number;
}





