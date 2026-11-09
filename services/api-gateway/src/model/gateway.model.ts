/**
 * @fileoverview Model kontrak routing dan kesehatan layanan pada API Gateway.
 */

export interface EntriRuteLayanan {
  awalanPath: string;
  namaLayananTarget: string;
  tahapMulaiAktif: number;
  statusKesiapan: "aktif" | "menunggu_tahap_berikutnya";
}

export interface RingkasanKesehatanGateway {
  layanan: "api-gateway";
  status: "sehat" | "terdegradasi";
  ruteTerdaftar: readonly EntriRuteLayanan[];
}

