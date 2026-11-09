import { MySqlPatientRepository } from "../services/patient-service/src/repository/patient.repository.ts";
import { SEED_KUNJUNGAN_SINTETIS } from "../services/patient-service/src/database/seeds/patient.seed.ts";
import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { parameterMysql } from "../packages/database/src/mysql.ts";
import { SEED_BANGSAL_SINTETIS, SEED_KAMAR_SINTETIS, SEED_TEMPAT_TIDUR_SINTETIS, SEED_EPISODE_RAWAT_INAP_SINTETIS, SEED_PENEMPATAN_TEMPAT_TIDUR_SINTETIS } from "../services/patient-service/src/database/seeds/inpatient.seed.ts";
import { MySqlInpatientRepository } from "../services/patient-service/src/repository/inpatient.repository.ts";
import { MySqlClinicalNutritionRepository } from "../services/clinical-nutrition-service/src/repository/clinical-nutrition.repository.ts";
import { SEED_KATALOG_MENU_RESEP, SEED_ASUHAN_GIZI } from "../services/clinical-nutrition-service/src/database/seeds/dietitian.seed.ts";
import { SEED_ALERGI_SINTETIS, SEED_INSTRUKSI_DIET_SINTETIS, SEED_PEMERIKSAAN_SINTETIS, SEED_PENGAJUAN_RAWAT_INAP_SINTETIS } from "../services/clinical-nutrition-service/src/database/seeds/clinical-nutrition.seed.ts";
import { SEED_SKRINING_GIZI_SINTETIS, SEED_VERIFIKASI_KEAMANAN_SINTETIS } from "../services/clinical-nutrition-service/src/database/seeds/nursing.seed.ts";
import { SEED_KATALOG_BAHAN, SEED_PENERIMAAN_LOT } from "../services/inventory-service/src/database/seeds/inventory.seed.ts";
import { MySqlInventoryRepository } from "../services/inventory-service/src/repository/inventory.repository.ts";
import type { EntitasKatalogBahan } from "../services/inventory-service/src/model/inventory.model.ts";

async function belumAda(pool: Pool, table: string, id: string): Promise<boolean> {
  const [rows] = await pool.execute<RowDataPacket[]>("SELECT id FROM " + table + " WHERE id = ?", [id]);
  return rows.length === 0;
}

/** Seed sintetis eksplisit untuk demonstrasi lokal; tidak memperbarui rekaman yang sudah ada. */
export async function jalankanSeedMasterLokal(): Promise<void> {
  const config = { host: process.env.DB_HOST ?? "127.0.0.1", port: Number(process.env.DB_PORT ?? 3306), user: process.env.DB_USER ?? "hpnms_app_user", password: process.env.DB_PASSWORD ?? "", timezone: "Z", dateStrings: true, connectionLimit: 3 };
  const patient = mysql.createPool({ ...config, database: process.env.DB_NAME_PATIENT ?? "manajemen_gizi_pasien_patient" });
  const clinical = mysql.createPool({ ...config, database: process.env.DB_DATABASE_CLINICAL ?? "manajemen_gizi_pasien_clinical" });
  const inventory = mysql.createPool({ ...config, database: process.env.DB_DATABASE_INVENTORY ?? "manajemen_gizi_pasien_inventory" });
  try {
    for (const [table, items] of [["bangsal", SEED_BANGSAL_SINTETIS], ["kamar", SEED_KAMAR_SINTETIS], ["tempat_tidur", SEED_TEMPAT_TIDUR_SINTETIS]] as const) {
      for (const item of items) {
        if (!await belumAda(patient, table, item.id)) continue;
        const entries = Object.entries(item);
        const columns = entries.map(([key]) => key.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase()));
        await patient.execute("INSERT INTO " + table + " (" + columns.join(",") + ") VALUES (" + columns.map(() => "?").join(",") + ")", parameterMysql(entries.map(([, v]) => v)));
      }
    }
    const pasienRepo = new MySqlPatientRepository(patient);
    for (const nomor of [2, 3]) {
      const id = "knj-sintetis-00" + nomor;
      if (await belumAda(patient, "kunjungan", id)) await pasienRepo.simpanKunjunganBaru({ ...SEED_KUNJUNGAN_SINTETIS[0], id, pasienId: "psn-sintetis-00" + nomor, nomorKunjungan: "KNJ-20261108-000" + nomor, nomorAntreanHarian: nomor, kodeAntrean: "POLI-PD-00" + nomor });
    }
    const ri = new MySqlInpatientRepository(patient);
    for (const e of SEED_EPISODE_RAWAT_INAP_SINTETIS) if (await belumAda(patient, "episode_rawat_inap", e.id)) await ri.simpanEpisodeRawatInap(e);
    for (const e of SEED_PENEMPATAN_TEMPAT_TIDUR_SINTETIS) if (await belumAda(patient, "penempatan_tempat_tidur", e.id)) await ri.simpanPenempatanTempatTidur(e);
    const cn = new MySqlClinicalNutritionRepository(clinical);
    for (const e of SEED_PEMERIKSAAN_SINTETIS) if (await belumAda(clinical, "pemeriksaan_klinis", e.id)) await cn.simpanPemeriksaanKlinis(e);
    for (const e of SEED_ALERGI_SINTETIS) if (await belumAda(clinical, "alergi_pasien", e.id)) await cn.simpanAlergiPasien(e);
    for (const e of SEED_INSTRUKSI_DIET_SINTETIS) if (await belumAda(clinical, "instruksi_diet", e.id)) await cn.simpanInstruksiDiet(e);
    for (const e of SEED_PENGAJUAN_RAWAT_INAP_SINTETIS) if (await belumAda(clinical, "pengajuan_rawat_inap", e.id)) await cn.simpanPengajuanRawatInap(e);
    for (const e of SEED_SKRINING_GIZI_SINTETIS) if (await belumAda(clinical, "skrining_gizi", e.id)) await cn.simpanSkriningGizi(e);
    for (const e of SEED_VERIFIKASI_KEAMANAN_SINTETIS) if (await belumAda(clinical, "verifikasi_keamanan_makanan", e.id)) await cn.simpanVerifikasiKeamananMakanan(e);
    for (const e of SEED_ASUHAN_GIZI) if (await belumAda(clinical, "asuhan_gizi_adime", e.id)) await cn.simpanAsuhanGizi(e);
    const inv = new MySqlInventoryRepository(inventory);
    for (const e of SEED_KATALOG_BAHAN) if (await belumAda(inventory, "katalog_bahan_baku", e.id)) await inv.simpanBahan(e);
    for (const e of SEED_PENERIMAAN_LOT) if (await belumAda(inventory, "penerimaan_lot_bahan", e.id)) await inv.simpanPenerimaanLot(e);
    const now = new Date().toISOString();
    for (const resep of SEED_KATALOG_MENU_RESEP) {
      const komposisiBahan = [];
      for (const bahan of resep.komposisiBahan) {
        const master = await inv.ambilBahanBerdasarkanKode(bahan.kodeBahan) ?? await inv.ambilBahanBerdasarkanKode(bahan.kodeBahan + "-01");
        if (!master) {
          const baru: EntitasKatalogBahan = { ...SEED_KATALOG_BAHAN[0], id: "master-" + bahan.kodeBahan, kodeBahan: bahan.kodeBahan, namaBahan: bahan.namaBahan, satuan: bahan.satuan === "ml" ? "liter" : "kg", stokMinimum: 0, stokFisik: 0, stokLayak: 0, stokDialokasikan: 0, stokDitahan: 0, daftarAlergen: resep.alergen, kaloriPer100g: 0, proteinPer100g: 0, lemakPer100g: 0, karbohidratPer100g: 0, dibuatPada: now, diperbaruiPada: now };
          await inv.simpanBahan(baru);
        }
        komposisiBahan.push({ ...bahan, kodeBahan: master?.kodeBahan ?? bahan.kodeBahan });
      }
      if (await belumAda(clinical, "katalog_menu_resep", resep.id)) await cn.simpanMenuResep({ ...resep, komposisiBahan });
    }
    console.log("[Seed lokal] Bangsal, tempat tidur, pasien sintetis, resep, dan master bahan tersimpan. Rekaman lama dipertahankan.");
  } finally {
    await Promise.all([patient.end(), clinical.end(), inventory.end()]);
  }
}
