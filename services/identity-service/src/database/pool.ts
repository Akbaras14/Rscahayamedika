/**
 * @fileoverview Pengelola koneksi MySQL (`mysql2/promise`), pembungkus transaksi atomik,
 * serta pelaksana migrasi dan seed terversi untuk Identity Service.
 * Acuan: TECHSTACK.md Bagian 1, 2, & 8.3; AGENTS.md Bagian 5.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql, { type Pool, type PoolConnection } from "mysql2/promise";
import type { IdentityServiceEnv } from "../config/env.ts";
import {
  SEED_IZIN_MASTER,
  SEED_KONFIGURASI_OPERASIONAL,
  SEED_NOTIFIKASI_FONDASI,
  SEED_PENGGUNA_SINTETIS,
  SEED_PERAN_MASTER,
} from "./seeds/master.seed.ts";

/**
 * Membuat connection pool MySQL terbatas sesuai konfigurasi service.
 *
 * @param env - Konfigurasi Identity Service yang telah tervalidasi.
 * @param sertakanDatabase - Jika `false`, koneksi dibuka tanpa nama database (untuk membuat skema awal).
 * @returns Instance `Pool` dari `mysql2/promise`.
 */
export function buatPoolDatabaseIdentity(
  env: IdentityServiceEnv,
  sertakanDatabase = true,
): Pool {
  return mysql.createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: sertakanDatabase ? env.DB_NAME_IDENTITY : undefined,
    waitForConnections: true,
    connectionLimit: env.DB_CONNECTION_LIMIT,
    queueLimit: 50,
    connectTimeout: env.DB_CONNECT_TIMEOUT_MS,
    timezone: "Z",
    multipleStatements: false,
  });
}

/**
 * Menjalankan operasi di dalam transaksi MySQL atomik dengan penanganan rollback otomatis
 * dan percobaan ulang terbatas apabila terjadi deadlock (`ER_LOCK_DEADLOCK`).
 *
 * @param pool - Connection pool MySQL aktif.
 * @param operasi - Fungsi kerja yang menerima `PoolConnection` dalam konteks transaksi.
 * @param maksPercobaanDeadlock - Batas percobaan ulang untuk deadlock sementara (default 3).
 * @returns Hasil eksekusi `operasi`.
 */
export async function jalankanDalamTransaksi<T>(
  pool: Pool,
  operasi: (koneksi: PoolConnection) => Promise<T>,
  maksPercobaanDeadlock = 3,
): Promise<T> {
  let percobaan = 0;

  while (true) {
    percobaan += 1;
    const koneksi = await pool.getConnection();
    try {
      await koneksi.beginTransaction();
      const hasil = await operasi(koneksi);
      await koneksi.commit();
      return hasil;
    } catch (galat: unknown) {
      await koneksi.rollback().catch(() => {
        // Abaikan galat rollback sekunder agar galat utama tetap dilempar utuh.
      });

      const kodeMysql =
        typeof galat === "object" && galat !== null && "code" in galat
          ? String((galat as { code?: unknown }).code)
          : "";

      if (
        kodeMysql === "ER_LOCK_DEADLOCK" &&
        percobaan < maksPercobaanDeadlock
      ) {
        const jedaMs = 30 * percobaan + Math.floor(Math.random() * 25);
        await new Promise((resolve) => setTimeout(resolve, jedaMs));
        continue;
      }

      throw galat;
    } finally {
      koneksi.release();
    }
  }
}

/**
 * Memisahkan berkas SQL menjadi daftar pernyataan individual yang aman dieksekusi satu per satu
 * tanpa mengaktifkan `multipleStatements: true` secara global.
 *
 * @param isiSql - Isi berkas migrasi `.sql`.
 * @returns Array pernyataan SQL yang siap dijalankan.
 */
export function pisahkanPernyataanSql(isiSql: string): string[] {
  const tanpaKomentar = isiSql
    .split(/\r?\n/)
    .filter((baris) => !baris.trim().startsWith("--"))
    .join("\n");

  return tanpaKomentar
    .split(";")
    .map((bagian) => bagian.trim())
    .filter((bagian) => bagian.length > 0);
}

/**
 * Memastikan database/skema `manajemen_gizi_pasien_identity` tersedia, lalu menerapkan
 * migrasi `001_initial_foundation.sql` dan `002_tahap_1_administrator.sql` secara idempoten (forward-only).
 *
 * @param env - Konfigurasi Identity Service.
 * @returns Ringkasan status migrasi.
 */
export async function jalankanMigrasiIdentity(env: IdentityServiceEnv): Promise<{
  skemaDatabase: string;
  versiDiterapkan: string;
  jumlahPernyataan: number;
}> {
  if (!/^[a-zA-Z0-9_]+$/.test(env.DB_NAME_IDENTITY)) {
    throw new Error("Nama database tidak valid untuk pembuatan skema.");
  }

  const poolAdmin = buatPoolDatabaseIdentity(env, false);
  try {
    await poolAdmin.query(
      `CREATE DATABASE IF NOT EXISTS \`${env.DB_NAME_IDENTITY}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
    );
  } finally {
    await poolAdmin.end();
  }

  const pool = buatPoolDatabaseIdentity(env, true);
  try {
    const dirSaatIni = path.dirname(fileURLToPath(import.meta.url));
    const daftarMigrasi = [
      { versi: "001", berkas: "001_initial_foundation.sql" },
      { versi: "002", berkas: "002_tahap_1_administrator.sql" },
      { versi: "003", berkas: "003_operasional_final.sql" },
      { versi: "004", berkas: "004_url_operasional.sql" },
    ] as const;

    let totalPernyataan = 0;

    for (const mig of daftarMigrasi) {
      if (mig.versi !== "001") {
        const [diterapkan] = await pool.execute<mysql.RowDataPacket[]>("SELECT versi FROM migrasi_skema WHERE versi = ?", [mig.versi]);
        if (diterapkan.length > 0) continue;
      }
      const pathMigrasi = path.join(dirSaatIni, "migrations", mig.berkas);
      const isiSql = await readFile(pathMigrasi, "utf8");
      const daftarPernyataan = pisahkanPernyataanSql(isiSql);
      totalPernyataan += daftarPernyataan.length;

      for (const sql of daftarPernyataan) {
        await pool.execute(sql);
      }

      await pool.execute(
        `INSERT IGNORE INTO migrasi_skema (versi, nama_berkas) VALUES (?, ?)`,
        [mig.versi, mig.berkas],
      );
    }

    return {
      skemaDatabase: env.DB_NAME_IDENTITY,
      versiDiterapkan: "004",
      jumlahPernyataan: totalPernyataan,
    };
  } finally {
    await pool.end();
  }
}

/**
 * Menjalankan seeding master minimal (peran, izin, konfigurasi operasional, akun uji sintetis)
 * ke database MySQL secara idempoten dalam satu transaksi atomik.
 *
 * @param pool - Connection pool MySQL aktif.
 */
export async function jalankanSeedMasterIdentityMysql(
  pool: Pool,
): Promise<void> {
  await jalankanDalamTransaksi(pool, async (koneksi) => {
    for (const izin of SEED_IZIN_MASTER) {
      await koneksi.execute(
        `INSERT INTO izin (kode, deskripsi) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE deskripsi = VALUES(deskripsi)`,
        [izin.kode, izin.deskripsi],
      );
    }

    for (const peran of SEED_PERAN_MASTER) {
      await koneksi.execute(
        `INSERT INTO peran (kode, nama, deskripsi_tanggung_jawab, tahap_implementasi, wajib_batas_bangsal)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           nama = VALUES(nama),
           deskripsi_tanggung_jawab = VALUES(deskripsi_tanggung_jawab),
           tahap_implementasi = VALUES(tahap_implementasi),
           wajib_batas_bangsal = VALUES(wajib_batas_bangsal)`,
        [
          peran.kode,
          peran.nama,
          peran.deskripsiTanggungJawab,
          peran.tahapImplementasi,
          peran.wajibBatasBangsal ? 1 : 0,
        ],
      );

      for (const kodeIzin of peran.izinDefault) {
        await koneksi.execute(
          `INSERT IGNORE INTO peran_izin (peran_kode, izin_kode) VALUES (?, ?)`,
          [peran.kode, kodeIzin],
        );
      }
    }

    for (const akun of process.env.HPNMS_SEED_PASSWORD
      ? SEED_PENGGUNA_SINTETIS
      : []) {
      await koneksi.execute(
        `INSERT IGNORE INTO pengguna (id, nama_pengguna, nama_lengkap, password_hash, password_salt, peran_kode, aktif, versi)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         `,
        [
          akun.id,
          akun.namaPengguna,
          akun.namaLengkap,
          akun.passwordHash,
          akun.passwordSalt,
          akun.peran,
          akun.aktif ? 1 : 0,
          akun.versi,
        ],
      );

      for (const bangsalId of akun.daftarBangsalId) {
        await koneksi.execute(
          `INSERT IGNORE INTO pengguna_penugasan_bangsal (pengguna_id, bangsal_id, aktif) VALUES (?, ?, 1)`,
          [akun.id, bangsalId],
        );
      }
    }

    for (const konfig of SEED_KONFIGURASI_OPERASIONAL) {
      await koneksi.execute(
        `INSERT INTO konfigurasi_operasional (kunci, nilai, deskripsi, versi, diperbarui_oleh)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE deskripsi = VALUES(deskripsi)`,
        [
          konfig.kunci,
          konfig.nilai,
          konfig.deskripsi,
          konfig.versi,
          konfig.diperbaruiOleh,
        ],
      );
    }

    for (const notif of process.env.HPNMS_SEED_PASSWORD
      ? SEED_NOTIFIKASI_FONDASI
      : []) {
      await koneksi.execute(
        `INSERT IGNORE INTO notifikasi_pengguna
         (id, peristiwa_id, penerima_id, judul, ringkasan, kategori, prioritas, status_baca, tautan_tujuan, waktu_dibuat, waktu_dibaca)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          notif.id,
          notif.peristiwaId,
          notif.penerimaId,
          notif.judul,
          notif.ringkasan,
          notif.kategori,
          notif.prioritas,
          notif.statusBaca,
          notif.tautanTujuan,
          notif.waktuDibuat.replace("T", " ").replace("Z", ""),
          notif.waktuDibaca
            ? notif.waktuDibaca.replace("T", " ").replace("Z", "")
            : null,
        ],
      );
    }
  });
}
