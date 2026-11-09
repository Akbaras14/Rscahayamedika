/**
 * @fileoverview Jembatan BFF (Backend-for-Frontend) tipis untuk Next.js Route Handlers.
 * Meneruskan permintaan `/api/v1/*` ke instance Fastify `api-gateway` sehingga seluruh
 * middleware keamanan, validasi Zod, cookie HttpOnly, idempotensi, dan penyamaran galat
 * diterapkan secara identik di satu titik validasi.
 */

import type { FastifyInstance } from "fastify";
import { bangunGatewayMySql } from "../../services/api-gateway/src/database/mysql-gateway.ts";

declare global {
  var __hpnmsGatewayAppPromise: Promise<FastifyInstance> | undefined;
}

/**
 * Mengambil singleton instance Fastify API Gateway untuk pemrosesan BFF.
 */
export function ambilGatewayAppBff(): Promise<FastifyInstance> {
  if (!globalThis.__hpnmsGatewayAppPromise) {
    globalThis.__hpnmsGatewayAppPromise = bangunGatewayMySql().then(
      (res) => res.app,
    ).catch((error: unknown) => {
      globalThis.__hpnmsGatewayAppPromise = undefined;
      throw error;
    });
  }
  return globalThis.__hpnmsGatewayAppPromise;
}
