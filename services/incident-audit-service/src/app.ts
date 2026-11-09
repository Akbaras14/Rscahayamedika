/**
 * @fileoverview Pabrik modul dan aplikasi Fastify untuk `incident-audit-service` (Tahap 10 — Kepala Instalasi Gizi).
 * Mengintegrasikan rute investigasi insiden keselamatan pasien (AB-029), penetapan tindakan (AB-028),
 * penutupan closed-loop (AB-029, AB-030), evaluasi mutu & plate waste (BRD Bab X, XI),
 * dan rekonsiliasi downtime (AB-033).
 */

import type { FastifyInstance } from "fastify";
import {
  bangunAplikasiIdentity,
  type OpsiBangunAplikasiIdentity,
} from "../../identity-service/src/app.ts";
import {
  type KonfigurasiEnvIncident,
  muatKonfigurasiIncident,
} from "./config/env.ts";
import {
  type IncidentRepository,
  InMemoryIncidentRepository,
} from "./repository/incident.repository.ts";
import { daftarkanRuteIncident } from "./route/incident.route.ts";
import { IncidentAuditService } from "./services/incident.service.ts";

export interface OpsiPasangModulIncident {
  incidentRepository?: IncidentRepository;
}

/**
 * Memasang modul `incident-audit-service` pada instance Fastify yang sudah memiliki `IdentityService`.
 */
export async function pasangModulIncidentService(
  app: FastifyInstance,
  konteksIdentity: Awaited<ReturnType<typeof bangunAplikasiIdentity>>,
  opsi: OpsiPasangModulIncident = {},
): Promise<{
  incidentRepository: IncidentRepository;
  incidentService: IncidentAuditService;
}> {
  const incidentRepository =
    opsi.incidentRepository ?? new InMemoryIncidentRepository();

  const incidentService = new IncidentAuditService(incidentRepository);

  await daftarkanRuteIncident(app, {
    incidentService,
    identityService: konteksIdentity.service,
    namaCookieSesi: konteksIdentity.env.SESSION_COOKIE_NAME,
  });

  return { incidentRepository, incidentService };
}

/**
 * Membangun aplikasi Fastify standalone untuk `incident-audit-service`.
 */
export async function bangunAplikasiIncident(
  opsi: OpsiBangunAplikasiIdentity & OpsiPasangModulIncident = {},
): Promise<{
  app: FastifyInstance;
  incidentRepository: IncidentRepository;
  incidentService: IncidentAuditService;
  env: KonfigurasiEnvIncident;
}> {
  const env = muatKonfigurasiIncident();
  const konteksIdentity = await bangunAplikasiIdentity(opsi);

  const modul = await pasangModulIncidentService(
    konteksIdentity.app,
    konteksIdentity,
    opsi,
  );

  return {
    app: konteksIdentity.app,
    incidentRepository: modul.incidentRepository,
    incidentService: modul.incidentService,
    env,
  };
}

