/**
 * @fileoverview Rute API Gateway (`/v1/gateway/...`) dan delegasi rute fondasi Tahap 0.
 */

import type { FastifyInstance } from "fastify";
import { buatResponsSukses } from "../../../identity-service/src/middleware/security.middleware.ts";
import { cekStatusDatabaseGateway } from "../database/index.ts";
import type { GatewayService } from "../services/gateway.service.ts";

export async function daftarkanRuteGateway(
  app: FastifyInstance,
  gatewayService: GatewayService,
): Promise<void> {
  app.get("/v1/gateway/health", async (request) => {
    return buatResponsSukses(request, {
      ...gatewayService.ambilKesehatanGateway(),
      database: cekStatusDatabaseGateway(),
    });
  });

  for (const rute of gatewayService.ambilKesehatanGateway().ruteTerdaftar) {
    if (rute.statusKesiapan === "menunggu_tahap_berikutnya") {
      app.all(`${rute.awalanPath}/*`, async () => {
        gatewayService.tolakLayananBelumAktif(
          rute.namaLayananTarget,
        );
      });
    }
  }
}

