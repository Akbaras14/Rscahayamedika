/**
 * @fileoverview Rute HTTP tipis (thin routes) untuk Identity Service (`/v1/...`).
 * Mencakup endpoint fondasi Tahap 0 dan endpoint Peran Administrator Tahap 1 (`/v1/admin/...`).
 * Rute hanya menangani autentikasi/otorisasi, validasi input, pemanggilan service,
 * pengelolaan cookie HttpOnly, dan pemetaan respons HTTP.
 */

import type { FastifyInstance } from "fastify";
import { BATAS_KEPEMILIKAN_LAYANAN } from "../../../../packages/contracts/src/index.ts";
import type { IdentityServiceEnv } from "../config/env.ts";
import {
  buatPreHandlerWajibAutentikasi,
  buatResponsSukses,
  ekstrakTokenSesiDariPermintaan,
  jalankanDenganIdempotensi,
} from "../middleware/security.middleware.ts";
import { buatGalatSesiBerakhir } from "../model/errors.ts";
import type { IdentityRepository } from "../repository/identity.repository.ts";
import type { IdentityService } from "../services/identity.service.ts";
import {
  BuatPenggunaAdminBodySchema,
  CabutSesiPenggunaAdminBodySchema,
  CekAksesBodySchema,
  KueryAuditAdminSchema,
  KueryDaftarPenggunaAdminSchema,
  KueryNotifikasiSchema,
  LoginBodySchema,
  ParamIdNotifikasiSchema,
  ParamIdPenggunaAdminSchema,
  ParamKunciKonfigurasiSchema,
  UbahKonfigurasiBodySchema,
  UbahPenggunaAdminBodySchema,
  validasiSkemaMasukan,
} from "../validators/identity.validator.ts";

export interface DependensiRuteIdentity {
  env: IdentityServiceEnv;
  repository: IdentityRepository;
  service: IdentityService;
}

/**
 * Mendaftarkan seluruh endpoint `/v1` untuk Identity Service (Tahap 0 & Tahap 1 Administrator).
 */
export async function daftarkanRuteIdentity(
  app: FastifyInstance,
  deps: DependensiRuteIdentity,
): Promise<void> {
  const wajibAutentikasi = buatPreHandlerWajibAutentikasi(
    deps.service,
    deps.env.SESSION_COOKIE_NAME,
  );

  /**
   * Health check layanan identitas & penyimpanan.
   */
  app.get("/v1/health", async (request, reply) => {
    const status = await deps.service.cekKesehatan();
    reply.status(status.status === "sehat" ? 200 : 503);
    return buatResponsSukses(request, status);
  });

  /**
   * Status fondasi dan tahap aktif saat ini (Tahap 1: Administrator).
   */
  app.get("/v1/foundation/status", async (request) => {
    const [kesehatan, konfigurasi] = await Promise.all([
      deps.service.cekKesehatan(),
      deps.service.ambilKonfigurasiOperasionalUmum(),
    ]);

    return buatResponsSukses(request, {
      namaTahap: "Tahap 2 — Petugas Pendaftaran",
      peranAktif: "petugas_pendaftaran",
      kesehatan,
      konfigurasiOperasional: konfigurasi,
      batasKepemilikanLayanan: BATAS_KEPEMILIKAN_LAYANAN,
    });
  });

  /**
   * Autentikasi pengguna dan penerbitan cookie sesi `HttpOnly`.
   */
  app.post(
    "/v1/auth/login",
    {
      config: {
        rateLimit: {
          max: deps.env.RATE_LIMIT_MAX_LOGIN,
          timeWindow: deps.env.RATE_LIMIT_LOGIN_WINDOW_MS,
        },
      },
    },
    async (request, reply) => {
      const body = validasiSkemaMasukan(LoginBodySchema, request.body);
      const hasil = await deps.service.autentikasiPengguna({
        namaPengguna: body.namaPengguna,
        kataSandi: body.kataSandi,
        alamatIp: request.ip,
        infoPerangkat: String(request.headers["user-agent"] ?? "unknown"),
        correlationId: request.correlationId,
      });

      const navigasi = deps.service.ambilNavigasiUntukProfil(hasil.profil);

      reply.setCookie(deps.env.SESSION_COOKIE_NAME, hasil.tokenSesiMentah, {
        httpOnly: true,
        secure: request.protocol === "https",
        sameSite: "lax",
        path: "/",
        maxAge: deps.env.SESSION_TTL_SECONDS,
      });

      return buatResponsSukses(request, {
        profil: hasil.profil,
        navigasi,
        waktuKedaluwarsa: hasil.waktuKedaluwarsa,
      });
    },
  );

  /**
   * Pencabutan sesi aktif dan penghapusan cookie `HttpOnly`.
   */
  app.post("/v1/auth/logout", async (request, reply) => {
    const tokenMentah = ekstrakTokenSesiDariPermintaan(
      request,
      deps.env.SESSION_COOKIE_NAME,
    );
    await deps.service.keluarSesi(tokenMentah, request.correlationId);

    reply.clearCookie(deps.env.SESSION_COOKIE_NAME, {
      httpOnly: true,
      secure: request.protocol === "https",
      sameSite: "lax",
      path: "/",
    });

    return buatResponsSukses(request, {
      berhasilKeluar: true,
    });
  });

  /**
   * Mengambil profil sesi pengguna aktif beserta navigasi adaptif berdasarkan izinnya.
   */
  app.get(
    "/v1/auth/me",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = request.profilSesi;
      if (!profil) {
        throw buatGalatSesiBerakhir();
      }
      const navigasi = deps.service.ambilNavigasiUntukProfil(profil);
      return buatResponsSukses(request, {
        profil,
        navigasi,
      });
    },
  );

  /**
   * Memeriksa hak akses peran dan pembatasan penugasan bangsal (deny by default).
   */
  app.post(
    "/v1/auth/check-access",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = request.profilSesi;
      if (!profil) {
        throw buatGalatSesiBerakhir();
      }
      const body = validasiSkemaMasukan(CekAksesBodySchema, request.body);
      const keputusan = await deps.service.verifikasiAksesPeranDanBangsal(
        profil,
        body,
        request.correlationId,
      );
      return buatResponsSukses(request, keputusan);
    },
  );

  /**
   * Mengambil daftar notifikasi milik pengguna aktif beserta jumlah `belum_dibaca`.
   */
  app.get(
    "/v1/notifications",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = request.profilSesi;
      if (!profil) {
        throw buatGalatSesiBerakhir();
      }
      await deps.service.verifikasiAksesPeranDanBangsal(
        profil,
        { izinDibutuhkan: "notifikasi:pribadi:baca" },
        request.correlationId,
      );

      const kuery = validasiSkemaMasukan(KueryNotifikasiSchema, request.query);
      const daftar = await deps.service.ambilNotifikasiPengguna(profil, kuery);
      return buatResponsSukses(request, daftar);
    },
  );

  /**
   * Menandai satu notifikasi sebagai `sudah_dibaca` (mendukung `X-Idempotency-Key`).
   */
  app.patch(
    "/v1/notifications/:id/read",
    { preHandler: [wajibAutentikasi] },
    async (request, reply) => {
      const profil = request.profilSesi;
      if (!profil) {
        throw buatGalatSesiBerakhir();
      }
      await deps.service.verifikasiAksesPeranDanBangsal(
        profil,
        { izinDibutuhkan: "notifikasi:pribadi:ubah" },
        request.correlationId,
      );

      const param = validasiSkemaMasukan(
        ParamIdNotifikasiSchema,
        request.params,
      );

      return jalankanDenganIdempotensi({
        request,
        reply,
        repository: deps.repository,
        penggunaId: profil.id,
        rute: `PATCH /v1/notifications/${param.id}/read`,
        payloadUntukFingerprint: { id: param.id },
        eksekusi: async () => {
          const item = await deps.service.tandaiSatuNotifikasiDibaca(
            profil,
            param.id,
            request.correlationId,
          );
          return {
            statusHttp: 200,
            body: buatResponsSukses(request, item),
          };
        },
      });
    },
  );

  /**
   * Menandai seluruh notifikasi `belum_dibaca` milik pengguna aktif menjadi `sudah_dibaca`.
   */
  app.post(
    "/v1/notifications/read-all",
    { preHandler: [wajibAutentikasi] },
    async (request, reply) => {
      const profil = request.profilSesi;
      if (!profil) {
        throw buatGalatSesiBerakhir();
      }
      await deps.service.verifikasiAksesPeranDanBangsal(
        profil,
        { izinDibutuhkan: "notifikasi:pribadi:ubah" },
        request.correlationId,
      );

      return jalankanDenganIdempotensi({
        request,
        reply,
        repository: deps.repository,
        penggunaId: profil.id,
        rute: "POST /v1/notifications/read-all",
        payloadUntukFingerprint: request.body ?? {},
        eksekusi: async () => {
          const hasil = await deps.service.tandaiSemuaNotifikasiDibaca(
            profil,
            request.correlationId,
          );
          return {
            statusHttp: 200,
            body: buatResponsSukses(request, hasil),
          };
        },
      });
    },
  );

  // ==========================================================================
  // RUTE TAHAP 1: PERAN ADMINISTRATOR (`/v1/admin/...`)
  // ==========================================================================

  /**
   * Mengambil daftar pengguna berpaginasi dengan filter pencarian, peran, dan status aktif.
   */
  app.get(
    "/v1/admin/users",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = request.profilSesi;
      if (!profil) {
        throw buatGalatSesiBerakhir();
      }
      const filter = validasiSkemaMasukan(
        KueryDaftarPenggunaAdminSchema,
        request.query,
      );
      const daftar = await deps.service.ambilDaftarPenggunaUntukAdmin(
        profil,
        filter,
        request.correlationId,
      );
      return buatResponsSukses(request, daftar);
    },
  );

  /**
   * Membuat akun pengguna baru oleh Administrator (mendukung `X-Idempotency-Key`).
   */
  app.post(
    "/v1/admin/users",
    { preHandler: [wajibAutentikasi] },
    async (request, reply) => {
      const profil = request.profilSesi;
      if (!profil) {
        throw buatGalatSesiBerakhir();
      }
      const body = validasiSkemaMasukan(
        BuatPenggunaAdminBodySchema,
        request.body,
      );

      return jalankanDenganIdempotensi({
        request,
        reply,
        repository: deps.repository,
        penggunaId: profil.id,
        rute: "POST /v1/admin/users",
        payloadUntukFingerprint: {
          namaPengguna: body.namaPengguna,
          namaLengkap: body.namaLengkap,
          peran: body.peran,
          daftarBangsalId: body.daftarBangsalId,
          aktif: body.aktif,
        },
        eksekusi: async () => {
          const dibuat = await deps.service.buatPenggunaOlehAdmin(
            profil,
            body,
            request.correlationId,
          );
          return {
            statusHttp: 201,
            body: buatResponsSukses(request, dibuat),
          };
        },
      });
    },
  );

  /**
   * Memperbarui akun pengguna (nama, peran, bangsal, status aktif) dengan optimistic concurrency (`versi`).
   */
  app.patch(
    "/v1/admin/users/:id",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = request.profilSesi;
      if (!profil) {
        throw buatGalatSesiBerakhir();
      }
      const param = validasiSkemaMasukan(
        ParamIdPenggunaAdminSchema,
        request.params,
      );
      const body = validasiSkemaMasukan(
        UbahPenggunaAdminBodySchema,
        request.body,
      );
      const diperbarui = await deps.service.ubahPenggunaOlehAdmin(
        profil,
        param.id,
        body,
        request.correlationId,
      );
      return buatResponsSukses(request, diperbarui);
    },
  );

  /**
   * Mencabut seluruh sesi aktif milik pengguna tertentu oleh Administrator.
   */
  app.post(
    "/v1/admin/users/:id/revoke-sessions",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = request.profilSesi;
      if (!profil) {
        throw buatGalatSesiBerakhir();
      }
      const param = validasiSkemaMasukan(
        ParamIdPenggunaAdminSchema,
        request.params,
      );
      const body = validasiSkemaMasukan(
        CabutSesiPenggunaAdminBodySchema,
        request.body,
      );
      const hasil = await deps.service.cabutSemuaSesiPenggunaOlehAdmin(
        profil,
        param.id,
        body.alasan,
        request.correlationId,
      );
      return buatResponsSukses(request, hasil);
    },
  );

  /**
   * Mengambil matriks 10 peran BRD dan daftar izinnya untuk Administrator.
   */
  app.get(
    "/v1/admin/roles",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = request.profilSesi;
      if (!profil) {
        throw buatGalatSesiBerakhir();
      }
      const peranList = await deps.service.ambilMatriksPeranUntukAdmin(
        profil,
        request.correlationId,
      );
      return buatResponsSukses(request, { items: peranList });
    },
  );

  /**
   * Mengambil daftar konfigurasi master operasional beserta riwayat perubahannya (`AB-030`).
   */
  app.get(
    "/v1/admin/configurations",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = request.profilSesi;
      if (!profil) {
        throw buatGalatSesiBerakhir();
      }
      const data = await deps.service.ambilKonfigurasiDanRiwayatUntukAdmin(
        profil,
        request.correlationId,
      );
      return buatResponsSukses(request, data);
    },
  );

  /**
   * Memperbarui nilai konfigurasi operasional dengan optimistic concurrency (`versi`) dan alasan wajib (`AB-030`).
   */
  app.put(
    "/v1/admin/configurations/:kunci",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = request.profilSesi;
      if (!profil) {
        throw buatGalatSesiBerakhir();
      }
      const param = validasiSkemaMasukan(
        ParamKunciKonfigurasiSchema,
        request.params,
      );
      const body = validasiSkemaMasukan(UbahKonfigurasiBodySchema, request.body);
      const hasil = await deps.service.ubahKonfigurasiOperasionalOlehAdmin(
        profil,
        param.kunci,
        body,
        request.correlationId,
      );
      return buatResponsSukses(request, hasil);
    },
  );

  /**
   * Mengambil daftar jejak audit akses dan perubahan konfigurasi yang telah disanitasi.
   */
  app.get(
    "/v1/admin/audit-logs",
    { preHandler: [wajibAutentikasi] },
    async (request) => {
      const profil = request.profilSesi;
      if (!profil) {
        throw buatGalatSesiBerakhir();
      }
      const filter = validasiSkemaMasukan(KueryAuditAdminSchema, request.query);
      const daftar = await deps.service.ambilDaftarAuditUntukAdmin(
        profil,
        filter,
        request.correlationId,
      );
      return buatResponsSukses(request, daftar);
    },
  );
}
