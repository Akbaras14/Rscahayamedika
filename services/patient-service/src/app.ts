/**
 * @fileoverview Pabrik modul dan aplikasi Fastify untuk `patient-service` (Tahap 2 — Petugas Pendaftaran).
 * Dapat dijalankan sebagai server mandiri maupun dipasang pada `api-gateway` untuk orkestrasi BFF.
 */

import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import {
  bangunAplikasiIdentity,
  type OpsiBangunAplikasiIdentity,
} from "../../identity-service/src/app.ts";
import {
  type KonfigurasiEnvPatient,
  muatKonfigurasiPatient,
} from "./config/env.ts";
import {
  InMemoryInpatientRepository,
  type InpatientRepository,
} from "./repository/inpatient.repository.ts";
import {
  InMemoryPatientRepository,
  type PatientRepository,
} from "./repository/patient.repository.ts";
import { daftarkanRuteInpatient } from "./route/inpatient.route.ts";
import { daftarkanRutePatient } from "./route/patient.route.ts";
import { InpatientService } from "./services/inpatient.service.ts";
import { PatientService } from "./services/patient.service.ts";

export interface OpsiPasangModulPatient {
  patientRepository?: PatientRepository;
  inpatientRepository?: InpatientRepository;
}

/**
 * Memasang modul `patient-service` pada instance Fastify yang sudah memiliki `IdentityService`
 * dan `IdentityRepository` (untuk otorisasi RBAC, pencatatan audit akses tersanitasi, dan notifikasi).
 */
export async function pasangModulPatientService(
  app: FastifyInstance,
  konteksIdentity: Awaited<ReturnType<typeof bangunAplikasiIdentity>>,
  opsi: OpsiPasangModulPatient = {},
): Promise<{
  patientRepository: PatientRepository;
  patientService: PatientService;
  inpatientRepository: InpatientRepository;
  inpatientService: InpatientService;
}> {
  const patientRepository =
    opsi.patientRepository ?? new InMemoryPatientRepository();
  const inpatientRepository =
    opsi.inpatientRepository ?? new InMemoryInpatientRepository();

  const patientService = new PatientService(patientRepository, {
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
      await konteksIdentity.repository.simpanNotifikasiBaru(notifikasi);
    },
  });

  const inpatientService = new InpatientService(
    inpatientRepository,
    patientRepository,
    {
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

  await daftarkanRutePatient(app, {
    identityService: konteksIdentity.service,
    namaCookieSesi: konteksIdentity.env.SESSION_COOKIE_NAME,
    patientService,
  });

  daftarkanRuteInpatient(app, {
    inpatientService,
    identityService: konteksIdentity.service,
    namaCookieSesi: konteksIdentity.env.SESSION_COOKIE_NAME,
  });

  return {
    patientRepository,
    patientService,
    inpatientRepository,
    inpatientService,
  };
}

/**
 * Membangun instance Fastify mandiri untuk `patient-service`.
 */
export async function bangunAplikasiPatient(
  opsi: OpsiBangunAplikasiIdentity & OpsiPasangModulPatient & {
    envPatient?: Partial<KonfigurasiEnvPatient>;
  } = {},
): Promise<{
  app: FastifyInstance;
  patientService: PatientService;
  patientRepository: PatientRepository;
  inpatientService: InpatientService;
  inpatientRepository: InpatientRepository;
  envPatient: KonfigurasiEnvPatient;
}> {
  const envPatient = {
    ...muatKonfigurasiPatient(process.env),
    ...opsi.envPatient,
  };
  const konteksIdentity = await bangunAplikasiIdentity(opsi);
  const {
    patientRepository,
    patientService,
    inpatientRepository,
    inpatientService,
  } = await pasangModulPatientService(konteksIdentity.app, konteksIdentity, {
    patientRepository: opsi.patientRepository,
    inpatientRepository: opsi.inpatientRepository,
  });

  return {
    app: konteksIdentity.app,
    patientService,
    patientRepository,
    inpatientService,
    inpatientRepository,
    envPatient,
  };
}
