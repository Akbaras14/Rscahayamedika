/**
 * @fileoverview Pengelola connection pool MySQL/MariaDB (`mysql2/promise`), transaksi pendek,
 * dan pelaksana migrasi skema `manajemen_gizi_pasien_patient` untuk `patient-service`.
 * Mengikuti aturan TECHSTACK.md Bagian 2 & 8.3 (isolasi skema database per service, parameterized query).
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql, { type Pool, type PoolConnection } from "mysql2/promise";
import { pisahkanPernyataanSql } from "../../../identity-service/src/database/pool.ts";
import type { KonfigurasiEnvPatient } from "../config/env.ts";
import {
  SEED_KUNJUNGAN_SINTETIS,
  SEED_PASIEN_SINTETIS,
} from "./seeds/patient.seed.ts";

/**
 * Membuat instance connection pool MySQL untuk `patient-service`.
 *
 * @param env - Konfigurasi lingkungan `patient-service`.
 * @param sertakanDatabase - Apakah langsung menyertakan nama database pada koneksi.
 * @returns Pool koneksi `mysql2/promise`.
 */
export function buatPoolDatabasePatient(
  env: KonfigurasiEnvPatient,
  sertakanDatabase = true,
): Pool {
  return mysql.createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: sertakanDatabase ? env.DB_NAME_PATIENT : undefined,
    waitForConnections: true,
    connectionLimit: env.DB_POOL_LIMIT,
    queueLimit: 100,
    connectTimeout: env.DB_CONNECT_TIMEOUT_MS,
    timezone: "Z",
    dateStrings: true,
    namedPlaceholders: false,
  });
}

/**
 * Menjalankan blok operasi di dalam transaksi MySQL yang atomik dengan penanganan rollback otomatis.
 *
 * @param pool - Pool koneksi MySQL `patient-service`.
 * @param kerja - Callback asinkron yang menerima `PoolConnection`.
 * @returns Hasil eksekusi callback.
 */
export async function jalankanTransaksiPatient<T>(
  pool: Pool,
  kerja: (koneksi: PoolConnection) => Promise<T>,
): Promise<T> {
  const koneksi = await pool.getConnection();
  try {
    await koneksi.beginTransaction();
    const hasil = await kerja(koneksi);
    await koneksi.commit();
    return hasil;
  } catch (galat) {
    await koneksi.rollback();
    throw galat;
  } finally {
    koneksi.release();
  }
}

/**
 * Menjalankan migrasi Tahap 2 dan Tahap 4 pada skema `patient-service`.
 *
 * @param env - Konfigurasi lingkungan `patient-service`.
 * @returns Ringkasan status eksekusi migrasi.
 */
export async function jalankanMigrasiPatient(
  env: KonfigurasiEnvPatient,
): Promise<{
  skemaDatabase: string;
  jumlahPernyataanDijalankan: number;
  versiDiterapkan: string;
}> {
  const poolAdmin = buatPoolDatabasePatient(env, false);
  const dirSaatIni = path.dirname(fileURLToPath(import.meta.url));
  const migrasi = [
    "001_tahap_2_pendaftaran_pasien.sql",
    "002_tahap_4_rawat_inap.sql",
    "003_integritas_penempatan.sql",
  ] as const;

  try {
    await poolAdmin.query(
      `CREATE DATABASE IF NOT EXISTS \`${env.DB_NAME_PATIENT}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await poolAdmin.end();
  }

  const poolSkema = buatPoolDatabasePatient(env, true);
  try {
    await poolSkema.query("CREATE TABLE IF NOT EXISTS skema_migrasi_patient (versi VARCHAR(64) NOT NULL PRIMARY KEY, deskripsi VARCHAR(255) NOT NULL, diterapkan_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)) ENGINE=InnoDB");
    let jumlahPernyataanDijalankan = 0;
    for (const berkas of migrasi) {
      const [sudahAda] = await poolSkema.execute("SELECT versi FROM skema_migrasi_patient WHERE versi = ?", [berkas.replace(".sql", "")]);
      if (Array.isArray(sudahAda) && sudahAda.length) continue;
      const isiSql = await readFile(path.join(dirSaatIni, "migrations", berkas), "utf8");
      const daftarPernyataan = pisahkanPernyataanSql(isiSql);
      for (const pernyataan of daftarPernyataan) await poolSkema.query(pernyataan);
      jumlahPernyataanDijalankan += daftarPernyataan.length;
      await poolSkema.execute(
        `INSERT IGNORE INTO skema_migrasi_patient (versi, deskripsi) VALUES (?, ?)`,
        [berkas.replace(".sql", ""), `Migrasi ${berkas}`],
      );
    }

    return {
      skemaDatabase: env.DB_NAME_PATIENT,
      jumlahPernyataanDijalankan,
      versiDiterapkan: migrasi[migrasi.length - 1].replace(".sql", ""),
    };
  } finally {
    await poolSkema.end();
  }
}

/**
 * Mengisi data uji sintetis Tahap 2 ke database MySQL secara idempoten (`INSERT IGNORE`).
 *
 * @param pool - Pool koneksi MySQL yang sudah mengarah ke skema `manajemen_gizi_pasien_patient`.
 */
export async function jalankanSeedPatientMysql(pool: Pool): Promise<void> {
  await jalankanTransaksiPatient(pool, async (conn) => {
    for (const p of SEED_PASIEN_SINTETIS) {
      await conn.execute(
        `INSERT IGNORE INTO pasien
         (id, nomor_rekam_medis, nomor_identitas_nasional, alasan_tanpa_nik, nama_lengkap, tanggal_lahir,
          jenis_kelamin, golongan_darah, alamat_domisili, telepon_kontak_darurat, nama_kontak_darurat,
          hubungan_kontak_darurat, status_verifikasi_identitas, catatan_administratif, versi, didaftarkan_oleh)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.id,
          p.nomorRekamMedis,
          p.nomorIdentitasNasional,
          p.alasanTanpaNik,
          p.namaLengkap,
          p.tanggalLahir,
          p.jenisKelamin,
          p.golonganDarah,
          p.alamatDomisili,
          p.teleponKontakDarurat,
          p.namaKontakDarurat,
          p.hubunganKontakDarurat,
          p.statusVerifikasiIdentitas,
          p.catatanAdministratif,
          p.versi,
          p.didaftarkanOleh,
        ],
      );
    }

    for (const k of SEED_KUNJUNGAN_SINTETIS) {
      await conn.execute(
        `INSERT IGNORE INTO kunjungan
         (id, nomor_kunjungan, pasien_id, tanggal_kunjungan, nomor_antrean_harian, kode_antrean,
          unit_tujuan, dokter_tujuan_id, dokter_tujuan_nama, keluhan_administratif, prioritas_antrean,
          status_kunjungan, pengenal_diverifikasi, alasan_pembatalan, dibatalkan_oleh_id, dibatalkan_pada,
          versi, didaftarkan_oleh_id, didaftarkan_oleh_nama, waktu_masuk_antrean)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          k.id,
          k.nomorKunjungan,
          k.pasienId,
          k.tanggalKunjungan,
          k.nomorAntreanHarian,
          k.kodeAntrean,
          k.unitTujuan,
          k.dokterTujuanId,
          k.dokterTujuanNama,
          k.keluhanAdministratif,
          k.prioritasAntrean,
          k.statusKunjungan,
          k.pengenalDiverifikasi,
          k.alasanPembatalan,
          k.dibatalkanOlehId,
          k.dibatalkanPada,
          k.versi,
          k.didaftarkanOlehId,
          k.didaftarkanOlehNama,
          k.waktuMasukAntrean.replace("T", " ").replace("Z", ""),
        ],
      );
    }
  });
}
