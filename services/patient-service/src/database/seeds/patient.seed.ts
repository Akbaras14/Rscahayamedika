/**
 * @fileoverview Data uji sintetis untuk `patient-service` (Tahap 2 — Peran Petugas Pendaftaran).
 * ATURAN KESELAMATAN & PRIVASI (IMPLEMENTATION_RULES.md Bagian 6.10 & UI_UX.md Bagian 3):
 * - Seluruh entitas di bawah ini adalah DATA UJI SINTETIS yang diberi label eksplisit `(Data Uji Sintetis)`.
 * - DILARANG menggunakan data rekam medis atau NIK pasien nyata.
 */

import type {
  EntitasKunjunganPemeriksaan,
  EntitasPasien,
  EntitasRiwayatKoreksiPasien,
} from "../../model/patient.model.ts";

const WAKTU_SEED_TAHAP_2 = "2026-11-08T08:15:00.000Z";
export const TANGGAL_OPERASIONAL_DEFAULT = "2026-11-08";

/**
 * Daftar pasien sintetis awal untuk pengujian pencarian, deteksi duplikasi (`AB-001`),
 * verifikasi dua pengenal (`AB-020`), koreksi identitas teraudit (`AB-030`), dan pembuatan kunjungan.
 */
export const SEED_PASIEN_SINTETIS: readonly EntitasPasien[] = [
  {
    id: "psn-sintetis-001",
    nomorRekamMedis: "RM-2026-0001",
    nomorIdentitasNasional: "9900010180010001",
    alasanTanpaNik: null,
    namaLengkap: "Budi Santoso (Data Uji Sintetis)",
    tanggalLahir: "1980-04-12",
    jenisKelamin: "laki_laki",
    golonganDarah: "O",
    alamatDomisili: "Jl. Simulasi Gizi No. 10, Blok Uji A (Sintetis)",
    teleponKontakDarurat: "081100001101",
    namaKontakDarurat: "Siti Rahmawati (Wali Sintetis)",
    hubunganKontakDarurat: "Istri",
    statusVerifikasiIdentitas: "terverifikasi_dua_pengenal",
    catatanAdministratif: "Pasien rujukan poliklinik penyakit dalam (Sintetis).",
    versi: 1,
    didaftarkanOleh: "usr-sintetis-pendaftaran",
    dibuatPada: WAKTU_SEED_TAHAP_2,
    diperbaruiPada: WAKTU_SEED_TAHAP_2,
  },
  {
    id: "psn-sintetis-002",
    nomorRekamMedis: "RM-2026-0002",
    nomorIdentitasNasional: "9900010292080002",
    alasanTanpaNik: null,
    namaLengkap: "Ratna Permatasari (Data Uji Sintetis)",
    tanggalLahir: "1992-08-23",
    jenisKelamin: "perempuan",
    golonganDarah: "A",
    alamatDomisili: "Jl. Simulasi Gizi No. 22, Blok Uji B (Sintetis)",
    teleponKontakDarurat: "081100001102",
    namaKontakDarurat: "Hendra Wijaya (Wali Sintetis)",
    hubunganKontakDarurat: "Suami",
    statusVerifikasiIdentitas: "terverifikasi_dua_pengenal",
    catatanAdministratif: "Pasien kontrol evaluasi rawat jalan (Sintetis).",
    versi: 1,
    didaftarkanOleh: "usr-sintetis-pendaftaran",
    dibuatPada: WAKTU_SEED_TAHAP_2,
    diperbaruiPada: WAKTU_SEED_TAHAP_2,
  },
  {
    id: "psn-sintetis-003",
    nomorRekamMedis: "RM-2026-0003",
    nomorIdentitasNasional: null,
    alasanTanpaNik:
      "Pasien rujukan darurat belum membawa kartu identitas fisik saat tiba (Sintetis).",
    namaLengkap: "Dimas Pratama (Data Uji Sintetis)",
    tanggalLahir: "1975-11-03",
    jenisKelamin: "laki_laki",
    golonganDarah: "B",
    alamatDomisili: "Jl. Simulasi Gizi No. 35, Blok Uji C (Sintetis)",
    teleponKontakDarurat: "081100001103",
    namaKontakDarurat: "Rina Pratama (Wali Sintetis)",
    hubunganKontakDarurat: "Anak Kandung",
    statusVerifikasiIdentitas: "perlu_verifikasi_ulang",
    catatanAdministratif:
      "Wajib kelengkapan dokumen NIK saat keluarga hadir di loket pendaftaran.",
    versi: 1,
    didaftarkanOleh: "usr-sintetis-pendaftaran",
    dibuatPada: WAKTU_SEED_TAHAP_2,
    diperbaruiPada: WAKTU_SEED_TAHAP_2,
  },
];

/**
 * Daftar kunjungan pemeriksaan sintetis awal yang berada pada antrean dokter (`BRD Bab IV.4.1`).
 */
export const SEED_KUNJUNGAN_SINTETIS: readonly EntitasKunjunganPemeriksaan[] = [
  {
    id: "knj-sintetis-001",
    nomorKunjungan: "KNJ-20261108-0001",
    pasienId: "psn-sintetis-001",
    tanggalKunjungan: TANGGAL_OPERASIONAL_DEFAULT,
    nomorAntreanHarian: 1,
    kodeAntrean: "POLI-PD-001",
    unitTujuan: "Poliklinik Penyakit Dalam",
    dokterTujuanId: "usr-sintetis-dokter-melati",
    dokterTujuanNama: "Dokter Penanggung Jawab Melati (Sintetis)",
    keluhanAdministratif:
      "Pemeriksaan awal rencana evaluasi asupan makan dan keluhan lemas 3 hari (Sintetis).",
    prioritasAntrean: "mendesak",
    statusKunjungan: "menunggu_pemeriksaan",
    pengenalDiverifikasi: "nomor_rekam_medis_dan_tanggal_lahir",
    alasanPembatalan: null,
    dibatalkanOlehId: null,
    dibatalkanPada: null,
    versi: 1,
    didaftarkanOlehId: "usr-sintetis-pendaftaran",
    didaftarkanOlehNama: "Petugas Pendaftaran Pasien (Sintetis)",
    waktuMasukAntrean: "2026-11-08T08:20:00.000Z",
    diperbaruiPada: "2026-11-08T08:20:00.000Z",
  },
];

/**
 * Riwayat koreksi identitas sintetis awal (kosong pada awal seed, terisi saat koreksi dilakukan).
 */
export const SEED_RIWAYAT_KOREKSI_PASIEN: readonly EntitasRiwayatKoreksiPasien[] =
  [];

