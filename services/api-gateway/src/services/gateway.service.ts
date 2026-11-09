/**
 * @fileoverview Layanan orkestrasi dan pemeriksaan kesiapan rute pada API Gateway.
 */

import { KODE_GALAT } from "../../../../packages/shared-types/src/index.ts";
import { AppError } from "../../../identity-service/src/model/errors.ts";
import type { RingkasanKesehatanGateway } from "../model/gateway.model.ts";
import type { GatewayRouteRepository } from "../repository/gateway.repository.ts";

export class GatewayService {
  private readonly repository: GatewayRouteRepository;

  constructor(repository: GatewayRouteRepository) {
    this.repository = repository;
  }

  /**
   * Mengambil ringkasan kesehatan API Gateway beserta peta kesiapan rute per tahap.
   */
  public ambilKesehatanGateway(): RingkasanKesehatanGateway {
    return {
      layanan: "api-gateway",
      status: "sehat",
      ruteTerdaftar: this.repository.ambilSemuaRute(),
    };
  }

  /**
   * Menolak permintaan ke domain layanan yang belum masuk tahap aktif (fail-closed).
   *
   * @param namaLayanan - Nama microservice domain yang belum diaktifkan pada Tahap 10.
   * @param tahapTarget - Nomor tahap ketika layanan tersebut dijadwalkan aktif.
   */
  public tolakLayananBelumAktif(
    namaLayanan: string,
  ): never {
    throw new AppError({
      kode: KODE_GALAT.KONFLIK_BISNIS,
      statusHttp: 503,
      pesanPengguna: "Integrasi eksternal tidak diaktifkan pada aplikasi lokal.",
      pesanInternal: `Integrasi ${namaLayanan} tidak dikonfigurasi pada aplikasi lokal.`,
    });
  }
}

