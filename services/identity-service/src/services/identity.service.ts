/**
 * @fileoverview Layanan bisnis untuk Identity Service (Tahap 0 & Tahap 1 — Administrator):
 * - Autentikasi, pengelolaan sesi, otorisasi peran & bangsal (deny by default)
 * - Pengelolaan akun pengguna, peran & izin, penugasan bangsal (Tahap 1)
 * - Pengelolaan konfigurasi master operasional berversi dengan riwayat koreksi (AB-030)
 * - Peninjauan jejak audit akses & perubahan yang telah disanitasi (AB-032, AB-034)
 */

import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import {
  ambilRuteUtamaPeran,
  type DefinisiPeranMaster,
  MATRIKS_PERAN_MASTER,
  saringNavigasiBerdasarkanIzin,
} from "../../../../packages/contracts/src/index.ts";
import {
  KODE_GALAT,
  PERAN_PENGGUNA,
  type DaftarNotifikasiRespons,
  type ItemNavigasiPeran,
  type ItemNotifikasiKontrak,
  type ProfilSesiPengguna,
} from "../../../../packages/shared-types/src/index.ts";
import { CacheMemoriTerbatas } from "../events/outbox.ts";
import {
  buatGalatAksesDitolak,
  buatGalatAutentikasi,
  buatGalatKonflik,
  buatGalatPenahananKeselamatan,
  buatGalatSesiBerakhir,
  buatGalatTidakDitemukan,
  buatGalatValidasi,
} from "../model/errors.ts";
import type {
  BuatPenggunaAdminDto,
  DaftarAuditAdminRespons,
  DaftarPenggunaAdminRespons,
  EntitasCatatanAudit,
  EntitasKonfigurasiOperasional,
  EntitasPengguna,
  EntitasRiwayatKonfigurasi,
  FilterAuditAdminDto,
  FilterNotifikasiDto,
  FilterPenggunaAdminDto,
  HasilCekAksesDto,
  HasilLoginDto,
  MasukanLoginDto,
  PermintaanCekAksesDto,
  RingkasanPenggunaAdminDto,
  UbahKonfigurasiOperasionalDto,
  UbahPenggunaAdminDto,
} from "../model/identity.model.ts";
import type { IdentityRepository } from "../repository/identity.repository.ts";

const KUNCI_SENSITIF_TERLARANG = new Set([
  "password",
  "katasandi",
  "passwordhash",
  "token",
  "tokensession",
  "cookie",
  "authorization",
  "nik",
  "norm",
  "diagnosis",
  "alergi",
  "catatan_klinis",
]);

/**
 * Menghasilkan hash SHA-256 heksadesimal dari token sesi mentah agar token asli
 * tidak pernah disimpan dalam bentuk teks biasa di database maupun log.
 *
 * @param tokenMentah - Token sesi acak milik klien.
 * @returns Hash SHA-256 heksadesimal.
 */
export function hashTokenSesi(tokenMentah: string): string {
  return createHash("sha256").update(tokenMentah, "utf8").digest("hex");
}

/**
 * Memverifikasi kecocokan kata sandi dengan hash `scrypt` secara waktu konstan (`timingSafeEqual`).
 *
 * @param kataSandiMasukan - Kata sandi yang dikirim pengguna saat login.
 * @param passwordSalt - Salt akun pengguna.
 * @param passwordHashEkspektasi - Hash kata sandi yang tersimpan.
 * @returns `true` jika kata sandi cocok, `false` jika tidak.
 */
export function verifikasiKataSandiAman(
  kataSandiMasukan: string,
  passwordSalt: string,
  passwordHashEkspektasi: string,
): boolean {
  const hashMasukanBuffer = scryptSync(kataSandiMasukan, passwordSalt, 64);
  const hashEkspektasiBuffer = Buffer.from(passwordHashEkspektasi, "hex");
  if (hashMasukanBuffer.length !== hashEkspektasiBuffer.length) {
    return false;
  }
  return timingSafeEqual(hashMasukanBuffer, hashEkspektasiBuffer);
}

/**
 * Menyaring metadata audit agar tidak pernah menyimpan kata sandi, token,
 * identitas pasien, diagnosis, alergi, atau catatan klinis.
 *
 * @param metadata - Metadata mentah yang akan dicatat ke tabel audit.
 * @returns Metadata yang telah disensor untuk field sensitif.
 */
export function sanitasiMetadataAudit(
  metadata: Record<string, string | number | boolean | null | undefined>,
): Record<string, string | number | boolean | null> {
  const hasil: Record<string, string | number | boolean | null> = {};
  for (const [kunci, nilai] of Object.entries(metadata)) {
    const kunciNormal = kunci.toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (KUNCI_SENSITIF_TERLARANG.has(kunciNormal)) {
      hasil[kunci] = "[DIREDaksi]";
    } else if (nilai !== undefined) {
      hasil[kunci] = nilai;
    }
  }
  return hasil;
}

/**
 * Layanan aplikasi utama untuk domain identitas, otorisasi, notifikasi per pengguna,
 * pengelolaan akun/peran/konfigurasi oleh Administrator (Tahap 1), dan audit.
 */
export class IdentityService {
  private readonly repository: IdentityRepository;
  private readonly sessionTtlSeconds: number;
  private readonly cacheKonfigurasi = new CacheMemoriTerbatas<
    EntitasKonfigurasiOperasional[]
  >(10, 30_000);

  constructor(repository: IdentityRepository, sessionTtlSeconds = 28800) {
    this.repository = repository;
    this.sessionTtlSeconds = sessionTtlSeconds;
  }

  /**
   * Mengonversi entitas pengguna menjadi profil sesi publik yang aman dikirim ke klien.
   */
  public petakanKeProfilSesi(pengguna: EntitasPengguna): ProfilSesiPengguna {
    const definisiPeran = MATRIKS_PERAN_MASTER[pengguna.peran];
    return {
      id: pengguna.id,
      namaPengguna: pengguna.namaPengguna,
      namaLengkap: pengguna.namaLengkap,
      peran: pengguna.peran,
      labelPeran: definisiPeran.nama,
      daftarIzin: [...definisiPeran.izinDefault],
      daftarBangsalId: [...pengguna.daftarBangsalId],
      aktif: pengguna.aktif,
    };
  }

  /**
   * Mengonversi entitas pengguna menjadi ringkasan pengguna untuk tabel Administrator
   * tanpa mengekspos `passwordHash` atau `passwordSalt`.
   */
  public petakanKeRingkasanAdmin(
    pengguna: EntitasPengguna,
  ): RingkasanPenggunaAdminDto {
    const definisiPeran = MATRIKS_PERAN_MASTER[pengguna.peran];
    return {
      id: pengguna.id,
      namaPengguna: pengguna.namaPengguna,
      namaLengkap: pengguna.namaLengkap,
      peran: pengguna.peran,
      labelPeran: definisiPeran.nama,
      aktif: pengguna.aktif,
      daftarBangsalId: [...pengguna.daftarBangsalId],
      daftarIzin: [...definisiPeran.izinDefault],
      versi: pengguna.versi,
      dibuatPada: pengguna.dibuatPada,
      diperbaruiPada: pengguna.diperbaruiPada,
    };
  }

  /**
   * Memproses login pengguna, memverifikasi status aktif dan kata sandi,
   * menerbitkan sesi baru, serta mencatat jejak audit.
   * Referensi aturan bisnis: AB-032, AB-034.
   */
  public async autentikasiPengguna(
    masukan: MasukanLoginDto,
  ): Promise<HasilLoginDto> {
    const pengguna = await this.repository.cariPenggunaBerdasarkanNamaPengguna(
      masukan.namaPengguna,
    );

    if (!pengguna) {
      await this.catatAudit({
        aktorPenggunaId: null,
        aktorPeran: "anonim",
        tindakan: "AUTH_LOGIN",
        objekTipe: "sesi_pengguna",
        objekId: masukan.namaPengguna,
        statusHasil: "ditolak",
        alasan: "Nama pengguna tidak ditemukan.",
        correlationId: masukan.correlationId,
        metadata: { alamatIp: masukan.alamatIp },
      });
      throw buatGalatAutentikasi(
        "Nama pengguna atau kata sandi tidak sesuai.",
        "Login gagal: akun tidak ditemukan.",
      );
    }

    if (!pengguna.aktif) {
      await this.catatAudit({
        aktorPenggunaId: pengguna.id,
        aktorPeran: pengguna.peran,
        tindakan: "AUTH_LOGIN",
        objekTipe: "sesi_pengguna",
        objekId: pengguna.id,
        statusHasil: "ditolak",
        alasan: "Akun pengguna berstatus nonaktif.",
        correlationId: masukan.correlationId,
        metadata: { alamatIp: masukan.alamatIp },
      });
      throw buatGalatAutentikasi(
        "Akun Anda tidak aktif. Hubungi Administrator sistem.",
        "Login ditolak: akun nonaktif.",
      );
    }

    const kataSandiValid = verifikasiKataSandiAman(
      masukan.kataSandi,
      pengguna.passwordSalt,
      pengguna.passwordHash,
    );

    if (!kataSandiValid) {
      await this.catatAudit({
        aktorPenggunaId: pengguna.id,
        aktorPeran: pengguna.peran,
        tindakan: "AUTH_LOGIN",
        objekTipe: "sesi_pengguna",
        objekId: pengguna.id,
        statusHasil: "ditolak",
        alasan: "Kata sandi tidak cocok.",
        correlationId: masukan.correlationId,
        metadata: { alamatIp: masukan.alamatIp },
      });
      throw buatGalatAutentikasi(
        "Nama pengguna atau kata sandi tidak sesuai.",
        "Login gagal: kata sandi salah.",
      );
    }

    const tokenSesiMentah = randomBytes(32).toString("hex");
    const tokenHash = hashTokenSesi(tokenSesiMentah);
    const sekarang = new Date();
    const kedaluwarsa = new Date(
      sekarang.getTime() + this.sessionTtlSeconds * 1000,
    );
    const idSesi = `ses-${randomUUID()}`;

    await this.repository.simpanSesiBaru({
      id: idSesi,
      tokenHash,
      penggunaId: pengguna.id,
      alamatIp: masukan.alamatIp,
      infoPerangkat: masukan.infoPerangkat.slice(0, 250),
      waktuDibuat: sekarang.toISOString(),
      waktuKedaluwarsa: kedaluwarsa.toISOString(),
      dicabutPada: null,
    });

    await this.catatAudit({
      aktorPenggunaId: pengguna.id,
      aktorPeran: pengguna.peran,
      tindakan: "AUTH_LOGIN",
      objekTipe: "sesi_pengguna",
      objekId: idSesi,
      statusHasil: "berhasil",
      alasan: "Autentikasi berhasil dan sesi baru diterbitkan.",
      correlationId: masukan.correlationId,
      metadata: { alamatIp: masukan.alamatIp },
    });

    return {
      tokenSesiMentah,
      waktuKedaluwarsa: kedaluwarsa.toISOString(),
      profil: this.petakanKeProfilSesi(pengguna),
    };
  }

  /**
   * Memvalidasi token sesi aktif dan mengembalikan profil pengguna beserta navigasi adaptifnya.
   */
  public async validasiSesiAktif(
    tokenSesiMentah: string | undefined,
  ): Promise<ProfilSesiPengguna> {
    if (!tokenSesiMentah || tokenSesiMentah.trim().length < 16) {
      throw buatGalatSesiBerakhir(
        "Token sesi tidak tersedia atau terlalu pendek.",
      );
    }

    const tokenHash = hashTokenSesi(tokenSesiMentah.trim());
    const sesi = await this.repository.cariSesiAktifBerdasarkanTokenHash(
      tokenHash,
      new Date().toISOString(),
    );

    if (!sesi) {
      throw buatGalatSesiBerakhir(
        "Sesi tidak ditemukan, sudah dicabut, atau telah kedaluwarsa.",
      );
    }

    const pengguna = await this.repository.cariPenggunaBerdasarkanId(
      sesi.penggunaId,
    );
    if (!pengguna || !pengguna.aktif) {
      throw buatGalatSesiBerakhir(
        "Pengguna pemilik sesi tidak ditemukan atau sudah dinonaktifkan.",
      );
    }

    return this.petakanKeProfilSesi(pengguna);
  }

  /**
   * Mencabut sesi pengguna saat logout dan mencatat jejak audit.
   */
  public async keluarSesi(
    tokenSesiMentah: string | undefined,
    correlationId: string,
  ): Promise<void> {
    if (!tokenSesiMentah) {
      return;
    }
    const tokenHash = hashTokenSesi(tokenSesiMentah.trim());
    const sesi = await this.repository.cariSesiAktifBerdasarkanTokenHash(
      tokenHash,
      new Date().toISOString(),
    );
    await this.repository.cabutSesiBerdasarkanTokenHash(
      tokenHash,
      new Date().toISOString(),
    );

    if (sesi) {
      const pengguna = await this.repository.cariPenggunaBerdasarkanId(
        sesi.penggunaId,
      );
      await this.catatAudit({
        aktorPenggunaId: sesi.penggunaId,
        aktorPeran: pengguna?.peran ?? "anonim",
        tindakan: "AUTH_LOGOUT",
        objekTipe: "sesi_pengguna",
        objekId: sesi.id,
        statusHasil: "berhasil",
        alasan: "Pengguna mengakhiri sesi secara eksplisit.",
        correlationId,
        metadata: {},
      });
    }
  }

  /**
   * Memeriksa apakah profil sesi memiliki izin tertentu dan (bila berlaku) ditugaskan pada bangsal target.
   * Menerapkan prinsip deny-by-default, pemisahan akses klinis dari administrator (AB-032),
   * serta larangan akses lintas bangsal tanpa kewenangan (AGENTS.md Bagian 4 & 8).
   */
  public async verifikasiAksesPeranDanBangsal(
    profil: ProfilSesiPengguna,
    permintaan: PermintaanCekAksesDto,
    correlationId: string,
  ): Promise<HasilCekAksesDto> {
    const memilikiIzin = profil.daftarIzin.includes(permintaan.izinDibutuhkan);
    if (!memilikiIzin) {
      await this.catatAudit({
        aktorPenggunaId: profil.id,
        aktorPeran: profil.peran,
        tindakan: "AUTHZ_CHECK_PERMISSION",
        objekTipe: "izin_sistem",
        objekId: permintaan.izinDibutuhkan,
        statusHasil: "ditolak",
        alasan: `Peran ${profil.peran} tidak memiliki izin ${permintaan.izinDibutuhkan}.`,
        correlationId,
        metadata: {
          bangsalTarget: permintaan.bangsalId ?? null,
        },
      });
      throw buatGalatAksesDitolak(
        `Akses ditolak: peran ${profil.peran} tidak memiliki izin ${permintaan.izinDibutuhkan}.`,
      );
    }

    const definisiPeran = MATRIKS_PERAN_MASTER[profil.peran];
    if (permintaan.bangsalId && definisiPeran.wajibBatasBangsal) {
      const diizinkanPadaBangsal = profil.daftarBangsalId.includes(
        permintaan.bangsalId,
      );
      if (!diizinkanPadaBangsal) {
        await this.catatAudit({
          aktorPenggunaId: profil.id,
          aktorPeran: profil.peran,
          tindakan: "AUTHZ_CHECK_WARD_SCOPE",
          objekTipe: "bangsal",
          objekId: permintaan.bangsalId,
          statusHasil: "ditolak",
          alasan: `Pengguna tidak ditugaskan pada bangsal ${permintaan.bangsalId}.`,
          correlationId,
          metadata: {
            izinDiperiksa: permintaan.izinDibutuhkan,
            bangsalTarget: permintaan.bangsalId,
          },
        });
        throw buatGalatAksesDitolak(
          `Akses lintas bangsal ditolak untuk bangsal ${permintaan.bangsalId}.`,
        );
      }
    }

    return {
      diizinkan: true,
      peran: profil.peran,
      izinDiperiksa: permintaan.izinDibutuhkan,
      bangsalDiperiksa: permintaan.bangsalId ?? null,
      alasan: "Hak akses peran dan cakupan unit sesuai kewenangan.",
    };
  }

  /**
   * Mengambil daftar navigasi yang hanya boleh dilihat oleh peran pengguna aktif.
   */
  public ambilNavigasiUntukProfil(
    profil: ProfilSesiPengguna,
  ): ItemNavigasiPeran[] {
    return saringNavigasiBerdasarkanIzin(profil.daftarIzin);
  }

  /**
   * Mengambil daftar notifikasi milik pengguna aktif beserta jumlah belum dibaca.
   */
  public async ambilNotifikasiPengguna(
    profil: ProfilSesiPengguna,
    filter: Omit<FilterNotifikasiDto, "penerimaId">,
  ): Promise<DaftarNotifikasiRespons> {
    return this.repository.ambilDaftarNotifikasi({
      ...filter,
      penerimaId: profil.id,
    });
  }

  /**
   * Menandai satu notifikasi sebagai `sudah_dibaca` hanya jika notifikasi tersebut milik pengguna aktif.
   */
  public async tandaiSatuNotifikasiDibaca(
    profil: ProfilSesiPengguna,
    notifikasiId: string,
    correlationId: string,
  ): Promise<ItemNotifikasiKontrak> {
    const eksisting =
      await this.repository.cariNotifikasiBerdasarkanId(notifikasiId);
    if (!eksisting) {
      throw buatGalatTidakDitemukan("Notifikasi tidak ditemukan.");
    }

    if (eksisting.penerimaId !== profil.id) {
      await this.catatAudit({
        aktorPenggunaId: profil.id,
        aktorPeran: profil.peran,
        tindakan: "NOTIFIKASI_MARK_READ",
        objekTipe: "notifikasi_pengguna",
        objekId: notifikasiId,
        statusHasil: "ditolak",
        alasan: "Percobaan mengubah status notifikasi milik pengguna lain.",
        correlationId,
        metadata: {},
      });
      throw buatGalatAksesDitolak(
        "Pengguna mencoba menandai notifikasi milik akun lain.",
      );
    }

    const waktuSekarang = new Date().toISOString();
    const diperbarui = await this.repository.tandaiNotifikasiSudahDibaca(
      notifikasiId,
      profil.id,
      waktuSekarang,
    );

    if (!diperbarui) {
      throw buatGalatTidakDitemukan("Notifikasi tidak ditemukan.");
    }

    await this.catatAudit({
      aktorPenggunaId: profil.id,
      aktorPeran: profil.peran,
      tindakan: "NOTIFIKASI_MARK_READ",
      objekTipe: "notifikasi_pengguna",
      objekId: notifikasiId,
      statusHasil: "berhasil",
      alasan: "Notifikasi ditandai sudah dibaca oleh penerima sah.",
      correlationId,
      metadata: {},
    });

    return diperbarui;
  }

  /**
   * Menandai seluruh notifikasi `belum_dibaca` milik pengguna aktif menjadi `sudah_dibaca`.
   */
  public async tandaiSemuaNotifikasiDibaca(
    profil: ProfilSesiPengguna,
    correlationId: string,
  ): Promise<{ jumlahDiperbarui: number; waktuDibaca: string }> {
    const waktuDibaca = new Date().toISOString();
    const jumlahDiperbarui =
      await this.repository.tandaiSemuaNotifikasiSudahDibaca(
        profil.id,
        waktuDibaca,
      );

    await this.catatAudit({
      aktorPenggunaId: profil.id,
      aktorPeran: profil.peran,
      tindakan: "NOTIFIKASI_MARK_ALL_READ",
      objekTipe: "notifikasi_pengguna",
      objekId: profil.id,
      statusHasil: "berhasil",
      alasan: `Menandai ${jumlahDiperbarui} notifikasi belum dibaca menjadi sudah dibaca.`,
      correlationId,
      metadata: { jumlahDiperbarui },
    });

    return { jumlahDiperbarui, waktuDibaca };
  }

  // ==========================================================================
  // TAHAP 1: USE CASE PERAN ADMINISTRATOR (PENGGUNA, PERAN, KONFIGURASI, AUDIT)
  // ==========================================================================

  /**
   * Memvalidasi aturan penugasan bangsal terhadap peran pengguna.
   * - Peran klinis/operasional bangsal (`wajibBatasBangsal === true`) wajib memiliki minimal 1 kode bangsal.
   * - Peran `administrator` DILARANG memiliki penugasan bangsal klinis (`AB-032`).
   */
  private validasiAturanBangsalPeran(
    peran: EntitasPengguna["peran"],
    daftarBangsalId: string[],
  ): string[] {
    const definisi = MATRIKS_PERAN_MASTER[peran];
    const unikBangsal = Array.from(
      new Set(daftarBangsalId.map((b) => b.trim().toUpperCase())),
    ).filter((b) => b.length > 0);

    if (peran === "administrator" && unikBangsal.length > 0) {
      throw buatGalatValidasi(
        "Peran Administrator tidak boleh memiliki penugasan bangsal klinis (AB-032).",
        [
          {
            field: "daftarBangsalId",
            pesan:
              "Kosongkan penugasan bangsal untuk peran Administrator teknis.",
          },
        ],
      );
    }

    if (definisi.wajibBatasBangsal && unikBangsal.length === 0) {
      throw buatGalatValidasi(
        `Peran ${definisi.nama} wajib memiliki minimal satu penugasan bangsal.`,
        [
          {
            field: "daftarBangsalId",
            pesan: `Masukkan minimal satu kode bangsal (contoh: BANGSAL-ANGGREK) untuk peran ${definisi.nama}.`,
          },
        ],
      );
    }

    return unikBangsal;
  }

  /**
   * Mengambil daftar pengguna berpaginasi untuk Administrator.
   * Referensi aturan bisnis: AB-032.
   */
  public async ambilDaftarPenggunaUntukAdmin(
    aktor: ProfilSesiPengguna,
    filter: FilterPenggunaAdminDto,
    correlationId: string,
  ): Promise<DaftarPenggunaAdminRespons> {
    await this.verifikasiAksesPeranDanBangsal(
      aktor,
      { izinDibutuhkan: "admin:pengguna:baca" },
      correlationId,
    );

    const hasil = await this.repository.ambilDaftarPenggunaAdmin(filter);
    return {
      items: hasil.items.map((p) => this.petakanKeRingkasanAdmin(p)),
      totalItem: hasil.totalItem,
      halaman: filter.halaman,
      ukuranHalaman: filter.ukuranHalaman,
    };
  }

  /**
   * Membuat akun pengguna baru oleh Administrator disertai pencatatan audit dan notifikasi akun.
   * Referensi aturan bisnis: AB-032, AB-034.
   */
  public async buatPenggunaOlehAdmin(
    aktor: ProfilSesiPengguna,
    masukan: BuatPenggunaAdminDto,
    correlationId: string,
  ): Promise<RingkasanPenggunaAdminDto> {
    await this.verifikasiAksesPeranDanBangsal(
      aktor,
      { izinDibutuhkan: "admin:pengguna:ubah" },
      correlationId,
    );

    const sudahAda =
      await this.repository.cariPenggunaBerdasarkanNamaPengguna(
        masukan.namaPengguna,
      );
    if (sudahAda) {
      throw buatGalatKonflik(
        `Nama pengguna "${masukan.namaPengguna}" sudah terdaftar. Gunakan nama pengguna lain.`,
        KODE_GALAT.KONFLIK_BISNIS,
      );
    }

    const daftarBangsalBersih = this.validasiAturanBangsalPeran(
      masukan.peran,
      masukan.daftarBangsalId,
    );

    const salt = `salt-${randomUUID()}`;
    const passwordHash = scryptSync(masukan.kataSandi, salt, 64).toString(
      "hex",
    );
    const sekarangIso = new Date().toISOString();
    const idPengguna = `usr-${randomUUID()}`;

    const entitasBaru: EntitasPengguna = {
      id: idPengguna,
      namaPengguna: masukan.namaPengguna,
      namaLengkap: masukan.namaLengkap,
      passwordHash,
      passwordSalt: salt,
      peran: masukan.peran,
      aktif: masukan.aktif,
      daftarBangsalId: daftarBangsalBersih,
      versi: 1,
      dibuatPada: sekarangIso,
      diperbaruiPada: sekarangIso,
    };

    const tersimpan = await this.repository.buatPenggunaBaru(entitasBaru);
    const definisiPeran = MATRIKS_PERAN_MASTER[tersimpan.peran];

    await this.repository.simpanNotifikasiBaru({
      id: `notif-${randomUUID()}`,
      peristiwaId: `evt-user-created-${tersimpan.id}`,
      penerimaId: tersimpan.id,
      judul: "Akun HPNMS Anda Telah Dibuat",
      ringkasan: `Akun Anda terdaftar dengan peran ${definisiPeran.nama}${
        tersimpan.daftarBangsalId.length > 0
          ? ` pada cakupan ${tersimpan.daftarBangsalId.join(", ")}`
          : ""
      }.`,
      kategori: "informasi",
      prioritas: "normal",
      statusBaca: "belum_dibaca",
      tautanTujuan: ambilRuteUtamaPeran(tersimpan.peran),
      waktuDibuat: sekarangIso,
      waktuDibaca: null,
    });

    await this.catatAudit({
      aktorPenggunaId: aktor.id,
      aktorPeran: aktor.peran,
      tindakan: "ADMIN_CREATE_USER",
      objekTipe: "pengguna",
      objekId: tersimpan.id,
      statusHasil: "berhasil",
      alasan: masukan.alasan,
      correlationId,
      metadata: {
        namaPenggunaBaru: tersimpan.namaPengguna,
        peranDitetapkan: tersimpan.peran,
        aktif: tersimpan.aktif,
        jumlahBangsal: tersimpan.daftarBangsalId.length,
      },
    });

    return this.petakanKeRingkasanAdmin(tersimpan);
  }

  /**
   * Memperbarui data akun pengguna (nama, peran, penugasan bangsal, atau status aktif) oleh Administrator
   * dengan kontrol konkurensi optimistik (`versi`) dan kewajiban alasan perubahan (`AB-030`).
   * Jika akun dinonaktifkan, seluruh sesi aktif pengguna tersebut langsung dicabut secara atomik.
   */
  public async ubahPenggunaOlehAdmin(
    aktor: ProfilSesiPengguna,
    targetId: string,
    masukan: UbahPenggunaAdminDto,
    correlationId: string,
  ): Promise<RingkasanPenggunaAdminDto> {
    await this.verifikasiAksesPeranDanBangsal(
      aktor,
      { izinDibutuhkan: "admin:pengguna:ubah" },
      correlationId,
    );

    if (aktor.id === targetId) {
      if (!masukan.aktif) {
        throw buatGalatKonflik(
          "Administrator tidak dapat menonaktifkan akunnya sendiri yang sedang aktif.",
          KODE_GALAT.KONFLIK_BISNIS,
        );
      }
      if (masukan.peran !== "administrator") {
        throw buatGalatKonflik(
          "Administrator tidak dapat mencabut peran Administrator dari akunnya sendiri yang sedang aktif.",
          KODE_GALAT.KONFLIK_BISNIS,
        );
      }
    }

    const daftarBangsalBersih = this.validasiAturanBangsalPeran(
      masukan.peran,
      masukan.daftarBangsalId,
    );

    const sekarangIso = new Date().toISOString();
    const hasil = await this.repository.perbaruiPenggunaDenganVersi({
      id: targetId,
      namaLengkap: masukan.namaLengkap,
      peran: masukan.peran,
      daftarBangsalId: daftarBangsalBersih,
      aktif: masukan.aktif,
      versiDiharapkan: masukan.versi,
      diperbaruiPada: sekarangIso,
    });

    if (hasil.status === "tidak_ditemukan") {
      throw buatGalatTidakDitemukan("Akun pengguna tidak ditemukan.");
    }

    if (hasil.status === "konflik_versi") {
      throw buatGalatKonflik(
        "Data pengguna telah diubah oleh proses lain. Muat ulang daftar pengguna sebelum menyimpan perubahan.",
        KODE_GALAT.KONFLIK_BISNIS,
      );
    }

    const definisiPeran = MATRIKS_PERAN_MASTER[hasil.pengguna.peran];
    await this.repository.simpanNotifikasiBaru({
      id: `notif-${randomUUID()}`,
      peristiwaId: `evt-user-updated-${hasil.pengguna.id}-v${hasil.pengguna.versi}`,
      penerimaId: hasil.pengguna.id,
      judul: "Hak Akses atau Status Akun Diperbarui",
      ringkasan: `Peran akun: ${definisiPeran.nama} (${
        hasil.pengguna.aktif ? "Aktif" : "Nonaktif"
      }). Alasan: ${masukan.alasanPerubahan}`,
      kategori: "operasional",
      prioritas: hasil.pengguna.aktif ? "normal" : "tinggi",
      statusBaca: "belum_dibaca",
      tautanTujuan: ambilRuteUtamaPeran(hasil.pengguna.peran),
      waktuDibuat: sekarangIso,
      waktuDibaca: null,
    });

    await this.catatAudit({
      aktorPenggunaId: aktor.id,
      aktorPeran: aktor.peran,
      tindakan: "ADMIN_UPDATE_USER",
      objekTipe: "pengguna",
      objekId: hasil.pengguna.id,
      statusHasil: "berhasil",
      alasan: masukan.alasanPerubahan,
      correlationId,
      metadata: {
        peranBaru: hasil.pengguna.peran,
        aktifBaru: hasil.pengguna.aktif,
        versiBaru: hasil.pengguna.versi,
        bangsal: hasil.pengguna.daftarBangsalId.join(","),
      },
    });

    return this.petakanKeRingkasanAdmin(hasil.pengguna);
  }

  /**
   * Mencabut seluruh sesi aktif milik pengguna tertentu oleh Administrator.
   */
  public async cabutSemuaSesiPenggunaOlehAdmin(
    aktor: ProfilSesiPengguna,
    targetId: string,
    alasan: string,
    correlationId: string,
  ): Promise<{ penggunaId: string; jumlahSesiDicabut: number }> {
    await this.verifikasiAksesPeranDanBangsal(
      aktor,
      { izinDibutuhkan: "admin:pengguna:ubah" },
      correlationId,
    );

    const target = await this.repository.cariPenggunaBerdasarkanId(targetId);
    if (!target) {
      throw buatGalatTidakDitemukan("Akun pengguna tidak ditemukan.");
    }

    const jumlahSesiDicabut = await this.repository.cabutSemuaSesiPengguna(
      targetId,
      new Date().toISOString(),
    );

    await this.catatAudit({
      aktorPenggunaId: aktor.id,
      aktorPeran: aktor.peran,
      tindakan: "ADMIN_REVOKE_USER_SESSIONS",
      objekTipe: "sesi_pengguna",
      objekId: targetId,
      statusHasil: "berhasil",
      alasan,
      correlationId,
      metadata: {
        namaPenggunaTarget: target.namaPengguna,
        jumlahSesiDicabut,
      },
    });

    return {
      penggunaId: targetId,
      jumlahSesiDicabut,
    };
  }

  /**
   * Mengambil matriks 10 peran resmi BRD beserta izin default dan aturan batas bangsal untuk Administrator.
   */
  public async ambilMatriksPeranUntukAdmin(
    aktor: ProfilSesiPengguna,
    correlationId: string,
  ): Promise<DefinisiPeranMaster[]> {
    await this.verifikasiAksesPeranDanBangsal(
      aktor,
      { izinDibutuhkan: "admin:pengguna:baca" },
      correlationId,
    );

    return PERAN_PENGGUNA.map((kode) => MATRIKS_PERAN_MASTER[kode]);
  }

  /**
   * Mengambil daftar konfigurasi operasional beserta riwayat perubahannya (`AB-030`) untuk Administrator.
   */
  public async ambilKonfigurasiDanRiwayatUntukAdmin(
    aktor: ProfilSesiPengguna,
    correlationId: string,
  ): Promise<{
    konfigurasi: EntitasKonfigurasiOperasional[];
    riwayat: EntitasRiwayatKonfigurasi[];
  }> {
    await this.verifikasiAksesPeranDanBangsal(
      aktor,
      { izinDibutuhkan: "admin:konfigurasi:baca" },
      correlationId,
    );

    const [konfigurasi, riwayat] = await Promise.all([
      this.repository.ambilKonfigurasiOperasional(),
      this.repository.ambilRiwayatKonfigurasiOperasional(),
    ]);

    return { konfigurasi: konfigurasi.filter((item) => item.kunci !== "sistem.tahap_aktif"), riwayat };
  }

  /**
   * Memperbarui nilai konfigurasi operasional oleh Administrator dengan pemeriksaan versi (`versi`),
   * pencatatan riwayat perubahan (`AB-030`), serta penjagaan invarian keselamatan (`AB-001`, `AB-020`).
   */
  public async ubahKonfigurasiOperasionalOlehAdmin(
    aktor: ProfilSesiPengguna,
    kunci: string,
    masukan: UbahKonfigurasiOperasionalDto,
    correlationId: string,
  ): Promise<{
    konfigurasi: EntitasKonfigurasiOperasional;
    riwayat: EntitasRiwayatKonfigurasi;
  }> {
    await this.verifikasiAksesPeranDanBangsal(
      aktor,
      { izinDibutuhkan: "admin:konfigurasi:ubah" },
      correlationId,
    );

    // Invarian Keselamatan Pasien (AB-001, AB-020): kewajiban verifikasi dua identitas tidak boleh dimatikan.
    if (
      kunci === "keamanan.wajib_verifikasi_dua_identitas" &&
      masukan.nilai.toLowerCase() !== "true"
    ) {
      await this.catatAudit({
        aktorPenggunaId: aktor.id,
        aktorPeran: aktor.peran,
        tindakan: "ADMIN_UPDATE_CONFIG",
        objekTipe: "konfigurasi_operasional",
        objekId: kunci,
        statusHasil: "ditolak",
        alasan:
          "Percobaan menonaktifkan invarian keselamatan verifikasi dua identitas pasien (AB-001, AB-020).",
        correlationId,
        metadata: { nilaiDiminta: masukan.nilai },
      });
      throw buatGalatPenahananKeselamatan(
        "Pengaturan keselamatan verifikasi dua identitas pasien (AB-001, AB-020) wajib tetap bernilai 'true' dan tidak boleh dinonaktifkan.",
      );
    }

    const sekarangIso = new Date().toISOString();
    const hasil =
      await this.repository.perbaruiKonfigurasiOperasionalDenganVersi({
        kunci,
        nilaiBaru: masukan.nilai,
        versiDiharapkan: masukan.versi,
        diubahOleh: aktor.id,
        diubahPada: sekarangIso,
        alasanPerubahan: masukan.alasanPerubahan,
        idRiwayat: `rkonf-${randomUUID()}`,
        correlationId,
      });

    if (hasil.status === "tidak_ditemukan") {
      throw buatGalatTidakDitemukan(
        `Kunci konfigurasi operasional "${kunci}" tidak ditemukan.`,
      );
    }

    if (hasil.status === "konflik_versi") {
      throw buatGalatKonflik(
        "Konfigurasi telah diubah oleh proses lain. Muat ulang halaman sebelum menyimpan perubahan.",
        KODE_GALAT.KONFLIK_BISNIS,
      );
    }

    this.cacheKonfigurasi.invalidasi();

    await this.catatAudit({
      aktorPenggunaId: aktor.id,
      aktorPeran: aktor.peran,
      tindakan: "ADMIN_UPDATE_CONFIG",
      objekTipe: "konfigurasi_operasional",
      objekId: kunci,
      statusHasil: "berhasil",
      alasan: masukan.alasanPerubahan,
      correlationId,
      metadata: {
        nilaiSebelum: hasil.riwayat.nilaiSebelum,
        nilaiSesudah: hasil.riwayat.nilaiSesudah,
        versiSesudah: hasil.riwayat.versiSesudah,
      },
    });

    return {
      konfigurasi: hasil.konfigurasi,
      riwayat: hasil.riwayat,
    };
  }

  /**
   * Mengambil daftar jejak audit akses & perubahan sistem untuk Administrator (`AB-032`, `AB-034`).
   */
  public async ambilDaftarAuditUntukAdmin(
    aktor: ProfilSesiPengguna,
    filter: FilterAuditAdminDto,
    correlationId: string,
  ): Promise<DaftarAuditAdminRespons> {
    await this.verifikasiAksesPeranDanBangsal(
      aktor,
      { izinDibutuhkan: "admin:audit:baca" },
      correlationId,
    );

    return this.repository.ambilDaftarAuditAdmin(filter);
  }

  /**
   * Mengambil konfigurasi operasional umum dengan optimasi cache in-memory terbatas (non-klinis).
   */
  public async ambilKonfigurasiOperasionalUmum(): Promise<
    EntitasKonfigurasiOperasional[]
  > {
    const kunciCache = "konfigurasi_operasional_umum";
    const dariCache = this.cacheKonfigurasi.ambil(kunciCache);
    if (dariCache) {
      return dariCache;
    }
    const dariRepositori = (await this.repository.ambilKonfigurasiOperasional()).filter((item) => item.kunci !== "sistem.tahap_aktif");
    this.cacheKonfigurasi.simpan(kunciCache, dariRepositori);
    return dariRepositori;
  }

  /**
   * Memeriksa kesehatan penyimpanan untuk endpoint `/v1/health`.
   */
  public async cekKesehatan(): Promise<{
    layanan: string;
    status: "sehat" | "terdegradasi";
    penyimpanan: {
      terhubung: boolean;
      jenisPenyimpanan: "mysql" | "in-memory";
      detail: string;
    };
  }> {
    const penyimpanan = await this.repository.cekKesehatanPenyimpanan();
    return {
      layanan: "identity-service",
      status: penyimpanan.terhubung ? "sehat" : "terdegradasi",
      penyimpanan,
    };
  }

  /**
   * Menyimpan catatan audit akses/operasi yang telah disanitasi.
   */
  public async catatAudit(parameter: {
    aktorPenggunaId: string | null;
    aktorPeran: EntitasCatatanAudit["aktorPeran"];
    tindakan: string;
    objekTipe: string;
    objekId: string;
    statusHasil: EntitasCatatanAudit["statusHasil"];
    alasan: string;
    correlationId: string;
    metadata: Record<string, string | number | boolean | null | undefined>;
  }): Promise<void> {
    const catatan: EntitasCatatanAudit = {
      id: `aud-${randomUUID()}`,
      waktuKejadian: new Date().toISOString(),
      aktorPenggunaId: parameter.aktorPenggunaId,
      aktorPeran: parameter.aktorPeran,
      tindakan: parameter.tindakan,
      objekTipe: parameter.objekTipe,
      objekId: parameter.objekId,
      statusHasil: parameter.statusHasil,
      alasan: parameter.alasan,
      correlationId: parameter.correlationId,
      metadataTersanitasi: sanitasiMetadataAudit(parameter.metadata),
    };
    await this.repository.simpanCatatanAudit(catatan);
  }
}
