/**
 * @fileoverview Pabrik modul dan aplikasi Fastify untuk `clinical-nutrition-service` (Tahap 3 — Dokter).
 * Dapat dijalankan sebagai server mandiri maupun dipasang pada `api-gateway`.
 */

import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import {
  bangunAplikasiIdentity,
  type OpsiBangunAplikasiIdentity,
} from "../../identity-service/src/app.ts";
import {
  pasangModulPatientService,
  type OpsiPasangModulPatient,
} from "../../patient-service/src/app.ts";
import {
  type KonfigurasiEnvClinicalNutrition,
  muatKonfigurasiClinicalNutrition,
} from "./config/env.ts";
import {
  type ClinicalNutritionRepository,
  InMemoryClinicalNutritionRepository,
} from "./repository/clinical-nutrition.repository.ts";
import { daftarkanRuteClinicalNutrition } from "./route/clinical-nutrition.route.ts";
import { daftarkanRuteNursing } from "./route/nursing.route.ts";
import { daftarkanRuteDietitian } from "./route/dietitian.route.ts";
import { type DependensiLayananClinicalNutrition, ClinicalNutritionService } from "./services/clinical-nutrition.service.ts";

export interface OpsiPasangModulClinicalNutrition {
  clinicalRepository?: ClinicalNutritionRepository;
  kaitanClinical?: Pick<DependensiLayananClinicalNutrition, "periksaMenu" | "padaMenuDisahkan" | "sebelumObservasi" | "padaPerubahanDiet">;
}

/**
 * Memasang modul `clinical-nutrition-service` pada instance Fastify yang sudah memiliki
 * `IdentityService` dan `PatientRepository`.
 */
export async function pasangModulClinicalNutritionService(
  app: FastifyInstance,
  konteksIdentity: Awaited<ReturnType<typeof bangunAplikasiIdentity>>,
  konteksPatient: Awaited<ReturnType<typeof pasangModulPatientService>>,
  opsi: OpsiPasangModulClinicalNutrition = {},
): Promise<{
  clinicalRepository: ClinicalNutritionRepository;
  clinicalService: ClinicalNutritionService;
}> {
  const clinicalRepository =
    opsi.clinicalRepository ?? new InMemoryClinicalNutritionRepository();

  const clinicalService = new ClinicalNutritionService(
    clinicalRepository,
    konteksPatient.patientRepository,
    konteksPatient.inpatientRepository,
    {
      ...opsi.kaitanClinical,
      catatAuditAkses: async (param) => {
        await konteksIdentity.repository.simpanCatatanAudit({
          id: `aud-${randomUUID()}`,
          waktuKejadian: new Date().toISOString(),
          aktorPenggunaId: param.aktorId,
          aktorPeran: param.peranAktor,
          tindakan: param.tindakan,
          objekTipe: param.sumberDaya,
          objekId: param.idSumberDaya ?? "-",
          statusHasil: param.keputusan === "DIIZINKAN" ? "berhasil" : "ditolak",
          alasan: "Rincian pelayanan tersedia pada riwayat unit yang berwenang.",
          correlationId: param.correlationId ?? "corr-anon",
          metadataTersanitasi: {},
        });
      },
      kirimNotifikasiPengguna: async (notifikasi) => {
        await konteksIdentity.repository.simpanNotifikasiBaru({
          id: notifikasi.id,
          peristiwaId: `evt-${randomUUID()}`,
          penerimaId: notifikasi.penerimaId,
          judul: notifikasi.judul,
          ringkasan: notifikasi.pesan,
          kategori: notifikasi.kategori,
          prioritas: notifikasi.prioritas,
          statusBaca: "belum_dibaca",
          tautanTujuan: notifikasi.tautanAksi ?? "/portal",
          waktuDibuat: notifikasi.dibuatPada,
          waktuDibaca: null,
        });
      },
    },
  );

  await daftarkanRuteClinicalNutrition(app, {
    clinicalService,
    identityService: konteksIdentity.service,
    namaCookieSesi: konteksIdentity.env.SESSION_COOKIE_NAME,
  });

  await daftarkanRuteNursing(app, {
    clinicalService,
    identityService: konteksIdentity.service,
    namaCookieSesi: konteksIdentity.env.SESSION_COOKIE_NAME,
  });

  await daftarkanRuteDietitian(app, {
    clinicalService,
    identityService: konteksIdentity.service,
    namaCookieSesi: konteksIdentity.env.SESSION_COOKIE_NAME,
  });

  return { clinicalRepository, clinicalService };
}

export async function bangunAplikasiClinicalNutrition(
  opsi: OpsiBangunAplikasiIdentity &
    OpsiPasangModulPatient &
    OpsiPasangModulClinicalNutrition = {},
): Promise<{
  app: FastifyInstance;
  clinicalRepository: ClinicalNutritionRepository;
  clinicalService: ClinicalNutritionService;
  env: KonfigurasiEnvClinicalNutrition;
}> {
  const konteksIdentity = await bangunAplikasiIdentity(opsi);
  const konteksPatient = await pasangModulPatientService(
    konteksIdentity.app,
    konteksIdentity,
    opsi,
  );
  const modulClinical = await pasangModulClinicalNutritionService(
    konteksIdentity.app,
    konteksIdentity,
    konteksPatient,
    opsi,
  );
  const env = muatKonfigurasiClinicalNutrition();

  return {
    app: konteksIdentity.app,
    clinicalRepository: modulClinical.clinicalRepository,
    clinicalService: modulClinical.clinicalService,
    env,
  };
}
