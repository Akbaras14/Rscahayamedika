/**
 * @fileoverview Model domain dan DTO untuk `patient-service` (Tahap 2 — Peran Petugas Pendaftaran).
 * Bebas dari ketergantungan driver database maupun framework HTTP sesuai TECHSTACK.md Bagian 3 & 4.
 * Acuan aturan bisnis: BRD Versi 4.0 Bab IV.4.1 & Bab XVII (AB-001, AB-020, AB-030, AB-032, AB-034).
 */

export const JENIS_KELAMIN_PASIEN = ["laki_laki", "perempuan"] as const;
export type JenisKelaminPasien = (typeof JENIS_KELAMIN_PASIEN)[number];

export const GOLONGAN_DARAH_PASIEN = [
  "A",
  "B",
  "AB",
  "O",
  "belum_diketahui",
] as const;
export type GolonganDarahPasien = (typeof GOLONGAN_DARAH_PASIEN)[number];

export const STATUS_VERIFIKASI_IDENTITAS = [
  "terverifikasi_dua_pengenal",
  "perlu_verifikasi_ulang",
] as const;
export type StatusVerifikasiIdentitas =
  (typeof STATUS_VERIFIKASI_IDENTITAS)[number];

export const METODE_VERIFIKASI_DUA_PENGENAL = [
  "nama_lengkap_dan_tanggal_lahir",
  "nomor_rekam_medis_dan_tanggal_lahir",
  "nik_dan_tanggal_lahir",
  "nomor_rekam_medis_dan_nik",
] as const;
export type MetodeVerifikasiDuaPengenal =
  (typeof METODE_VERIFIKASI_DUA_PENGENAL)[number];

export const PRIORITAS_ANTREAN_KUNJUNGAN = ["reguler", "mendesak"] as const;
export type PrioritasAntreanKunjungan =
  (typeof PRIORITAS_ANTREAN_KUNJUNGAN)[number];

export const STATUS_KUNJUNGAN_PASIEN = [
  "menunggu_pemeriksaan",
  "sedang_diperiksa",
  "selesai_pemeriksaan",
  "diajukan_rawat_inap",
  "dibatalkan",
] as const;
export type StatusKunjunganPasien = (typeof STATUS_KUNJUNGAN_PASIEN)[number];

/**
 * Entitas identitas utama pasien (`AB-001`).
 */
export interface EntitasPasien {
  id: string;
  nomorRekamMedis: string;
  nomorIdentitasNasional: string | null;
  alasanTanpaNik: string | null;
  namaLengkap: string;
  tanggalLahir: string;
  jenisKelamin: JenisKelaminPasien;
  golonganDarah: GolonganDarahPasien;
  alamatDomisili: string;
  teleponKontakDarurat: string;
  namaKontakDarurat: string;
  hubunganKontakDarurat: string;
  statusVerifikasiIdentitas: StatusVerifikasiIdentitas;
  catatanAdministratif: string | null;
  versi: number;
  didaftarkanOleh: string;
  dibuatPada: string;
  diperbaruiPada: string;
}

/**
 * Snapshot ringkas identitas pasien yang disimpan pada riwayat koreksi (`AB-030`).
 */
export interface SnapshotIdentitasPasien {
  nomorRekamMedis: string;
  nomorIdentitasNasional: string | null;
  alasanTanpaNik: string | null;
  namaLengkap: string;
  tanggalLahir: string;
  jenisKelamin: JenisKelaminPasien;
  golonganDarah: GolonganDarahPasien;
  alamatDomisili: string;
  teleponKontakDarurat: string;
  namaKontakDarurat: string;
  hubunganKontakDarurat: string;
  statusVerifikasiIdentitas: StatusVerifikasiIdentitas;
  catatanAdministratif: string | null;
}

/**
 * Entitas riwayat koreksi terbatas identitas pasien (`AB-030`, `AB-034`).
 */
export interface EntitasRiwayatKoreksiPasien {
  id: string;
  pasienId: string;
  versiSebelum: number;
  versiSesudah: number;
  snapshotSebelum: SnapshotIdentitasPasien;
  snapshotSesudah: SnapshotIdentitasPasien;
  alasanKoreksi: string;
  pengenalDiverifikasi: MetodeVerifikasiDuaPengenal;
  dikoreksiOlehId: string;
  dikoreksiOlehNama: string;
  dikoreksiPada: string;
}

/**
 * Entitas kunjungan pemeriksaan pasien & antrean dokter (`BRD Bab IV.4.1`).
 */
export interface EntitasKunjunganPemeriksaan {
  id: string;
  nomorKunjungan: string;
  pasienId: string;
  tanggalKunjungan: string;
  nomorAntreanHarian: number;
  kodeAntrean: string;
  unitTujuan: string;
  dokterTujuanId: string;
  dokterTujuanNama: string;
  keluhanAdministratif: string;
  prioritasAntrean: PrioritasAntreanKunjungan;
  statusKunjungan: StatusKunjunganPasien;
  pengenalDiverifikasi: MetodeVerifikasiDuaPengenal;
  alasanPembatalan: string | null;
  dibatalkanOlehId: string | null;
  dibatalkanPada: string | null;
  versi: number;
  didaftarkanOlehId: string;
  didaftarkanOlehNama: string;
  waktuMasukAntrean: string;
  diperbaruiPada: string;
}

/**
 * DTO tampilan antrean kunjungan pemeriksaan yang dilengkapi pengenal pasien utama (`AB-020`).
 */
export interface ItemAntreanKunjunganDto extends EntitasKunjunganPemeriksaan {
  pasien: {
    id: string;
    nomorRekamMedis: string;
    nomorIdentitasNasional: string | null;
    namaLengkap: string;
    tanggalLahir: string;
    jenisKelamin: JenisKelaminPasien;
    statusVerifikasiIdentitas: StatusVerifikasiIdentitas;
  };
}

/**
 * Hasil pemeriksaan kemungkinan data pasien ganda (`AB-001`).
 */
export interface HasilCekDuplikasiPasienDto {
  adaKonflikPasti: boolean;
  adaPotensiDuplikat: boolean;
  alasanDeteksi: string[];
  kandidatPasien: EntitasPasien[];
}

/**
 * Respons daftar pasien berpaginasi.
 */
export interface DaftarPasienRespons {
  items: EntitasPasien[];
  totalItem: number;
  halaman: number;
  ukuranHalaman: number;
}

/**
 * Respons daftar antrean kunjungan pemeriksaan berpaginasi beserta ringkasan antrean aktif.
 */
export interface DaftarKunjunganRespons {
  items: ItemAntreanKunjunganDto[];
  totalItem: number;
  halaman: number;
  ukuranHalaman: number;
  ringkasanAntrean: {
    menungguPemeriksaan: number;
    mendesakMenunggu: number;
    sedangDiperiksa: number;
    dibatalkanHariIni: number;
  };
}

/**
 * Rekaman idempotensi pada `patient-service`.
 */
export interface RekamanIdempotensiPasien {
  kunciIdempotensi: string;
  penggunaId: string;
  rute: string;
  hashPayload: string;
  statusHttp: number;
  responsJson: string;
  dibuatPada: string;
  kedaluwarsaPada: string;
}

