/**
 * @fileoverview Titik masuk native (tanpa Docker) untuk `delivery-intake-service` (Tahap 9 — Petugas Distribusi).
 */

import { bangunAplikasiDelivery } from "./app.ts";

async function mulaiServerDelivery(): Promise<void> {
  const host = process.env.DELIVERY_SERVICE_HOST ?? "127.0.0.1";
  const port = Number(process.env.DELIVERY_SERVICE_PORT ?? 4006);

  const { app } = await bangunAplikasiDelivery();

  await app.listen({ host, port });
  app.log.info(
    `Delivery Service berjalan secara native di http://${host}:${port}`,
  );
}

const dijalankanLangsung =
  typeof process.argv[1] === "string" &&
  process.argv[1].includes("delivery-intake-service");

if (dijalankanLangsung) {
  mulaiServerDelivery().catch((galat: unknown) => {
    console.error("Gagal menjalankan Delivery Service:", galat);
    process.exit(1);
  });
}

