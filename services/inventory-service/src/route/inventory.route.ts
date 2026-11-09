/**
 * @fileoverview Rute HTTP tipis (thin routes) untuk Layanan Inventaris & Gudang (Tahap 7).
 * Mengimplementasikan endpoints:
 * - Health check (`GET /v1/inventory/health`)
 * - Katalog Bahan & Ringkasan Stok (`GET /v1/inventory/items`)
 * - Penerimaan Lot & Mutu (`GET`, `POST /v1/inventory/lots`)
 * - Pembuangan Bahan Rusak / ED (`POST /v1/inventory/lots/:id/dispose`)
 * - Permintaan Bahan Dapur (`GET`, `POST /v1/inventory/requests`, `POST /:id/allocate`, `POST /:id/dispatch`, `POST /:id/reject`)
 * - Stok Opname Fisik (`GET`, `POST /v1/inventory/stock-opname`)
 * - Kartu Stok Mutasi Ledger (`GET /v1/inventory/ledger`)
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  buatPreHandlerWajibAutentikasi,
  buatResponsSukses,
} from "../../../identity-service/src/middleware/security.middleware.ts";
import { buatGalatSesiBerakhir } from "../../../identity-service/src/model/errors.ts";
import type { IdentityService } from "../../../identity-service/src/services/identity.service.ts";
import type { ProfilSesiPengguna } from "../../../../packages/shared-types/src/index.ts";
import type {
  InputPenerimaanLotBaru,
  InputPenyesuaianOpnameBaru,
  InputPermintaanBahanBaru,
} from "../model/inventory.model.ts";
import type { InventoryService } from "../services/inventory.service.ts";

export interface DependensiRuteInventory {
  inventoryService: InventoryService;
  identityService: IdentityService;
  namaCookieSesi: string;
}

export async function daftarkanRuteInventory(
  app: FastifyInstance,
  deps: DependensiRuteInventory,
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

  // 1. Health check inventory
  app.get("/v1/inventory/health", async (request) => {
    return buatResponsSukses(request, {
      layanan: "inventory-service",
      status: "sehat",
      tahap: 7,
      waktuServer: new Date().toISOString(),
    });
  });

  // 2. Katalog Bahan & Stok
  app.get(
    "/v1/inventory/items",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const items = await deps.inventoryService.ambilKatalogBahan(profil);
      return buatResponsSukses(request, { items, total: items.length });
    },
  );

  // 3. Penerimaan Lot Bahan
  app.get(
    "/v1/inventory/lots",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const query = request.query as { bahanId?: string; statusLot?: string };
      const items = await deps.inventoryService.ambilDaftarLot(query, profil);
      return buatResponsSukses(request, { items, total: items.length });
    },
  );

  app.post(
    "/v1/inventory/lots",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const lot = await deps.inventoryService.catatPenerimaanLot(
        request.body as InputPenerimaanLotBaru,
        profil,
      );
      return buatResponsSukses(request, lot);
    },
  );

  // 4. Pembuangan Lot Bahan Rusak / Kedaluwarsa
  app.post(
    "/v1/inventory/lots/:id/dispose",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const { id } = request.params as { id: string };
      const body = (request.body as { alasan?: string }) || {};
      const hasil = await deps.inventoryService.buangBahanKedaluwarsa(
        id,
        body.alasan ?? "Bahan kedaluwarsa/rusak",
        profil,
      );
      return buatResponsSukses(request, hasil);
    },
  );

  // 5. Permintaan Bahan Dapur
  app.get(
    "/v1/inventory/requests",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const query = request.query as { status?: string; tanggal?: string };
      const items = await deps.inventoryService.ambilSemuaPermintaan(query, profil);
      return buatResponsSukses(request, { items, total: items.length });
    },
  );

  app.post(
    "/v1/inventory/requests",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const permintaan = await deps.inventoryService.buatPermintaanSintetisDapur(
        request.body as InputPermintaanBahanBaru,
        profil,
      );
      return buatResponsSukses(request, permintaan);
    },
  );

  app.post(
    "/v1/inventory/requests/:id/allocate",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const { id } = request.params as { id: string };
      const permintaan = await deps.inventoryService.alokasikanBahanPermintaan(
        id,
        profil,
      );
      return buatResponsSukses(request, permintaan);
    },
  );

  app.post(
    "/v1/inventory/requests/:id/dispatch",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const { id } = request.params as { id: string };
      const body = (request.body as { catatanPengeluaran?: string }) || {};
      const permintaan = await deps.inventoryService.keluarkanBahanPermintaan(
        id,
        body.catatanPengeluaran,
        profil,
      );
      return buatResponsSukses(request, permintaan);
    },
  );

  app.post(
    "/v1/inventory/requests/:id/reject",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const { id } = request.params as { id: string };
      const body = (request.body as { alasan?: string }) || {};
      const permintaan = await deps.inventoryService.tolakPermintaanBahan(
        id,
        body.alasan ?? "Permintaan ditolak petugas gudang",
        profil,
      );
      return buatResponsSukses(request, permintaan);
    },
  );

  // 6. Stok Opname Fisik
  app.get(
    "/v1/inventory/stock-opname",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const query = request.query as { bahanId?: string };
      const items = await deps.inventoryService.ambilSemuaOpname(query.bahanId, profil);
      return buatResponsSukses(request, { items, total: items.length });
    },
  );

  app.post(
    "/v1/inventory/stock-opname",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const opname = await deps.inventoryService.catatPenyesuaianOpname(
        request.body as InputPenyesuaianOpnameBaru,
        profil,
      );
      return buatResponsSukses(request, opname);
    },
  );

  // 7. Kartu Stok Mutasi Ledger
  app.get(
    "/v1/inventory/ledger",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = ambilProfil(request);
      const query = request.query as { bahanId?: string };
      const items = await deps.inventoryService.ambilKartuStok(query.bahanId, profil);
      return buatResponsSukses(request, { items, total: items.length });
    },
  );
}

