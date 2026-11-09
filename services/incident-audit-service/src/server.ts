/**
 * @fileoverview Titik masuk native (tanpa Docker) untuk `incident-audit-service` (Tahap 10 — Kepala Instalasi Gizi).
 */

import { bangunAplikasiIncident } from "./app.ts";

async function mulaiServerIncident(): Promise<void> {
  const host = process.env.INCIDENT_SERVICE_HOST ?? "127.0.0.1";
  const port = Number(process.env.INCIDENT_SERVICE_PORT ?? 4007);

  const { app } = await bangunAplikasiIncident();

  await app.listen({ host, port });
  app.log.info(
    `Incident & Audit Service berjalan secara native di http://${host}:${port}`,
  );
}

const dijalankanLangsung =
  typeof process.argv[1] === "string" &&
  process.argv[1].includes("incident-audit-service");

if (dijalankanLangsung) {
  mulaiServerIncident().catch((galat: unknown) => {
    console.error("Gagal menjalankan Incident & Audit Service:", galat);
    process.exit(1);
  });
}

