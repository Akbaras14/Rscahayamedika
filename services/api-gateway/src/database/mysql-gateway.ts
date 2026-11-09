import mysql, { type Pool } from "mysql2/promise";
import { bangunAplikasiGateway } from "../app.ts";
import { muatKonfigurasiIdentity } from "../../../identity-service/src/config/env.ts";
import { buatPoolDatabaseIdentity } from "../../../identity-service/src/database/pool.ts";
import { MySqlIdentityRepository } from "../../../identity-service/src/repository/identity.repository.ts";
import { muatKonfigurasiPatient } from "../../../patient-service/src/config/env.ts";
import { buatPoolDatabasePatient } from "../../../patient-service/src/database/pool.ts";
import { MySqlPatientRepository } from "../../../patient-service/src/repository/patient.repository.ts";
import { MySqlInpatientRepository } from "../../../patient-service/src/repository/inpatient.repository.ts";
import { MySqlClinicalNutritionRepository } from "../../../clinical-nutrition-service/src/repository/clinical-nutrition.repository.ts";
import { MySqlInventoryRepository } from "../../../inventory-service/src/repository/inventory.repository.ts";
import { MySqlKitchenRepository } from "../../../kitchen-service/src/repository/kitchen.repository.ts";
import { MySqlDeliveryRepository } from "../../../delivery-intake-service/src/repository/delivery.repository.ts";
import { MySqlIncidentRepository } from "../../../incident-audit-service/src/repository/mysql-incident.repository.ts";

/** Membuat gateway produksi dengan repository MySQL dan menutup seluruh pool saat shutdown. */
export async function bangunGatewayMySql() {
  const env = muatKonfigurasiIdentity(process.env);
  const envPatient = muatKonfigurasiPatient(process.env);
  const pools: Pool[] = [
    buatPoolDatabaseIdentity(env),
    buatPoolDatabasePatient(envPatient),
  ];
  const namaSkema = [
    process.env.DB_DATABASE_CLINICAL ?? "manajemen_gizi_pasien_clinical",
    process.env.DB_DATABASE_INVENTORY ?? "manajemen_gizi_pasien_inventory",
    process.env.DB_DATABASE_KITCHEN ?? "manajemen_gizi_pasien_kitchen",
    process.env.DB_DATABASE_DELIVERY ?? "manajemen_gizi_pasien_delivery",
    process.env.DB_DATABASE_INCIDENT ?? "manajemen_gizi_pasien_incident",
  ];
  for (const database of namaSkema) {
    if (!/^[a-zA-Z0-9_]+$/.test(database)) throw new Error("Nama skema database tidak valid.");
    pools.push(mysql.createPool({
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database,
      waitForConnections: true,
      connectionLimit: env.DB_CONNECTION_LIMIT,
      queueLimit: 50,
      connectTimeout: env.DB_CONNECT_TIMEOUT_MS,
      timezone: "Z",
      dateStrings: true,
    }));
  }

  try {
    await Promise.all(pools.map((pool) => pool.query("SELECT 1")));
    const [identity, patient, clinical, inventory, kitchen, delivery, incident] = pools;
    if (!identity || !patient || !clinical || !inventory || !kitchen || !delivery || !incident) {
      throw new Error("Koneksi database domain tidak lengkap.");
    }
    const hasil = await bangunAplikasiGateway({
      env,
      repository: new MySqlIdentityRepository(identity),
      patientRepository: new MySqlPatientRepository(patient),
      inpatientRepository: new MySqlInpatientRepository(patient),
      clinicalRepository: new MySqlClinicalNutritionRepository(clinical),
      inventoryRepository: new MySqlInventoryRepository(inventory),
      kitchenRepository: new MySqlKitchenRepository(kitchen),
      deliveryRepository: new MySqlDeliveryRepository(delivery),
      incidentRepository: new MySqlIncidentRepository(incident),
    });
    hasil.app.addHook("onClose", async () => {
      await Promise.all(pools.map((pool) => pool.end()));
    });
    return hasil;
  } catch (error) {
    await Promise.all(pools.map((pool) => pool.end().catch(() => undefined)));
    throw error;
  }
}
