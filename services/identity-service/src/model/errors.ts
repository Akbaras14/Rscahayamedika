/**
 * @fileoverview Hirarki galat terstruktur (AppError) untuk memisahkan pesan aman pengguna
 * dari detail diagnostik internal sesuai AGENTS.md Bagian 4 & 6 serta UI_UX.md Bagian 9.
 */

import {
  KODE_GALAT,
  type KodeGalat,
  type RincianGalatField,
} from "../../../../packages/shared-types/src/index.ts";

export interface OpsiAppError {
  kode: KodeGalat;
  statusHttp: number;
  pesanPengguna: string;
  pesanInternal?: string;
  rincianValidasi?: RincianGalatField[];
  sebab?: unknown;
}

/**
 * Kelas dasar galat aplikasi terstruktur.
 * `pesanPengguna` aman dikirim ke UI, sedangkan `pesanInternal` hanya untuk log internal yang disanitasi.
 */
export class AppError extends Error {
  public readonly kode: KodeGalat;
  public readonly statusHttp: number;
  public readonly pesanPengguna: string;
  public readonly pesanInternal: string;
  public readonly rincianValidasi?: RincianGalatField[];

  constructor(opsi: OpsiAppError) {
    super(opsi.pesanInternal ?? opsi.pesanPengguna, { cause: opsi.sebab });
    this.name = "AppError";
    this.kode = opsi.kode;
    this.statusHttp = opsi.statusHttp;
    this.pesanPengguna = opsi.pesanPengguna;
    this.pesanInternal = opsi.pesanInternal ?? opsi.pesanPengguna;
    this.rincianValidasi = opsi.rincianValidasi;
  }
}

/**
 * Membuat galat validasi input (HTTP 400) dengan rincian per field yang aman.
 */
export function buatGalatValidasi(
  pesanPengguna: string,
  rincianValidasi: RincianGalatField[] = [],
): AppError {
  return new AppError({
    kode: KODE_GALAT.VALIDASI_GAGAL,
    statusHttp: 400,
    pesanPengguna,
    rincianValidasi,
  });
}

/**
 * Membuat galat autentikasi gagal (HTTP 401).
 */
export function buatGalatAutentikasi(
  pesanPengguna = "Nama pengguna atau kata sandi tidak sesuai.",
  pesanInternal?: string,
): AppError {
  return new AppError({
    kode: KODE_GALAT.AUTENTIKASI_GAGAL,
    statusHttp: 401,
    pesanPengguna,
    pesanInternal,
  });
}

/**
 * Membuat galat sesi berakhir (HTTP 401) sesuai salinan wajib UI_UX.md Bagian 9.1.
 */
export function buatGalatSesiBerakhir(pesanInternal?: string): AppError {
  return new AppError({
    kode: KODE_GALAT.SESI_BERAKHIR,
    statusHttp: 401,
    pesanPengguna: "Sesi Anda berakhir. Silakan masuk kembali.",
    pesanInternal,
  });
}

/**
 * Membuat galat akses ditolak (HTTP 403) sesuai salinan wajib UI_UX.md Bagian 9.1.
 */
export function buatGalatAksesDitolak(pesanInternal?: string): AppError {
  return new AppError({
    kode: KODE_GALAT.AKSES_DITOLAK,
    statusHttp: 403,
    pesanPengguna: "Anda tidak memiliki izin untuk tindakan ini.",
    pesanInternal,
  });
}

/**
 * Membuat galat data tidak ditemukan (HTTP 404).
 */
export function buatGalatTidakDitemukan(
  pesanPengguna: string,
  pesanInternal?: string,
): AppError {
  return new AppError({
    kode: KODE_GALAT.DATA_TIDAK_DITEMUKAN,
    statusHttp: 404,
    pesanPengguna,
    pesanInternal,
  });
}

/**
 * Membuat galat konflik proses bisnis atau idempotensi (HTTP 409).
 */
export function buatGalatKonflik(
  pesanPengguna: string,
  kode: KodeGalat = KODE_GALAT.KONFLIK_BISNIS,
  pesanInternal?: string,
): AppError {
  return new AppError({
    kode,
    statusHttp: 409,
    pesanPengguna,
    pesanInternal,
  });
}

/**
 * Membuat galat penahanan keselamatan pasien (HTTP 422/409).
 */
export function buatGalatPenahananKeselamatan(
  pesanPengguna: string,
  pesanInternal?: string,
): AppError {
  return new AppError({
    kode: KODE_GALAT.PENAHANAN_KESELAMATAN,
    statusHttp: 422,
    pesanPengguna,
    pesanInternal,
  });
}

