/**
 * @fileoverview Repositori registri rute statis pada API Gateway.
 */

import type { EntriRuteLayanan } from "../model/gateway.model.ts";

const DAFTAR_RUTE_LAYANAN: readonly EntriRuteLayanan[] = [
  {
    awalanPath: "/v1/auth",
    namaLayananTarget: "identity-service",
    tahapMulaiAktif: 0,
    statusKesiapan: "aktif",
  },
  {
    awalanPath: "/v1/notifications",
    namaLayananTarget: "identity-service",
    tahapMulaiAktif: 0,
    statusKesiapan: "aktif",
  },
  {
    awalanPath: "/v1/foundation",
    namaLayananTarget: "identity-service",
    tahapMulaiAktif: 0,
    statusKesiapan: "aktif",
  },
  {
    awalanPath: "/v1/admin",
    namaLayananTarget: "identity-service",
    tahapMulaiAktif: 1,
    statusKesiapan: "aktif",
  },
  {
    awalanPath: "/v1/patients",
    namaLayananTarget: "patient-service",
    tahapMulaiAktif: 2,
    statusKesiapan: "aktif",
  },
  {
    awalanPath: "/v1/clinical-nutrition",
    namaLayananTarget: "clinical-nutrition-service",
    tahapMulaiAktif: 3,
    statusKesiapan: "aktif",
  },
  {
    awalanPath: "/v1/inpatient",
    namaLayananTarget: "patient-service",
    tahapMulaiAktif: 4,
    statusKesiapan: "aktif",
  },
  {
    awalanPath: "/v1/nursing",
    namaLayananTarget: "clinical-nutrition-service",
    tahapMulaiAktif: 5,
    statusKesiapan: "aktif",
  },
  {
    awalanPath: "/v1/dietitian",
    namaLayananTarget: "clinical-nutrition-service",
    tahapMulaiAktif: 6,
    statusKesiapan: "aktif",
  },
  {
    awalanPath: "/v1/meal-planning",
    namaLayananTarget: "clinical-nutrition-service",
    tahapMulaiAktif: 6,
    statusKesiapan: "aktif",
  },
  {
    awalanPath: "/v1/inventory",
    namaLayananTarget: "inventory-service",
    tahapMulaiAktif: 7,
    statusKesiapan: "aktif",
  },
  {
    awalanPath: "/v1/kitchen",
    namaLayananTarget: "kitchen-service",
    tahapMulaiAktif: 8,
    statusKesiapan: "aktif",
  },
  {
    awalanPath: "/v1/delivery-intake",
    namaLayananTarget: "delivery-intake-service",
    tahapMulaiAktif: 9,
    statusKesiapan: "aktif",
  },
  {
    awalanPath: "/v1/incidents",
    namaLayananTarget: "incident-audit-service",
    tahapMulaiAktif: 10,
    statusKesiapan: "aktif",
  },
  {
    awalanPath: "/v1/external-integrations",
    namaLayananTarget: "external-integration-service",
    tahapMulaiAktif: 11,
    statusKesiapan: "menunggu_tahap_berikutnya",
  },
];

export class GatewayRouteRepository {
  /**
   * Mengambil daftar rute layanan yang terdaftar pada API Gateway.
   */
  public ambilSemuaRute(): readonly EntriRuteLayanan[] {
    return DAFTAR_RUTE_LAYANAN;
  }
}

