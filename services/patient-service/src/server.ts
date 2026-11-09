/**
 * @fileoverview Titik masuk server native (tanpa Docker) untuk `patient-service` (port default 4002).
 */

import { muatKonfigurasiPatient } from "./config/env.ts";
import { buatPoolDatabasePatient } from "./database/pool.ts";
import {
  MySqlPatientRepository,
} from "./repository/patient.repository.ts";
import { MySqlInpatientRepository } from "./repository/inpatient.repository.ts";
import { bangunAplikasiPatient } from "./app.ts";

async function mulaiServerPatient(): Promise<void> {
  const envPatient = muatKonfigurasiPatient(process.env);
  const pool = buatPoolDatabasePatient(envPatient, true);
  const patientRepository = new MySqlPatientRepository(pool);
  const inpatientRepository = new MySqlInpatientRepository(pool);
  const status = await patientRepository.cekKesehatanPenyimpanan();
  if (!status.terhubung) {
    await pool.end();
    throw new Error("MySQL patient-service tidak dapat dijangkau.");
  }

  const { app } = await bangunAplikasiPatient({
    envPatient,
    patientRepository,
    inpatientRepository,
  });
  app.addHook("onClose", async () => pool.end());

  await app.listen({
    host: envPatient.PATIENT_SERVICE_HOST,
    port: envPatient.PATIENT_SERVICE_PORT,
  });

  app.log.info(
    `Patient Service berjalan secara native di http://${envPatient.PATIENT_SERVICE_HOST}:${envPatient.PATIENT_SERVICE_PORT}`,
  );
}

const dijalankanLangsung =
  typeof process.argv[1] === "string" &&
  process.argv[1].includes("patient-service");

if (dijalankanLangsung) {
  mulaiServerPatient().catch((galat: unknown) => {
    console.error("Gagal menjalankan Patient Service:", galat);
    process.exit(1);
  });
}
