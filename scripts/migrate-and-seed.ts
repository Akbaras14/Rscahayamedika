import { jalankanSeedMasterLokal } from "./seed-local-masters.ts";
/**
 * @fileoverview Skrip native untuk menjalankan migrasi SQL (`001_initial_foundation.sql`)
 * dan seeding master minimal ke server MySQL lokal (tanpa Docker).
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { muatKonfigurasiIdentity } from "../services/identity-service/src/config/env.ts";
import {
  buatPoolDatabaseIdentity,
  jalankanMigrasiIdentity,
  jalankanSeedMasterIdentityMysql,
  pisahkanPernyataanSql,
} from "../services/identity-service/src/database/pool.ts";
import { muatKonfigurasiPatient } from "../services/patient-service/src/config/env.ts";
import {
  buatPoolDatabasePatient,
  jalankanMigrasiPatient,
  jalankanSeedPatientMysql,
} from "../services/patient-service/src/database/pool.ts";

async function migrasikanDomain(
  env: { host: string; port: number; user: string; password: string; timeout: number },
  namaDatabase: string,
  direktoriMigrasi: string,
  berkasMigrasi: readonly string[],
): Promise<void> {
  if (!/^[a-zA-Z0-9_]+$/.test(namaDatabase)) {
    throw new Error("Nama database domain tidak valid.");
  }
  const admin = await mysql.createConnection({
    host: env.host,
    port: env.port,
    user: env.user,
    password: env.password,
    connectTimeout: env.timeout,
  });
  try {
    await admin.query(
      `CREATE DATABASE IF NOT EXISTS \`${namaDatabase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
    );
  } finally {
    await admin.end();
  }

  const pool = mysql.createPool({
    host: env.host,
    port: env.port,
    user: env.user,
    password: env.password,
    database: namaDatabase,
    connectTimeout: env.timeout,
    connectionLimit: 5,
    timezone: "Z",
  });
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS _skema_migrasi (
      versi VARCHAR(128) NOT NULL PRIMARY KEY,
      diterapkan_pada DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB`);
    for (const namaBerkas of berkasMigrasi) {
      const versi = namaBerkas.replace(".sql", "");
      const [sudahAda] = await pool.execute(
        "SELECT versi FROM _skema_migrasi WHERE versi = ?",
        [versi],
      );
      if (Array.isArray(sudahAda) && sudahAda.length > 0) continue;
      const isi = await readFile(path.join(direktoriMigrasi, namaBerkas), "utf8");
      for (const pernyataan of pisahkanPernyataanSql(isi)) {
        await pool.query(pernyataan);
      }
      await pool.execute("INSERT INTO _skema_migrasi (versi) VALUES (?)", [versi]);
    }
  } finally {
    await pool.end();
  }
}

async function utama(): Promise<void> {
  const env = muatKonfigurasiIdentity(process.env);
  const envPatient = muatKonfigurasiPatient(process.env);
  if (env.NODE_ENV === "production" && process.env.HPNMS_SEED_PASSWORD) {
    throw new Error("HPNMS_SEED_PASSWORD tidak boleh diaktifkan di produksi.");
  }
  const dirSaatIni = path.dirname(fileURLToPath(import.meta.url));
  const pathSql001 = path.resolve(
    dirSaatIni,
    "../services/identity-service/src/database/migrations/001_initial_foundation.sql",
  );
  const pathSql002 = path.resolve(
    dirSaatIni,
    "../services/identity-service/src/database/migrations/002_tahap_1_administrator.sql",
  );
  const pathSqlPatient001 = path.resolve(
    dirSaatIni,
    "../services/patient-service/src/database/migrations/001_tahap_2_pendaftaran_pasien.sql",
  );
  const pathSqlPatient002 = path.resolve(
    dirSaatIni,
    "../services/patient-service/src/database/migrations/002_tahap_4_rawat_inap.sql",
  );
  const [isiSql001, isiSql002, isiSqlPatient001, isiSqlPatient002] = await Promise.all([
    readFile(pathSql001, "utf8"),
    readFile(pathSql002, "utf8"),
    readFile(pathSqlPatient001, "utf8"),
    readFile(pathSqlPatient002, "utf8"),
  ]);
  const pernyataan001 = pisahkanPernyataanSql(isiSql001);
  const pernyataan002 = pisahkanPernyataanSql(isiSql002);
  const pernyataanPatient = [isiSqlPatient001, isiSqlPatient002]
    .map((isi) => pisahkanPernyataanSql(isi).length)
    .reduce((jumlah, total) => jumlah + total, 0);

  console.log(
    `[Migrasi] Identity (${pernyataan001.length + pernyataan002.length} DDL), patient (${pernyataanPatient} DDL), dan migrasi domain lain akan diterapkan.`,
  );

  try {
    const hasilMigrasi = await jalankanMigrasiIdentity(env);
    console.log(
      `[Migrasi] Skema MySQL '${hasilMigrasi.skemaDatabase}' berhasil dimigrasi ke versi ${hasilMigrasi.versiDiterapkan}.`,
    );

    const pool = buatPoolDatabaseIdentity(env, true);
    try {
      await jalankanSeedMasterIdentityMysql(pool);
      console.log(
        `[Seed Identity] Data master diterapkan${process.env.HPNMS_SEED_PASSWORD ? " bersama akun sintetis development" : "; akun tidak dibuat (HPNMS_SEED_PASSWORD tidak diatur)"}.`,
      );
    } finally {
      await pool.end();
    }

    const hasilMigrasiPatient = await jalankanMigrasiPatient(envPatient);
    console.log(
      `[Migrasi] Skema MySQL '${hasilMigrasiPatient.skemaDatabase}' berhasil dimigrasi ke versi ${hasilMigrasiPatient.versiDiterapkan}.`,
    );

    const domainConfig = {
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      timeout: env.DB_CONNECT_TIMEOUT_MS,
    };
    const dirLayanan = (nama: string) =>
      path.resolve(dirSaatIni, `../services/${nama}/src/database/migrations`);
    const domainLain = [
      [process.env.DB_DATABASE_CLINICAL ?? "manajemen_gizi_pasien_clinical", "clinical-nutrition-service", ["001_tahap_3_clinical_nutrition.sql", "002_tahap_5_nursing.sql", "003_tahap_6_dietitian.sql", "004_pengajuan_keputusan.sql", "005_integritas_versi_diet.sql"]],
      [process.env.DB_DATABASE_INVENTORY ?? "manajemen_gizi_pasien_inventory", "inventory-service", ["001_tahap_7_inventory.sql"]],
      [process.env.DB_DATABASE_KITCHEN ?? "manajemen_gizi_pasien_kitchen", "kitchen-service", ["001_tahap_8_kitchen.sql"]],
      [process.env.DB_DATABASE_DELIVERY ?? "manajemen_gizi_pasien_delivery", "delivery-intake-service", ["001_tahap_9_delivery.sql", "002_presisi_waktu_serah.sql"]],
      [process.env.DB_DATABASE_INCIDENT ?? "manajemen_gizi_pasien_incident", "incident-audit-service", ["001_tahap_10_incidents_audit.sql"]],
    ] as const;
    for (const [namaDatabase, layanan, berkas] of domainLain) {
      await migrasikanDomain(domainConfig, namaDatabase, dirLayanan(layanan), berkas);
      console.log(`[Migrasi] Skema MySQL '${namaDatabase}' tervalidasi.`);
    }

    if (env.NODE_ENV !== "production") {
      const poolPatient = buatPoolDatabasePatient(envPatient, true);
      try {
        await jalankanSeedPatientMysql(poolPatient);
        console.log("[Seed Patient] Data pasien & kunjungan sintetis development diterapkan.");
        if (process.env.HPNMS_SEED_PASSWORD) await jalankanSeedMasterLokal();
      } finally {
        await poolPatient.end();
      }
    }
  } catch (galat: unknown) {
    const kode =
      typeof galat === "object" && galat !== null && "code" in galat
        ? String(galat.code)
        : "MIGRATION_FAILED";
    console.error(
      `[Migrasi gagal] Koneksi atau penerapan skema gagal (${kode}). Periksa konfigurasi MySQL lalu jalankan ulang perintah db:migrate.`,
    );
    process.exitCode = 1;
  }
}

utama().catch((galat: unknown) => {
  console.error("Gagal menjalankan skrip migrasi:", galat);
  process.exit(1);
});
