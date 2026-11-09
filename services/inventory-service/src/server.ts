/**
 * @fileoverview Titik masuk native (tanpa Docker) untuk `inventory-service` (Tahap 7 — Petugas Gudang).
 */

import { bangunAplikasiInventory } from "./app.ts";

async function mulaiServerInventory(): Promise<void> {
  const host = process.env.INVENTORY_SERVICE_HOST ?? "127.0.0.1";
  const port = Number(process.env.INVENTORY_SERVICE_PORT ?? 4004);

  const { app } = await bangunAplikasiInventory();

  await app.listen({ host, port });
  app.log.info(
    `Inventory Service berjalan secara native di http://${host}:${port}`,
  );
}

const dijalankanLangsung =
  typeof process.argv[1] === "string" &&
  process.argv[1].includes("inventory-service");

if (dijalankanLangsung) {
  mulaiServerInventory().catch((galat: unknown) => {
    console.error("Gagal menjalankan Inventory Service:", galat);
    process.exit(1);
  });
}

