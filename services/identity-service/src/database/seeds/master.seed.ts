/**
 * @fileoverview Data seed master minimal untuk Tahap 0 (Konfigurasi & Fondasi).
 * ATURAN WAJIB (AGENTS.md Bagian 4 & IMPLEMENTATION_RULES.md Bagian 3.2–3.3):
 * - Hanya berisi master peran, izin, konfigurasi operasional non-klinis, akun uji sintetis,
 *   dan notifikasi fondasi teknis untuk verifikasi kontrak baca/belum dibaca.
 * - DILARANG memuat data pasien nyata maupun notifikasi bisnis klinis fiktif.
 */

import { scryptSync } from "node:crypto";
import { MATRIKS_PERAN_MASTER } from "../../../../../packages/contracts/src/index.ts";
import {
  IZIN_SISTEM,
  PERAN_PENGGUNA,
  type ItemNotifikasiKontrak,
  type IzinSistem,
} from "../../../../../packages/shared-types/src/index.ts";
import type {
  EntitasKonfigurasiOperasional,
  EntitasPengguna,
} from "../../model/identity.model.ts";

/**
 * Menghasilkan hash kata sandi deterministik berbasis `scrypt` untuk seed sintetis pengujian.
 *
 * @param kataSandi - Kata sandi teks biasa untuk akun sintetis.
 * @param salt - Salt unik akun sintetis.
 * @returns Hash heksadesimal 64-byte.
 */
export function buatHashKataSandiSeed(
  kataSandi: string,
  salt: string,
): string {
  return scryptSync(kataSandi, salt, 64).toString("hex");
}

// shortcut: fixture tes lokal, hanya masuk ke MySQL bila HPNMS_SEED_PASSWORD ditetapkan eksplisit.
export const KATA_SANDI_UJI_SINTETIS =
  process.env.HPNMS_SEED_PASSWORD ?? "test-only-password-not-seeded";

const WAKTU_TETAP_SEED = "2026-11-08T08:00:00.000Z";

/**
 * Daftar seluruh kode izin beserta deskripsi Bahasa Indonesia.
 */
export const SEED_IZIN_MASTER: ReadonlyArray<{
  kode: IzinSistem;
  deskripsi: string;
}> = IZIN_SISTEM.map((kode) => ({
  kode,
  deskripsi: `Izin sistem terotorisasi untuk operasi ${kode}`,
}));

/**
 * Daftar seluruh peran resmi sesuai BRD Versi 4.0 Bab III.
 */
export const SEED_PERAN_MASTER = PERAN_PENGGUNA.map((kode) => {
  const def = MATRIKS_PERAN_MASTER[kode];
  return {
    kode: def.kode,
    nama: def.nama,
    deskripsiTanggungJawab: def.deskripsiTanggungJawab,
    tahapImplementasi: def.tahapImplementasi,
    wajibBatasBangsal: def.wajibBatasBangsal,
    izinDefault: [...def.izinDefault],
  };
});

/**
 * Daftar konfigurasi operasional dasar (non-klinis).
 * Tidak ada ambang nutrisi, diagnosis, atau kebijakan medis yang dikarang.
 */
export const SEED_KONFIGURASI_OPERASIONAL: readonly EntitasKonfigurasiOperasional[] =
  [
    {
      kunci: "sistem.mode_operasional",
      nilai: "lokal",
      deskripsi:
        "Mode operasional aplikasi lokal dengan 10 peran terintegrasi.",
      versi: 1,
      diperbaruiOleh: "usr-sintetis-admin",
      diperbaruiPada: WAKTU_TETAP_SEED,
    },
    {
      kunci: "audit.kebijakan_sensor_data_sensitif",
      nilai: "wajib_aktif",
      deskripsi:
        "Kebijakan penyensoran kata sandi, token, identitas pasien, alergi, dan catatan klinis pada log audit teknis.",
      versi: 1,
      diperbaruiOleh: "usr-sintetis-admin",
      diperbaruiPada: WAKTU_TETAP_SEED,
    },
    {
      kunci: "sistem.zona_waktu_operasional",
      nilai: "Asia/Jakarta",
      deskripsi:
        "Zona waktu tampilan operasional rumah sakit sesuai AGENTS.md Bagian 5.",
      versi: 1,
      diperbaruiOleh: "usr-sintetis-admin",
      diperbaruiPada: WAKTU_TETAP_SEED,
    },
    {
      kunci: "keamanan.wajib_verifikasi_dua_identitas",
      nilai: "true",
      deskripsi:
        "Kewajiban verifikasi dua pengenal pasien dan bukan hanya nomor kamar (AB-001, AB-020).",
      versi: 1,
      diperbaruiOleh: "usr-sintetis-admin",
      diperbaruiPada: WAKTU_TETAP_SEED,
    },
  ];

/**
 * Akun sintetis untuk memverifikasi autentikasi, pemisahan peran (AB-032),
 * dan pembatasan lintas bangsal pada Tahap 0.
 */
export const SEED_PENGGUNA_SINTETIS: readonly EntitasPengguna[] = [
  {
    id: "usr-sintetis-admin",
    namaPengguna: "admin.fondasi",
    namaLengkap: "Petugas Konfigurasi Sistem (Sintetis)",
    passwordSalt: "salt-sintetis-admin-001",
    passwordHash: buatHashKataSandiSeed(
      KATA_SANDI_UJI_SINTETIS,
      "salt-sintetis-admin-001",
    ),
    peran: "administrator",
    aktif: true,
    daftarBangsalId: [],
    versi: 1,
    dibuatPada: WAKTU_TETAP_SEED,
    diperbaruiPada: WAKTU_TETAP_SEED,
  },
  {
    id: "usr-sintetis-pendaftaran",
    namaPengguna: "petugas.pendaftaran",
    namaLengkap: "Petugas Pendaftaran Pasien (Sintetis)",
    passwordSalt: "salt-sintetis-pendaftaran-005",
    passwordHash: buatHashKataSandiSeed(
      KATA_SANDI_UJI_SINTETIS,
      "salt-sintetis-pendaftaran-005",
    ),
    peran: "petugas_pendaftaran",
    aktif: true,
    daftarBangsalId: [],
    versi: 1,
    dibuatPada: WAKTU_TETAP_SEED,
    diperbaruiPada: WAKTU_TETAP_SEED,
  },
  {
    id: "usr-sintetis-perawat-anggrek",
    namaPengguna: "perawat.anggrek",
    namaLengkap: "Perawat Bangsal Anggrek (Sintetis)",
    passwordSalt: "salt-sintetis-perawat-002",
    passwordHash: buatHashKataSandiSeed(
      KATA_SANDI_UJI_SINTETIS,
      "salt-sintetis-perawat-002",
    ),
    peran: "perawat",
    aktif: true,
    daftarBangsalId: ["BANGSAL-ANGGREK"],
    versi: 1,
    dibuatPada: WAKTU_TETAP_SEED,
    diperbaruiPada: WAKTU_TETAP_SEED,
  },
  {
    id: "usr-sintetis-perawat-melati",
    namaPengguna: "perawat.melati",
    namaLengkap: "Perawat Bangsal Melati (Sintetis)",
    passwordSalt: "salt-sintetis-perawat-003",
    passwordHash: buatHashKataSandiSeed(
      KATA_SANDI_UJI_SINTETIS,
      "salt-sintetis-perawat-003",
    ),
    peran: "perawat",
    aktif: true,
    daftarBangsalId: ["BANGSAL-MELATI"],
    versi: 1,
    dibuatPada: WAKTU_TETAP_SEED,
    diperbaruiPada: WAKTU_TETAP_SEED,
  },
  {
    id: "usr-sintetis-dokter-melati",
    namaPengguna: "dokter.melati",
    namaLengkap: "Dokter Penanggung Jawab Melati (Sintetis)",
    passwordSalt: "salt-sintetis-dokter-003",
    passwordHash: buatHashKataSandiSeed(
      KATA_SANDI_UJI_SINTETIS,
      "salt-sintetis-dokter-003",
    ),
    peran: "dokter",
    aktif: true,
    daftarBangsalId: ["BANGSAL-MELATI"],
    versi: 1,
    dibuatPada: WAKTU_TETAP_SEED,
    diperbaruiPada: WAKTU_TETAP_SEED,
  },
  {
    id: "usr-sintetis-rawatinap",
    namaPengguna: "petugas.rawatinap",
    namaLengkap: "Petugas Admisi Rawat Inap (Sintetis)",
    passwordSalt: "salt-sintetis-rawatinap-006",
    passwordHash: buatHashKataSandiSeed(
      KATA_SANDI_UJI_SINTETIS,
      "salt-sintetis-rawatinap-006",
    ),
    peran: "petugas_rawat_inap",
    aktif: true,
    daftarBangsalId: ["BANGSAL-MELATI", "BANGSAL-ANGGREK", "BANGSAL-MAWAR"],
    versi: 1,
    dibuatPada: WAKTU_TETAP_SEED,
    diperbaruiPada: WAKTU_TETAP_SEED,
  },
  {
    id: "usr-sintetis-dietisien",
    namaPengguna: "dietisien.klinis",
    namaLengkap: "Dietisien Klinis Rawat Inap (Sintetis)",
    passwordSalt: "salt-sintetis-dietisien-007",
    passwordHash: buatHashKataSandiSeed(
      KATA_SANDI_UJI_SINTETIS,
      "salt-sintetis-dietisien-007",
    ),
    peran: "ahli_gizi",
    aktif: true,
    daftarBangsalId: ["BANGSAL-MELATI", "BANGSAL-ANGGREK", "BANGSAL-MAWAR"],
    versi: 1,
    dibuatPada: WAKTU_TETAP_SEED,
    diperbaruiPada: WAKTU_TETAP_SEED,
  },
  {
    id: "usr-sintetis-gudang",
    namaPengguna: "petugas.gudang",
    namaLengkap: "Bambang Santoso, A.Md.Log",
    passwordSalt: "salt-sintetis-gudang-007",
    passwordHash: buatHashKataSandiSeed(
      KATA_SANDI_UJI_SINTETIS,
      "salt-sintetis-gudang-007",
    ),
    peran: "petugas_gudang",
    aktif: true,
    daftarBangsalId: [],
    versi: 1,
    dibuatPada: WAKTU_TETAP_SEED,
    diperbaruiPada: WAKTU_TETAP_SEED,
  },
  {
    id: "usr-sintetis-dapur",
    namaPengguna: "petugas.dapur",
    namaLengkap: "Chef Sulaeman, A.Md.Gz",
    passwordSalt: "salt-sintetis-dapur-008",
    passwordHash: buatHashKataSandiSeed(
      KATA_SANDI_UJI_SINTETIS,
      "salt-sintetis-dapur-008",
    ),
    peran: "petugas_dapur",
    aktif: true,
    daftarBangsalId: [],
    versi: 1,
    dibuatPada: WAKTU_TETAP_SEED,
    diperbaruiPada: WAKTU_TETAP_SEED,
  },
  {
    id: "usr-sintetis-distribusi",
    namaPengguna: "petugas.distribusi",
    namaLengkap: "Dedi Setiawan, A.Md.Gz",
    passwordSalt: "salt-sintetis-distribusi-009",
    passwordHash: buatHashKataSandiSeed(
      KATA_SANDI_UJI_SINTETIS,
      "salt-sintetis-distribusi-009",
    ),
    peran: "petugas_distribusi",
    aktif: true,
    daftarBangsalId: ["bng-001", "bng-002", "BANGSAL-MELATI", "BANGSAL-ANGGREK", "BANGSAL-MAWAR"],
    versi: 1,
    dibuatPada: WAKTU_TETAP_SEED,
    diperbaruiPada: WAKTU_TETAP_SEED,
  },
  {
    id: "usr-sintetis-kepala-instalasi",
    namaPengguna: "kepala.gizi",
    namaLengkap: "Dr. dr. Nurul Hidayati, Sp.GK",
    passwordSalt: "salt-sintetis-kepala-010",
    passwordHash: buatHashKataSandiSeed(
      KATA_SANDI_UJI_SINTETIS,
      "salt-sintetis-kepala-010",
    ),
    peran: "kepala_instalasi_gizi",
    aktif: true,
    daftarBangsalId: [],
    versi: 1,
    dibuatPada: WAKTU_TETAP_SEED,
    diperbaruiPada: WAKTU_TETAP_SEED,
  },
  {
    id: "usr-sintetis-nonaktif",
    namaPengguna: "akun.nonaktif",
    namaLengkap: "Akun Nonaktif Uji Keamanan (Sintetis)",
    passwordSalt: "salt-sintetis-nonaktif-004",
    passwordHash: buatHashKataSandiSeed(
      KATA_SANDI_UJI_SINTETIS,
      "salt-sintetis-nonaktif-004",
    ),
    peran: "petugas_gudang",
    aktif: false,
    daftarBangsalId: [],
    versi: 1,
    dibuatPada: WAKTU_TETAP_SEED,
    diperbaruiPada: WAKTU_TETAP_SEED,
  },
];

/**
 * Data notifikasi fondasi teknis (bukan notifikasi bisnis/klinis fiktif)
 * untuk menguji perilaku lonceng notifikasi per pengguna (`belum_dibaca` vs `sudah_dibaca`).
 */
export const SEED_NOTIFIKASI_FONDASI: readonly ItemNotifikasiKontrak[] = [
  {
    id: "notif-fondasi-001",
    peristiwaId: "evt-fondasi-init-001",
    penerimaId: "usr-sintetis-admin",
    judul: "Akses administrator tersedia",
    ringkasan:
      "Kelola pengguna, penugasan bangsal, konfigurasi operasional, dan jejak audit sesuai kewenangan administrator.",
    kategori: "operasional",
    prioritas: "normal",
    statusBaca: "belum_dibaca",
    tautanTujuan: "/administrator",
    waktuDibuat: "2026-11-08T08:05:00.000Z",
    waktuDibaca: null,
  },
  {
    id: "notif-fondasi-002",
    peristiwaId: "evt-fondasi-init-002",
    penerimaId: "usr-sintetis-admin",
    judul: "Seluruh modul peran tersedia",
    ringkasan:
      "Sepuluh modul operasional tersedia sesuai izin dan penugasan masing-masing pengguna.",
    kategori: "informasi",
    prioritas: "rendah",
    statusBaca: "sudah_dibaca",
    tautanTujuan: "/portal",
    waktuDibuat: "2026-11-08T08:01:00.000Z",
    waktuDibaca: "2026-11-08T08:03:00.000Z",
  },
  {
    id: "notif-fondasi-003",
    peristiwaId: "evt-fondasi-init-003",
    penerimaId: "usr-sintetis-perawat-anggrek",
    judul: "Penugasan Bangsal Anggrek Terdaftar",
    ringkasan:
      "Akses pelayanan Anda dibatasi pada BANGSAL-ANGGREK sesuai penugasan.",
    kategori: "informasi",
    prioritas: "normal",
    statusBaca: "belum_dibaca",
    tautanTujuan: "/perawat",
    waktuDibuat: "2026-11-08T08:06:00.000Z",
    waktuDibaca: null,
  },
];
