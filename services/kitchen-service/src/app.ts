/**
 * @fileoverview Pabrik modul dan aplikasi Fastify untuk `kitchen-service` (Tahap 8 — Petugas Dapur).
 * Mengintegrasikan rute rencana produksi H-1, batch cooking ber-CCP, QC organoleptik/suhu,
 * label porsi pasien terlacak, penahanan perubahan klinis, dan recall traceability.
 */

import type { FastifyInstance } from "fastify";
import {
  bangunAplikasiIdentity,
  type OpsiBangunAplikasiIdentity,
} from "../../identity-service/src/app.ts";
import {
  type KonfigurasiEnvKitchen,
  muatKonfigurasiKitchen,
} from "./config/env.ts";
import {
  type KitchenRepository,
  InMemoryKitchenRepository,
} from "./repository/kitchen.repository.ts";
import { daftarkanRuteKitchen } from "./route/kitchen.route.ts";
import { type KaitanKitchen, KitchenService } from "./services/kitchen.service.ts";

export interface OpsiPasangModulKitchen {
  kitchenRepository?: KitchenRepository;
  kaitanKitchen?: KaitanKitchen;
}

/**
 * Memasang modul `kitchen-service` pada instance Fastify yang sudah memiliki `IdentityService`.
 */
export async function pasangModulKitchenService(
  app: FastifyInstance,
  konteksIdentity: Awaited<ReturnType<typeof bangunAplikasiIdentity>>,
  opsi: OpsiPasangModulKitchen = {},
): Promise<{
  kitchenRepository: KitchenRepository;
  kitchenService: KitchenService;
}> {
  const kitchenRepository =
    opsi.kitchenRepository ?? new InMemoryKitchenRepository();

  const kitchenService = new KitchenService(kitchenRepository, opsi.kaitanKitchen);

  await daftarkanRuteKitchen(app, {
    kitchenService,
    identityService: konteksIdentity.service,
    namaCookieSesi: konteksIdentity.env.SESSION_COOKIE_NAME,
  });

  return { kitchenRepository, kitchenService };
}

/**
 * Membangun aplikasi Fastify standalone untuk `kitchen-service`.
 */
export async function bangunAplikasiKitchen(
  opsi: OpsiBangunAplikasiIdentity & OpsiPasangModulKitchen = {},
): Promise<{
  app: FastifyInstance;
  kitchenRepository: KitchenRepository;
  kitchenService: KitchenService;
  env: KonfigurasiEnvKitchen;
}> {
  const env = muatKonfigurasiKitchen();
  const konteksIdentity = await bangunAplikasiIdentity(opsi);

  const modul = await pasangModulKitchenService(
    konteksIdentity.app,
    konteksIdentity,
    opsi,
  );

  return {
    app: konteksIdentity.app,
    kitchenRepository: modul.kitchenRepository,
    kitchenService: modul.kitchenService,
    env,
  };
}

