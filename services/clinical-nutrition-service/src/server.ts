/**
 * @fileoverview Titik masuk native (tanpa Docker) untuk `clinical-nutrition-service` (Tahap 3 — Dokter).
 */

import { bangunAplikasiClinicalNutrition } from "./app.ts";

async function mulaiServerClinicalNutrition(): Promise<void> {
  const host = process.env.CLINICAL_SERVICE_HOST ?? "127.0.0.1";
  const port = Number(process.env.CLINICAL_SERVICE_PORT ?? 4003);

  const { app } = await bangunAplikasiClinicalNutrition();

  await app.listen({ host, port });
  app.log.info(
    `Clinical Nutrition Service berjalan secara native di http://${host}:${port}`,
  );
}

const dijalankanLangsung =
  typeof process.argv[1] === "string" &&
  process.argv[1].includes("clinical-nutrition-service");

if (dijalankanLangsung) {
  mulaiServerClinicalNutrition().catch((galat: unknown) => {
    console.error("Gagal menjalankan Clinical Nutrition Service:", galat);
    process.exit(1);
  });
}

