/**
 * @fileoverview Titik masuk server native (tanpa Docker) untuk `identity-service`.
 * Secara otomatis mencoba menggunakan pool MySQL jika kredensial telah dikonfigurasi,
 * atau menggunakan repositori in-memory sintetis jika database belum disiapkan pada lingkungan pengembangan.
 */

import { muatKonfigurasiIdentity } from "./config/env.ts";
import { buatPoolDatabaseIdentity } from "./database/pool.ts";
import {
  MySqlIdentityRepository,
} from "./repository/identity.repository.ts";
import { bangunAplikasiIdentity } from "./app.ts";

async function mulaiServerIdentity(): Promise<void> {
  const env = muatKonfigurasiIdentity(process.env);
  const pool = buatPoolDatabaseIdentity(env, true);
  const repository = new MySqlIdentityRepository(pool);
  const status = await repository.cekKesehatanPenyimpanan();
  if (!status.terhubung) {
    await pool.end();
    throw new Error("MySQL identity-service tidak dapat dijangkau.");
  }

  const { app } = await bangunAplikasiIdentity({ env, repository });
  app.addHook("onClose", async () => pool.end());

  await app.listen({
    host: env.IDENTITY_SERVICE_HOST,
    port: env.IDENTITY_SERVICE_PORT,
  });

  app.log.info(
    `Identity Service berjalan secara native di http://${env.IDENTITY_SERVICE_HOST}:${env.IDENTITY_SERVICE_PORT}`,
  );
}

const dijalankanLangsung =
  typeof process.argv[1] === "string" &&
  process.argv[1].includes("identity-service");

if (dijalankanLangsung) {
  mulaiServerIdentity().catch((galat: unknown) => {
    console.error("Gagal menjalankan Identity Service:", galat);
    process.exit(1);
  });
}
