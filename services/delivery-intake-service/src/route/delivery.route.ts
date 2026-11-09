/**
 * @fileoverview Rute HTTP tipis (thin routes) untuk Layanan Distribusi & Handover Makanan (Tahap 9).
 * Mengimplementasikan endpoints:
 * - Health check (`GET /v1/delivery-intake/health`)
 * - Ringkasan Dasbor Distribusi (`GET /v1/delivery-intake/overview`)
 * - Troli Pengantaran (`GET`, `POST /v1/delivery-intake/trolleys`, `POST /:id/depart`, `POST /:id/return`)
 * - Porsi Distribusi & Handover (`GET /v1/delivery-intake/items`, `POST /:id/verify-and-handover`, `POST /:id/hold`)
 * - Laporan Insiden Distribusi (`GET`, `POST /v1/delivery-intake/incidents`)
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  buatPreHandlerWajibAutentikasi,
  buatResponsSukses,
} from "../../../identity-service/src/middleware/security.middleware.ts";
import { buatGalatSesiBerakhir } from "../../../identity-service/src/model/errors.ts";
import type { IdentityService } from "../../../identity-service/src/services/identity.service.ts";
import type {
  JenisInsidenDistribusi,
  ProfilSesiPengguna,
  SesiMakanDapur,
  StatusSerahPorsi,
  StatusTroliDistribusi,
} from "../../../../packages/shared-types/src/index.ts";
import type { DeliveryService } from "../services/delivery.service.ts";

export interface DependensiRuteDelivery {
  deliveryService: DeliveryService;
  identityService: IdentityService;
  namaCookieSesi: string;
}

export async function daftarkanRuteDelivery(
  app: FastifyInstance,
  deps: DependensiRuteDelivery,
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

  // 1. Health check delivery service
  app.get("/v1/delivery-intake/health", async (request) => {
    return buatResponsSukses(request, {
      layanan: "delivery-intake-service",
      status: "sehat",
      timestamp: new Date().toISOString(),
    });
  });

  // 2. Overview ringkasan distribusi
  app.get(
    "/v1/delivery-intake/overview",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const ringkasan = await deps.deliveryService.ambilOverviewDistribusi(profil);
      return buatResponsSukses(request, ringkasan);
    },
  );

  // 3. Daftar troli pengantaran
  app.get(
    "/v1/delivery-intake/trolleys",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const query = request.query as {
        bangsalId?: string;
        sesi?: SesiMakanDapur;
        status?: StatusTroliDistribusi;
        tanggal?: string;
      };
      const daftar = await deps.deliveryService.ambilDaftarTroli(profil, query);
      return buatResponsSukses(request, { items: daftar, total: daftar.length });
    },
  );

  // 4. Buat troli pengantaran baru
  app.post(
    "/v1/delivery-intake/trolleys",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const troli = await deps.deliveryService.buatTroliDistribusi(profil, request.body);
      return buatResponsSukses(request, troli);
    },
  );

  // 5. Berangkatkan troli pengantaran ke bangsal
  app.post(
    "/v1/delivery-intake/trolleys/:id/depart",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const { id } = request.params as { id: string };
      const troli = await deps.deliveryService.berangkatkanTroli(profil, id);
      return buatResponsSukses(request, troli);
    },
  );

  // 6. Kembalikan troli pengantaran (selesai rute)
  app.post(
    "/v1/delivery-intake/trolleys/:id/return",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const { id } = request.params as { id: string };
      const troli = await deps.deliveryService.kembalikanTroli(profil, id);
      return buatResponsSukses(request, troli);
    },
  );

  // 7. Daftar item porsi makanan dalam alur distribusi
  app.get(
    "/v1/delivery-intake/items",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const query = request.query as {
        troliId?: string;
        bangsalId?: string;
        statusSerah?: StatusSerahPorsi;
        nomorRm?: string;
      };
      const items = await deps.deliveryService.ambilDaftarItemPorsi(profil, query);
      return buatResponsSukses(request, { items, total: items.length });
    },
  );

  // 8. Verifikasi dua identitas (AB-020), cek diet terkini (AB-021), & serahkan makanan (AB-023)
  app.post(
    "/v1/delivery-intake/items/:id/verify-and-handover",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const { id } = request.params as { id: string };
      const hasil = await deps.deliveryService.verifikasiDanSerahkanPorsi(
        profil,
        id,
        request.body,
      );
      return buatResponsSukses(request, hasil);
    },
  );

  // 9. Tahan porsi makanan saat pengantaran karena perubahan klinis / NPO (AB-022, AB-030)
  app.post(
    "/v1/delivery-intake/items/:id/hold",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const { id } = request.params as { id: string };
      const hasil = await deps.deliveryService.tahanPorsiDistribusi(
        profil,
        id,
        request.body,
      );
      return buatResponsSukses(request, hasil);
    },
  );

  // 10. Daftar laporan insiden pengantaran makanan
  app.get(
    "/v1/delivery-intake/incidents",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const query = request.query as {
        bangsalId?: string;
        jenis?: JenisInsidenDistribusi;
        status?: "terbuka" | "ditindaklanjuti" | "selesai";
      };
      const items = await deps.deliveryService.ambilDaftarLaporanInsiden(profil, query);
      return buatResponsSukses(request, { items, total: items.length });
    },
  );

  // 11. Buat laporan insiden distribusi baru (AB-030)
  app.post(
    "/v1/delivery-intake/incidents",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const insiden = await deps.deliveryService.buatLaporanInsiden(profil, request.body);
      return buatResponsSukses(request, insiden);
    },
  );
}
