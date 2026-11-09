/**
 * @fileoverview Pabrik modul dan aplikasi Fastify untuk `delivery-intake-service` (Tahap 9 — Petugas Distribusi).
 * Mengintegrasikan rute troli pengantaran bangsal, verifikasi dua identitas (AB-020),
 * pemeriksaan diet terkini (AB-021), penyerahan makanan (AB-023), penahanan klinis (AB-022),
 * dan pelaporan insiden distribusi (AB-030).
 */

import type { FastifyInstance } from "fastify";
import {
  bangunAplikasiIdentity,
  type OpsiBangunAplikasiIdentity,
} from "../../identity-service/src/app.ts";
import {
  type KonfigurasiEnvDelivery,
  muatKonfigurasiDelivery,
} from "./config/env.ts";
import {
  type DeliveryRepository,
  InMemoryDeliveryRepository,
} from "./repository/delivery.repository.ts";
import { daftarkanRuteDelivery } from "./route/delivery.route.ts";
import { type KaitanDelivery, DeliveryService } from "./services/delivery.service.ts";

export interface OpsiPasangModulDelivery {
  deliveryRepository?: DeliveryRepository;
  kaitanDelivery?: KaitanDelivery;
}

/**
 * Memasang modul `delivery-intake-service` pada instance Fastify yang sudah memiliki `IdentityService`.
 */
export async function pasangModulDeliveryService(
  app: FastifyInstance,
  konteksIdentity: Awaited<ReturnType<typeof bangunAplikasiIdentity>>,
  opsi: OpsiPasangModulDelivery = {},
): Promise<{
  deliveryRepository: DeliveryRepository;
  deliveryService: DeliveryService;
}> {
  const deliveryRepository =
    opsi.deliveryRepository ?? new InMemoryDeliveryRepository();

  const deliveryService = new DeliveryService(deliveryRepository, opsi.kaitanDelivery);

  await daftarkanRuteDelivery(app, {
    deliveryService,
    identityService: konteksIdentity.service,
    namaCookieSesi: konteksIdentity.env.SESSION_COOKIE_NAME,
  });

  return { deliveryRepository, deliveryService };
}

/**
 * Membangun aplikasi Fastify standalone untuk `delivery-intake-service`.
 */
export async function bangunAplikasiDelivery(
  opsi: OpsiBangunAplikasiIdentity & OpsiPasangModulDelivery = {},
): Promise<{
  app: FastifyInstance;
  deliveryRepository: DeliveryRepository;
  deliveryService: DeliveryService;
  env: KonfigurasiEnvDelivery;
}> {
  const env = muatKonfigurasiDelivery();
  const konteksIdentity = await bangunAplikasiIdentity(opsi);

  const modul = await pasangModulDeliveryService(
    konteksIdentity.app,
    konteksIdentity,
    opsi,
  );

  return {
    app: konteksIdentity.app,
    deliveryRepository: modul.deliveryRepository,
    deliveryService: modul.deliveryService,
    env,
  };
}

