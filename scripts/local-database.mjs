import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";

if (existsSync(".env")) process.loadEnvFile(".env");
const executable = process.env.HPNMS_LOCAL_MYSQL_EXE;
const data = process.env.HPNMS_LOCAL_MYSQL_DATA;
if (!executable || !data || !existsSync(executable) || !existsSync(data)) {
  console.error("Gunakan MySQL lokal yang sudah terpasang, atau isi HPNMS_LOCAL_MYSQL_EXE dan HPNMS_LOCAL_MYSQL_DATA di .env.");
  process.exitCode = 1;
} else {
  const port = Number(process.env.DB_PORT ?? 3307);
  assert(Number.isInteger(port) && port > 0 && port <= 65535, "Port MySQL tidak valid.");
  const child = spawn(executable, ["--no-defaults", "--datadir=" + data, "--port=" + port, "--bind-address=127.0.0.1", "--mysqlx=OFF", "--innodb-buffer-pool-size=128M", "--console"], { stdio: "inherit", windowsHide: true });
  child.on("error", () => { console.error("MySQL lokal gagal dijalankan. Periksa lokasi executable dan data."); process.exitCode = 1; });
  child.on("exit", (code) => { process.exitCode = code ?? 0; });
}
