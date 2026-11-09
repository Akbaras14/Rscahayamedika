/**
 * @fileoverview Rute HTTP tipis (thin routes) untuk Layanan Dapur & Pengendalian Makanan (Tahap 8).
 * Mengimplementasikan endpoints:
 * - Health check (`GET /v1/kitchen/health`)
 * - Ringkasan Dasbor Dapur (`GET /v1/kitchen/overview`)
 * - Rencana Produksi H-1 (`GET`, `POST /v1/kitchen/production-plans`, `POST /:id/approve`)
 * - Batch Memasak & CCP (`GET`, `POST /v1/kitchen/batches`, `POST /:id/ccp-temp`)
 * - Pemeriksaan Mutu Akhir Organoleptik/Suhu (`GET`, `POST /v1/kitchen/quality-inspections`)
 * - Label Porsi Pasien & Penahanan Klinis (`GET /v1/kitchen/portion-labels`, `POST /:id/ready`, `POST /:id/hold`, `POST /:id/release`)
 * - Ketertelusuran Bahan / Recall (`GET /v1/kitchen/traceability/lots/:nomorLot`)
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  buatPreHandlerWajibAutentikasi,
  buatResponsSukses,
} from "../../../identity-service/src/middleware/security.middleware.ts";
import { buatGalatSesiBerakhir } from "../../../identity-service/src/model/errors.ts";
import type { IdentityService } from "../../../identity-service/src/services/identity.service.ts";
import type {
  ProfilSesiPengguna,
  SesiMakanDapur,
  StatusBatchProduksi,
  StatusPorsiPasien,
  StatusRencanaProduksi,
} from "../../../../packages/shared-types/src/index.ts";
import type {
  InputBatchProduksiBaru,
  InputCatatCcpSuhu,
  InputCetakLabelPorsi,
  InputPemeriksaanMutuBaru,
  InputRencanaProduksiBaru,
  InputTahanPorsiKlinis,
} from "../model/kitchen.model.ts";
import type { KitchenService } from "../services/kitchen.service.ts";

export interface DependensiRuteKitchen {
  kitchenService: KitchenService;
  identityService: IdentityService;
  namaCookieSesi: string;
}

export async function daftarkanRuteKitchen(
  app: FastifyInstance,
  deps: DependensiRuteKitchen,
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

  // 1. Health check kitchen service
  app.get("/v1/kitchen/health", async (request) => {
    return buatResponsSukses(request, {
      layanan: "kitchen-service",
      status: "sehat",
      tahap: 8,
      waktu: new Date().toISOString(),
    });
  });

  // 2. Overview metrik dasbor dapur
  app.get(
    "/v1/kitchen/overview",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const overview = await deps.kitchenService.ambilOverviewDapur(profil);
      return buatResponsSukses(request, overview);
    },
  );

  // 3. Rencana Produksi H-1: Ambil daftar rencana
  app.get(
    "/v1/kitchen/production-plans",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const query = request.query as {
        tanggal?: string;
        sesi?: SesiMakanDapur;
        status?: StatusRencanaProduksi;
      };
      const items = await deps.kitchenService.ambilDaftarRencana(query, profil);
      return buatResponsSukses(request, { items, total: items.length });
    },
  );

  // 4. Rencana Produksi H-1: Buat rencana baru
  app.post(
    "/v1/kitchen/production-plans",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const input = request.body as InputRencanaProduksiBaru;
      const dibuat = await deps.kitchenService.buatRencanaProduksi(input, profil);
      return buatResponsSukses(request, dibuat);
    },
  );

  // 5. Rencana Produksi H-1: Setujui rencana
  app.post(
    "/v1/kitchen/production-plans/:id/approve",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const { id } = request.params as { id: string };
      const disetujui = await deps.kitchenService.setujuiRencanaProduksi(id, profil);
      return buatResponsSukses(request, disetujui);
    },
  );

  // 6. Batch Memasak: Ambil daftar batch
  app.get(
    "/v1/kitchen/batches",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const query = request.query as {
        rencanaProduksiId?: string;
        sesi?: SesiMakanDapur;
        status?: StatusBatchProduksi;
      };
      const items = await deps.kitchenService.ambilDaftarBatch(query, profil);
      return buatResponsSukses(request, { items, total: items.length });
    },
  );

  // 7. Batch Memasak: Catat batch baru dengan penelusuran lot bahan (AB-018)
  app.post(
    "/v1/kitchen/batches",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const input = request.body as InputBatchProduksiBaru;
      const batchBaru = await deps.kitchenService.buatBatchProduksi(input, profil);
      return buatResponsSukses(request, batchBaru);
    },
  );

  // 8. Batch Memasak: Catat suhu CCP inti memasak (AB-019)
  app.post(
    "/v1/kitchen/batches/:id/ccp-temp",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const { id } = request.params as { id: string };
      const input = request.body as InputCatatCcpSuhu;
      const terbarui = await deps.kitchenService.catatCcpSuhuMasak(id, input, profil);
      return buatResponsSukses(request, terbarui);
    },
  );

  // 9. Pemeriksaan Mutu: Ambil riwayat QC
  app.get(
    "/v1/kitchen/quality-inspections",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const items = await deps.kitchenService.ambilSemuaPemeriksaanMutu(profil);
      return buatResponsSukses(request, { items, total: items.length });
    },
  );

  // 10. Pemeriksaan Mutu: Catat inspeksi organoleptik/suhu saji (AB-019, AB-022)
  app.post(
    "/v1/kitchen/quality-inspections",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const input = request.body as InputPemeriksaanMutuBaru;
      const qc = await deps.kitchenService.catatPemeriksaanMutu(input, profil);
      return buatResponsSukses(request, qc);
    },
  );

  // 11. Label Porsi Pasien: Ambil daftar porsi
  app.get(
    "/v1/kitchen/portion-labels",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const query = request.query as {
        tanggal?: string;
        sesi?: SesiMakanDapur;
        status?: StatusPorsiPasien;
        pasienId?: string;
        batchProduksiId?: string;
      };
      const items = await deps.kitchenService.ambilDaftarLabelPorsi(query, profil);
      return buatResponsSukses(request, { items, total: items.length });
    },
  );

  // 12. Label Porsi Pasien: Siapkan porsi untuk distribusi (cek QC lolos & bebas penahanan klinis)
  app.post(
    "/v1/kitchen/portion-labels/:id/ready",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const { id } = request.params as { id: string };
      const input = (request.body as InputCetakLabelPorsi) ?? {};
      const terbarui = await deps.kitchenService.siapkanPorsiDistribusi(id, input, profil);
      return buatResponsSukses(request, terbarui);
    },
  );

  // 13. Label Porsi Pasien: Tahan porsi akibat perubahan diet / klinis (AB-010, AB-013)
  app.post(
    "/v1/kitchen/portion-labels/:id/hold",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const { id } = request.params as { id: string };
      const input = request.body as InputTahanPorsiKlinis;
      const terbarui = await deps.kitchenService.tahanPorsiKarenaPerubahanKlinis(
        id,
        input,
        profil,
      );
      return buatResponsSukses(request, terbarui);
    },
  );

  // 14. Label Porsi Pasien: Lepas penahanan setelah diet aman disesuaikan
  app.post(
    "/v1/kitchen/portion-labels/:id/release",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const { id } = request.params as { id: string };
      const terbarui = await deps.kitchenService.lepasPenahananPorsi(id, profil);
      return buatResponsSukses(request, terbarui);
    },
  );

  // 15. Ketertelusuran Bahan Gudang ke Pasien (Recall Traceability BRD 8.6)
  app.get(
    "/v1/kitchen/traceability/lots/:nomorLot",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const { nomorLot } = request.params as { nomorLot: string };
      const trace = await deps.kitchenService.telusuriKetertelusuranLot(nomorLot, profil);
      return buatResponsSukses(request, trace);
    },
  );
}
