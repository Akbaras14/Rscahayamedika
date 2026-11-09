/**
 * @fileoverview Rute HTTP tipis (thin routes) untuk `incident-audit-service` (Tahap 10 — Kepala Instalasi Gizi).
 * Endpoints:
 * - Health check: `GET /v1/incidents/health`
 * - Executive Oversight Overview: `GET /v1/incidents/overview`
 * - Laporan Insiden Gizi: `GET /v1/incidents/reports`, `GET /:id`, `POST /:id/investigate`, `POST /:id/actions`, `POST /:id/close`
 * - Evaluasi Mutu & Sisa Makanan (Plate Waste): `GET`, `POST /v1/incidents/quality-evaluations`
 * - Rekonsiliasi Downtime Pelayanan Sementara: `GET`, `POST /v1/incidents/downtime-reconciliations`, `POST /:id/decide`
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  buatPreHandlerWajibAutentikasi,
  buatResponsSukses,
} from "../../../identity-service/src/middleware/security.middleware.ts";
import { buatGalatSesiBerakhir } from "../../../identity-service/src/model/errors.ts";
import type { IdentityService } from "../../../identity-service/src/services/identity.service.ts";
import type {
  DerajatKeparahanInsiden,
  ProfilSesiPengguna,
  StatusInsidenGizi,
} from "../../../../packages/shared-types/src/index.ts";
import type { IncidentAuditService } from "../services/incident.service.ts";

export interface DependensiRuteIncident {
  incidentService: IncidentAuditService;
  identityService: IdentityService;
  namaCookieSesi: string;
}

export async function daftarkanRuteIncident(
  app: FastifyInstance,
  deps: DependensiRuteIncident,
): Promise<void> {
  const wajibAutentikasi = buatPreHandlerWajibAutentikasi(
    deps.identityService,
    deps.namaCookieSesi,
  );

  function ambilProfil(request: FastifyRequest): ProfilSesiPengguna {
    if (!request.profilSesi) {
      throw buatGalatSesiBerakhir();
    }
    return request.profilSesi;
  }

  // 1. Health check incident service
  app.get("/v1/incidents/health", async (request) => {
    return buatResponsSukses(request, {
      layanan: "incident-audit-service",
      status: "sehat",
      timestamp: new Date().toISOString(),
    });
  });

  // 2. Executive oversight overview
  app.get(
    "/v1/incidents/overview",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const ringkasan = await deps.incidentService.ambilOverviewOversight(profil);
      return buatResponsSukses(request, ringkasan);
    },
  );

  // 3. Daftar laporan insiden gizi
  app.get(
    "/v1/incidents/reports",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const query = request.query as {
        status?: StatusInsidenGizi;
        derajat?: DerajatKeparahanInsiden;
      };
      const data = await deps.incidentService.ambilDaftarInsiden(profil, query);
      return buatResponsSukses(request, data);
    },
  );

  // 4. Detail laporan insiden, RCA investigasi & tindakan
  app.get(
    "/v1/incidents/reports/:id",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const params = request.params as { id: string };
      const detail = await deps.incidentService.ambilDetailInsiden(
        profil,
        params.id,
      );
      return buatResponsSukses(request, detail);
    },
  );

  // 5. Investigasi insiden (RCA, faktor kontributor, rekomendasi)
  app.post(
    "/v1/incidents/reports/:id/investigate",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const params = request.params as { id: string };
      const investigasi = await deps.incidentService.investigasiInsiden(
        profil,
        params.id,
        request.body,
      );
      return buatResponsSukses(request, investigasi);
    },
  );

  // 6. Penetapan rencana tindakan perbaikan & penanggung jawab (AB-028)
  app.post(
    "/v1/incidents/reports/:id/actions",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const params = request.params as { id: string };
      const tindakan = await deps.incidentService.catatTindakanKoreksi(
        profil,
        params.id,
        request.body,
      );
      return buatResponsSukses(request, tindakan);
    },
  );

  // 7. Penutupan resmi insiden secara sah (Closed Loop, AB-029, AB-030)
  app.post(
    "/v1/incidents/reports/:id/close",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const params = request.params as { id: string };
      const hasil = await deps.incidentService.tutupResmiInsiden(
        profil,
        params.id,
        request.body,
      );
      return buatResponsSukses(request, hasil);
    },
  );

  // 8. Daftar evaluasi mutu pelayanan & plate waste
  app.get(
    "/v1/incidents/quality-evaluations",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const evaluasi = await deps.incidentService.ambilDaftarEvaluasiMutu(profil);
      return buatResponsSukses(request, evaluasi);
    },
  );

  // 9. Perekaman evaluasi mutu gizi baru
  app.post(
    "/v1/incidents/quality-evaluations",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const evaluasi = await deps.incidentService.catatEvaluasiMutu(
        profil,
        request.body,
      );
      return buatResponsSukses(request, evaluasi);
    },
  );

  // 10. Daftar rekonsiliasi downtime pelayanan sementara (AB-033)
  app.get(
    "/v1/incidents/downtime-reconciliations",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const daftar =
        await deps.incidentService.ambilDaftarRekonsiliasiDowntime(profil);
      return buatResponsSukses(request, daftar);
    },
  );

  // 11. Pengajuan rekonsiliasi formulir kertas pasca-downtime (AB-033)
  app.post(
    "/v1/incidents/downtime-reconciliations",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const baru = await deps.incidentService.catatPengajuanDowntime(
        profil,
        request.body,
      );
      return buatResponsSukses(request, baru);
    },
  );

  // 12. Pengesahan keputusan rekonsiliasi downtime (AB-033)
  app.post(
    "/v1/incidents/downtime-reconciliations/:id/decide",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const params = request.params as { id: string };
      const hasil = await deps.incidentService.putuskanPengesahanRekonsiliasi(
        profil,
        params.id,
        request.body,
      );
      return buatResponsSukses(request, hasil);
    },
  );
}

