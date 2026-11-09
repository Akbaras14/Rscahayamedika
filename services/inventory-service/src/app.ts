/**
 * @fileoverview Pabrik modul dan aplikasi Fastify untuk `inventory-service` (Tahap 7 — Petugas Gudang).
 * Mengintegrasikan rute manajemen inventaris, penerimaan lot mutu, alokasi & pengeluaran FEFO, dan stok opname.
 */

import type { FastifyInstance } from "fastify";
import {
  bangunAplikasiIdentity,
  type OpsiBangunAplikasiIdentity,
} from "../../identity-service/src/app.ts";
import {
  type KonfigurasiEnvInventory,
  muatKonfigurasiInventory,
} from "./config/env.ts";
import {
  type InventoryRepository,
  InMemoryInventoryRepository,
} from "./repository/inventory.repository.ts";
import { daftarkanRuteInventory } from "./route/inventory.route.ts";
import { InventoryService } from "./services/inventory.service.ts";

export interface OpsiPasangModulInventory {
  inventoryRepository?: InventoryRepository;
}

/**
 * Memasang modul `inventory-service` pada instance Fastify yang sudah memiliki `IdentityService`.
 */
export async function pasangModulInventoryService(
  app: FastifyInstance,
  konteksIdentity: Awaited<ReturnType<typeof bangunAplikasiIdentity>>,
  opsi: OpsiPasangModulInventory = {},
): Promise<{
  inventoryRepository: InventoryRepository;
  inventoryService: InventoryService;
}> {
  const inventoryRepository =
    opsi.inventoryRepository ?? new InMemoryInventoryRepository();

  const inventoryService = new InventoryService(inventoryRepository);

  await daftarkanRuteInventory(app, {
    inventoryService,
    identityService: konteksIdentity.service,
    namaCookieSesi: konteksIdentity.env.SESSION_COOKIE_NAME,
  });

  return { inventoryRepository, inventoryService };
}

/**
 * Membangun aplikasi Fastify standalone untuk `inventory-service`.
 */
export async function bangunAplikasiInventory(
  opsi: OpsiBangunAplikasiIdentity & OpsiPasangModulInventory = {},
): Promise<{
  app: FastifyInstance;
  inventoryRepository: InventoryRepository;
  inventoryService: InventoryService;
  env: KonfigurasiEnvInventory;
}> {
  const konteksIdentity = await bangunAplikasiIdentity(opsi);
  const modulInventory = await pasangModulInventoryService(
    konteksIdentity.app,
    konteksIdentity,
    opsi,
  );
  const env = muatKonfigurasiInventory();

  return {
    app: konteksIdentity.app,
    inventoryRepository: modulInventory.inventoryRepository,
    inventoryService: modulInventory.inventoryService,
    env,
  };
}

