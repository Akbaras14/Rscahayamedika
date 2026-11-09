/**
 * @fileoverview Lapisan database API Gateway.
 * Sesuai aturan kepemilikan data TECHSTACK.md Bagian 2, API Gateway bersifat stateless
 * dan TIDAK menulis langsung ke tabel domain milik microservice lain.
 */

export interface StatusDatabaseGateway {
  statelessGateway: true;
  catatan: string;
}

/**
 * Mengembalikan status bahwa API Gateway tidak menyimpan state database domain langsung.
 */
export function cekStatusDatabaseGateway(): StatusDatabaseGateway {
  return {
    statelessGateway: true,
    catatan:
      "API Gateway mendelegasikan penyimpanan data ke microservice pemilik masing-masing domain.",
  };
}

