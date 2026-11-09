import { daftarkanRuteOperasional, kabariKepala } from "./route/operasional.route.ts";
/**
 * @fileoverview Pabrik aplikasi Fastify untuk API Gateway HPNMS.
 * Mengintegrasikan rute fondasi `identity-service` pada Tahap 0 serta memblokir
 * domain microservice Tahap 1–10 secara fail-closed.
 */

import type { FastifyInstance } from "fastify";
import {
  pasangModulClinicalNutritionService,
  type OpsiPasangModulClinicalNutrition,
} from "../../clinical-nutrition-service/src/app.ts";
import {
  bangunAplikasiIdentity,
  type OpsiBangunAplikasiIdentity,
} from "../../identity-service/src/app.ts";
import {
  pasangModulInventoryService,
  type OpsiPasangModulInventory,
} from "../../inventory-service/src/app.ts";
import {
  pasangModulKitchenService,
  type OpsiPasangModulKitchen,
} from "../../kitchen-service/src/app.ts";
import {
  pasangModulDeliveryService,
  type OpsiPasangModulDelivery,
} from "../../delivery-intake-service/src/app.ts";
import {
  pasangModulIncidentService,
  type OpsiPasangModulIncident,
} from "../../incident-audit-service/src/app.ts";
import {
  type OpsiPasangModulPatient,
  pasangModulPatientService,
} from "../../patient-service/src/app.ts";
import { GatewayRouteRepository } from "./repository/gateway.repository.ts";
import { daftarkanRuteGateway } from "./route/gateway.route.ts";
import { AlurGiziService } from "./services/alur-gizi.service.ts";
import { AppError } from "../../identity-service/src/model/errors.ts";
import { KODE_GALAT } from "../../../packages/shared-types/src/index.ts";
import { GatewayService } from "./services/gateway.service.ts";

export async function bangunAplikasiGateway(
  opsi: OpsiBangunAplikasiIdentity &
    OpsiPasangModulPatient &
    OpsiPasangModulClinicalNutrition &
    OpsiPasangModulInventory &
    OpsiPasangModulKitchen &
    OpsiPasangModulDelivery &
    OpsiPasangModulIncident = {},
): Promise<{
  app: FastifyInstance;
  gatewayService: GatewayService;
}> {
  const konteksIdentity = await bangunAplikasiIdentity(opsi);
  const konteksPatient = await pasangModulPatientService(
    konteksIdentity.app,
    konteksIdentity,
    {
      patientRepository: opsi.patientRepository,
      inpatientRepository: opsi.inpatientRepository,
    },
  );
  const konteksClinical = await pasangModulClinicalNutritionService(
    konteksIdentity.app,
    konteksIdentity,
    konteksPatient,
    {
      clinicalRepository: opsi.clinicalRepository,
      kaitanClinical: {
        padaPerubahanDiet: (pasienId) => alur.tinjauPesanan(pasienId),
        periksaMenu: (menu) => alur.periksaMenu(menu),
        padaMenuDisahkan: (menu, profil) => alur.buatPesanan(menu, profil),
        sebelumObservasi: async (input) => {
          if (input.skalaComstock === "belum_diobservasi") return;
          const episode = await konteksPatient.inpatientRepository.ambilEpisodeBerdasarkanId(input.episodeId);
          const porsi = await konteksDelivery.deliveryRepository.ambilDaftarItemPorsi({ statusSerah: "berhasil_diserahkan" });
          const menu = await konteksClinical.clinicalRepository.ambilDaftarRencanaMenuIndividual({ episodeId: input.episodeId, tanggalPelayanan: input.tanggalMakan });
          if (!episode || !porsi.some((p) => p.pasienId === episode.pasienId && menu.some((m) => m.id === p.nomorPesanan && m.jadwalMakan === input.jadwalMakan.replace("selingan_", "snack_")))) {
            throw new AppError({ kode: KODE_GALAT.PENAHANAN_KESELAMATAN, statusHttp: 422, pesanPengguna: "Konsumsi hanya dapat dicatat untuk makanan yang telah diserahkan pada tanggal dan sesi ini." });
          }
        },
      },
    },
  );
  const konteksInventory = await pasangModulInventoryService(
    konteksIdentity.app,
    konteksIdentity,
    {
      inventoryRepository: opsi.inventoryRepository,
    },
  );
  const konteksKitchen = await pasangModulKitchenService(
    konteksIdentity.app,
    konteksIdentity,
    {
      kitchenRepository: opsi.kitchenRepository,
      kaitanKitchen: {
        hitungRencana: (rencana) => alur.hitungRencana(rencana),
        periksaBatch: (input) => alur.periksaBatch(input),
        tinjauPesanan: () => alur.tinjauPesanan(),
        periksaPorsi: async (label, batch) => {
          const menu = await konteksClinical.clinicalRepository.ambilRencanaMenuIndividualBerdasarkanId(label.nomorPesanan);
          if (!menu || menu.statusPengesahan !== "disahkan") throw new AppError({ kode: KODE_GALAT.PENAHANAN_KESELAMATAN, statusHttp: 422, pesanPengguna: "Label tidak terhubung ke pesanan individual sah." });
          await alur.periksaMenu(menu);
          if (batch && (batch.resepId !== menu.menuId || batch.sesiMakan !== menu.jadwalMakan)) throw new AppError({ kode: KODE_GALAT.PENAHANAN_KESELAMATAN, statusHttp: 422, pesanPengguna: "Batch tidak sesuai resep atau sesi pesanan." });
          if (batch) {
            const rencana = await konteksKitchen.kitchenRepository.ambilRencanaProduksiBerdasarkanId(batch.rencanaProduksiId);
            if (rencana?.tanggalPelayanan !== menu.tanggalPelayanan) throw new AppError({ kode: KODE_GALAT.PENAHANAN_KESELAMATAN, statusHttp: 422, pesanPengguna: "Tanggal produksi tidak sesuai pesanan pasien." });
            const labels = await konteksKitchen.kitchenRepository.ambilLabelBerdasarkanBatch(batch.id);
            let porsiTerpakai = 0;
            for (const item of labels.filter((l) => l.id !== label.id && l.statusPorsi !== "batal")) {
              const pesanan = await konteksClinical.clinicalRepository.ambilRencanaMenuIndividualBerdasarkanId(item.nomorPesanan);
              porsiTerpakai += pesanan?.porsi ?? 1;
            }
            if (porsiTerpakai + menu.porsi > batch.jumlahPorsiRealisasi) throw new AppError({ kode: KODE_GALAT.PENAHANAN_KESELAMATAN, statusHttp: 422, pesanPengguna: "Porsi kemasan melebihi realisasi batch produksi." });
          }

        },
        padaPorsiSiap: (label) => alur.siapkanDistribusi(label),
      },
    },
  );
  const konteksDelivery = await pasangModulDeliveryService(
    konteksIdentity.app,
    konteksIdentity,
    {
      deliveryRepository: opsi.deliveryRepository,
      kaitanDelivery: {
        padaInsidenDilaporkan: async (laporan) => {
          const now = new Date().toISOString(), id = "gizi-" + laporan.id;
          if (!await konteksIncident.incidentRepository.ambilInsidenBerdasarkanId(id)) await konteksIncident.incidentRepository.simpanInsiden({ id, nomorInsiden: await konteksIncident.incidentRepository.hitungNomorInsidenBerikutnya(), unitPelapor: "distribusi", tanggalKejadian: laporan.waktuKejadian, jenisInsiden: laporan.jenisInsiden, derajatKeparahan: "sedang", deskripsiKejadian: laporan.deskripsiInsiden, tindakanAwalSegera: laporan.tindakanKoreksi, pasienTerdampakNama: null, nomorRmPasien: null, namaBangsal: laporan.namaBangsal, statusInsiden: "dilaporkan", pelaporId: laporan.dilaporkanOlehId, pelaporNama: laporan.dilaporkanOlehNama, penanggungJawabId: null, penanggungJawabNama: null, waktuPenutupan: null, catatanPenutupan: null, createdAt: now, updatedAt: now });
          await kabariKepala(konteksIdentity, id);
        },
        tinjauPesanan: () => alur.tinjauPesanan(),
        periksaPenyerahan: (porsi) => alur.periksaPenyerahan(porsi),
      },
    },
  );
  const konteksIncident = await pasangModulIncidentService(
    konteksIdentity.app,
    konteksIdentity,
    {
      incidentRepository: opsi.incidentRepository,
    },
  );

  const repositoriAlur = {
    clinical: konteksClinical.clinicalRepository,
    kitchen: konteksKitchen.kitchenRepository,
    inventory: konteksInventory.inventoryRepository,
    delivery: konteksDelivery.deliveryRepository,
    inpatient: konteksPatient.inpatientRepository,
    patient: konteksPatient.patientRepository,
  };
  const alur = new AlurGiziService(repositoriAlur);
  await daftarkanRuteOperasional(konteksIdentity.app, konteksIdentity, repositoriAlur, alur, konteksIncident.incidentRepository);

  const gatewayRepo = new GatewayRouteRepository();
  const gatewayService = new GatewayService(gatewayRepo);

  await daftarkanRuteGateway(konteksIdentity.app, gatewayService);

  return { app: konteksIdentity.app, gatewayService };
}

