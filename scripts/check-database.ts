import { buatPoolDatabaseIdentity } from "../services/identity-service/src/database/pool.ts";
import { muatKonfigurasiIdentity } from "../services/identity-service/src/config/env.ts";
import type { RowDataPacket } from "mysql2/promise";

async function main(): Promise<void> {
  const env = muatKonfigurasiIdentity(process.env);
  const pool = buatPoolDatabaseIdentity(env, false);
  try {
    const [rows] = await pool.query("SELECT VERSION() AS versi");
    const versi = (rows as RowDataPacket[])[0]?.versi as string | undefined;
    const versiServer = versi ?? "";
    const versiMysql = versiServer.match(/^(\d+)\.(\d+)/);
    if (versiServer.toLowerCase().includes("mariadb") || !versiMysql || Number(versiMysql[1]) < 8) {
      throw new Error("Server harus MySQL 8.0 atau lebih baru.");
    }
    console.log(`Koneksi MySQL berhasil; versi server ${versiServer}.`);
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "DATABASE_CHECK_FAILED";
    console.error(`Koneksi database gagal (${code}). Periksa .env dan pastikan server MySQL 8.0+ aktif.`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();
