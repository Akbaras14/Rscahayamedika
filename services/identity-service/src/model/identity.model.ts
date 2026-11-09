/**
 * @fileoverview Model domain dan DTO untuk Identity Service (bebas dari query SQL dan driver database).
 * Acuan: BRD Versi 4.0 Bab III & XVII (AB-030, AB-032, AB-034), TECHSTACK.md Bagian 4.
 */

import type {
  ItemNotifikasiKontrak,
  IzinSistem,
  KategoriNotifikasi,
  PeranPengguna,
  PrioritasNotifikasi,
  ProfilSesiPengguna,
  StatusBacaNotifikasi,
} from "../../../../packages/shared-types/src/index.ts";

/**
 * Entitas akun pengguna di penyimpanan resmi `identity-service`.
 */
export interface EntitasPengguna {
  id: string;
  namaPengguna: string;
  namaLengkap: string;
  passwordHash: string;
  passwordSalt: string;
  peran: PeranPengguna;
  aktif: boolean;
  daftarBangsalId: string[];
  versi: number;
  dibuatPada: string;
  diperbaruiPada: string;
}

/**
 * Representasi akun pengguna yang aman untuk ditampilkan pada tabel pengelolaan Administrator
 * (tanpa menyertakan `passwordHash` dan `passwordSalt`).
 */
export interface RingkasanPenggunaAdminDto {
  id: string;
  namaPengguna: string;
  namaLengkap: string;
  peran: PeranPengguna;
  labelPeran: string;
  aktif: boolean;
  daftarBangsalId: string[];
  daftarIzin: IzinSistem[];
  versi: number;
  dibuatPada: string;
  diperbaruiPada: string;
}

/**
 * Filter pencarian daftar pengguna untuk Administrator.
 */
export interface FilterPenggunaAdminDto {
  kataKunci?: string;
  peran?: PeranPengguna;
  aktif?: boolean;
  halaman: number;
  ukuranHalaman: number;
}

/**
 * Respons daftar pengguna berpaginasi untuk Administrator.
 */
export interface DaftarPenggunaAdminRespons {
  items: RingkasanPenggunaAdminDto[];
  totalItem: number;
  halaman: number;
  ukuranHalaman: number;
}

/**
 * DTO masuk pembuatan akun pengguna baru oleh Administrator.
 */
export interface BuatPenggunaAdminDto {
  namaPengguna: string;
  namaLengkap: string;
  kataSandi: string;
  peran: PeranPengguna;
  daftarBangsalId: string[];
  aktif: boolean;
  alasan: string;
}

/**
 * DTO masuk pembaruan akun pengguna oleh Administrator dengan optimistic concurrency (`versi`)
 * dan pencatatan alasan perubahan wajib (`AB-030`).
 */
export interface UbahPenggunaAdminDto {
  namaLengkap: string;
  peran: PeranPengguna;
  daftarBangsalId: string[];
  aktif: boolean;
  versi: number;
  alasanPerubahan: string;
}

/**
 * Entitas sesi pengguna aktif di server.
 */
export interface EntitasSesi {
  id: string;
  tokenHash: string;
  penggunaId: string;
  alamatIp: string;
  infoPerangkat: string;
  waktuDibuat: string;
  waktuKedaluwarsa: string;
  dicabutPada: string | null;
}

/**
 * Entitas konfigurasi operasional dasar (non-klinis).
 */
export interface EntitasKonfigurasiOperasional {
  kunci: string;
  nilai: string;
  deskripsi: string;
  versi: number;
  diperbaruiOleh: string;
  diperbaruiPada: string;
}

/**
 * Entitas riwayat perubahan konfigurasi operasional (`AB-030`).
 */
export interface EntitasRiwayatKonfigurasi {
  id: string;
  kunciKonfigurasi: string;
  nilaiSebelum: string;
  nilaiSesudah: string;
  versiSebelum: number;
  versiSesudah: number;
  alasanPerubahan: string;
  diubahOleh: string;
  diubahPada: string;
  correlationId: string;
}

/**
 * DTO masuk pembaruan nilai konfigurasi operasional oleh Administrator.
 */
export interface UbahKonfigurasiOperasionalDto {
  nilai: string;
  versi: number;
  alasanPerubahan: string;
}

/**
 * Entitas catatan audit akses dan perubahan sensitif.
 * Tidak boleh menyimpan isi catatan klinis lengkap atau kata sandi/token.
 */
export interface EntitasCatatanAudit {
  id: string;
  waktuKejadian: string;
  aktorPenggunaId: string | null;
  aktorPeran: PeranPengguna | "anonim";
  tindakan: string;
  objekTipe: string;
  objekId: string;
  statusHasil: "berhasil" | "ditolak" | "gagal";
  alasan: string;
  correlationId: string;
  metadataTersanitasi: Record<string, string | number | boolean | null>;
}

/**
 * Filter pencarian catatan audit oleh Administrator.
 */
export interface FilterAuditAdminDto {
  kataKunci?: string;
  statusHasil?: "berhasil" | "ditolak" | "gagal";
  tindakan?: string;
  halaman: number;
  ukuranHalaman: number;
}

/**
 * Respons daftar catatan audit berpaginasi untuk Administrator.
 */
export interface DaftarAuditAdminRespons {
  items: EntitasCatatanAudit[];
  totalItem: number;
  halaman: number;
  ukuranHalaman: number;
}

/**
 * Entitas kunci idempotensi untuk mencegah duplikasi mutasi berulang.
 */
export interface EntitasKunciIdempotensi {
  kunci: string;
  penggunaId: string;
  rute: string;
  fingerprintPayload: string;
  statusHttp: number;
  responsJson: string;
  waktuDibuat: string;
  waktuKedaluwarsa: string;
}

/**
 * DTO masuk untuk proses login.
 */
export interface MasukanLoginDto {
  namaPengguna: string;
  kataSandi: string;
  alamatIp: string;
  infoPerangkat: string;
  correlationId: string;
}

/**
 * DTO keluaran hasil login yang berhasil.
 */
export interface HasilLoginDto {
  tokenSesiMentah: string;
  waktuKedaluwarsa: string;
  profil: ProfilSesiPengguna;
}

/**
 * DTO pemeriksaan otorisasi peran dan penugasan bangsal.
 */
export interface PermintaanCekAksesDto {
  izinDibutuhkan: IzinSistem;
  bangsalId?: string;
}

/**
 * DTO hasil pemeriksaan otorisasi.
 */
export interface HasilCekAksesDto {
  diizinkan: boolean;
  peran: PeranPengguna;
  izinDiperiksa: IzinSistem;
  bangsalDiperiksa: string | null;
  alasan: string;
}

/**
 * Filter pencarian notifikasi per pengguna.
 */
export interface FilterNotifikasiDto {
  penerimaId: string;
  statusBaca?: StatusBacaNotifikasi;
  kategori?: KategoriNotifikasi;
  prioritas?: PrioritasNotifikasi;
  halaman: number;
  ukuranHalaman: number;
}

export type { ItemNotifikasiKontrak };
