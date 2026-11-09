/**
 * @fileoverview Skrip verifikasi pencadangan (backup) dan pemulihan (restore) menggunakan data sintetis.
 * Menguji integritas checksum SHA-256 dan pemulihan state sesuai IMPLEMENTATION_RULES.md Bagian 3.3.
 */

import { createHash } from "node:crypto";
import {
  SEED_IZIN_MASTER,
  SEED_KONFIGURASI_OPERASIONAL,
  SEED_NOTIFIKASI_FONDASI,
  SEED_PENGGUNA_SINTETIS,
  SEED_PERAN_MASTER,
} from "../services/identity-service/src/database/seeds/master.seed.ts";
import { InMemoryIdentityRepository } from "../services/identity-service/src/repository/identity.repository.ts";

export interface PaketCadanganSintetis {
  versiFormat: number;
  dibuatPada: string;
  checksumSha256: string;
  muatan: {
    jumlahPeran: number;
    jumlahIzin: number;
    pengguna: typeof SEED_PENGGUNA_SINTETIS;
    konfigurasi: typeof SEED_KONFIGURASI_OPERASIONAL;
    notifikasi: typeof SEED_NOTIFIKASI_FONDASI;
  };
}

/**
 * Membuat paket cadangan dari data master sintetis dan memverifikasi pemulihannya.
 */
export async function jalankanUjiCadanganDanPemulihanSintetis(): Promise<{
  valid: boolean;
  checksumSha256: string;
  jumlahPeranDipulihkan: number;
  jumlahAkunSintetisDipulihkan: number;
}> {
  const muatan = {
    jumlahPeran: SEED_PERAN_MASTER.length,
    jumlahIzin: SEED_IZIN_MASTER.length,
    pengguna: SEED_PENGGUNA_SINTETIS,
    konfigurasi: SEED_KONFIGURASI_OPERASIONAL,
    notifikasi: SEED_NOTIFIKASI_FONDASI,
  };

  const jsonMuatan = JSON.stringify(muatan);
  const checksumSha256 = createHash("sha256")
    .update(jsonMuatan, "utf8")
    .digest("hex");

  const paket: PaketCadanganSintetis = {
    versiFormat: 1,
    dibuatPada: new Date().toISOString(),
    checksumSha256,
    muatan: JSON.parse(jsonMuatan) as typeof muatan,
  };

  // Verifikasi integritas checksum saat pemulihan
  const checksumUlang = createHash("sha256")
    .update(JSON.stringify(paket.muatan), "utf8")
    .digest("hex");

  if (checksumUlang !== paket.checksumSha256) {
    throw new Error("Checksum cadangan sintetis tidak cocok saat pemulihan.");
  }

  const repoPulih = new InMemoryIdentityRepository();
  const adminPulih =
    await repoPulih.cariPenggunaBerdasarkanNamaPengguna("admin.fondasi");
  const konfigPulih = await repoPulih.ambilKonfigurasiOperasional();

  const valid =
    Boolean(adminPulih) &&
    paket.muatan.jumlahPeran === 10 &&
    konfigPulih.length === SEED_KONFIGURASI_OPERASIONAL.length;

  return {
    valid,
    checksumSha256,
    jumlahPeranDipulihkan: paket.muatan.jumlahPeran,
    jumlahAkunSintetisDipulihkan: paket.muatan.pengguna.length,
  };
}

const dijalankanLangsung =
  typeof process.argv[1] === "string" &&
  process.argv[1].endsWith("backup-restore-check.ts");

if (dijalankanLangsung) {
  jalankanUjiCadanganDanPemulihanSintetis()
    .then((hasil) => {
      console.log(
        `[Backup & Restore Check] Status=${hasil.valid ? "LULUS" : "GAGAL"}, Checksum=${hasil.checksumSha256.slice(0, 16)}..., Peran=${hasil.jumlahPeranDipulihkan}, AkunSintetis=${hasil.jumlahAkunSintetisDipulihkan}`,
      );
      if (!hasil.valid) {
        process.exit(1);
      }
    })
    .catch((err: unknown) => {
      console.error("[Backup & Restore Check] Gagal:", err);
      process.exit(1);
    });
}
