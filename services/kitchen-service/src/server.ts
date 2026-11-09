/**
 * @fileoverview Titik masuk native (tanpa Docker) untuk `kitchen-service` (Tahap 8 — Petugas Dapur).
 */

import { bangunAplikasiKitchen } from "./app.ts";

async function mulaiServerKitchen(): Promise<void> {
  const host = process.env.KITCHEN_SERVICE_HOST ?? "127.0.0.1";
  const port = Number(process.env.KITCHEN_SERVICE_PORT ?? 4005);

  const { app } = await bangunAplikasiKitchen();

  await app.listen({ host, port });
  app.log.info(
    `Kitchen Service berjalan secara native di http://${host}:${port}`,
  );
}

const dijalankanLangsung =
  typeof process.argv[1] === "string" &&
  process.argv[1].includes("kitchen-service");

if (dijalankanLangsung) {
  mulaiServerKitchen().catch((galat: unknown) => {
    console.error("Gagal menjalankan Kitchen Service:", galat);
    process.exit(1);
  });
}

