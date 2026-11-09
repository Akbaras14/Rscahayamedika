/**
 * @fileoverview Utilitas Outbox Peristiwa Integrasi dan Cache In-Memory Terbatas (Tanpa Redis).
 * Acuan: TECHSTACK.md Bagian 1, 8.4, & 9; AGENTS.md Bagian 5.
 *
 * PERINGATAN KESELAMATAN (TECHSTACK.md Bagian 8.4):
 * - Cache in-memory ini HANYA boleh digunakan untuk metadata referensi non-sensitif (misal konfigurasi umum).
 * - DILARANG meng-cache instruksi diet aktif, alergi, status tahan pesanan, otorisasi pasien, atau stok layak.
 */

import type { AmplopPeristiwaIntegrasi } from "../../../../packages/shared-types/src/index.ts";

interface EntriCache<T> {
  nilai: T;
  kedaluwarsaPadaMs: number;
}

/**
 * Cache in-memory LRU/TTL sederhana dengan batas kapasitas maksimum (tanpa Redis).
 */
export class CacheMemoriTerbatas<T> {
  private readonly penyimpanan = new Map<string, EntriCache<T>>();
  private readonly kapasitasMaks: number;
  private readonly ttlDefaultMs: number;

  /**
   * @param kapasitasMaks - Jumlah entri maksimum yang boleh disimpan di memori proses.
   * @param ttlDefaultMs - Masa berlaku entri dalam milidetik.
   */
  constructor(kapasitasMaks = 100, ttlDefaultMs = 30_000) {
    if (kapasitasMaks < 1 || ttlDefaultMs < 100) {
      throw new Error("Kapasitas dan TTL cache memori harus bernilai positif.");
    }
    this.kapasitasMaks = kapasitasMaks;
    this.ttlDefaultMs = ttlDefaultMs;
  }

  /**
   * Mengambil nilai dari cache jika belum kedaluwarsa.
   */
  public ambil(kunci: string, waktuSekarangMs = Date.now()): T | undefined {
    const entri = this.penyimpanan.get(kunci);
    if (!entri) {
      return undefined;
    }
    if (waktuSekarangMs >= entri.kedaluwarsaPadaMs) {
      this.penyimpanan.delete(kunci);
      return undefined;
    }
    return entri.nilai;
  }

  /**
   * Menyimpan nilai ke dalam cache dengan menerapkan batas kapasitas (eviksi entri tertua).
   */
  public simpan(
    kunci: string,
    nilai: T,
    ttlMs = this.ttlDefaultMs,
    waktuSekarangMs = Date.now(),
  ): void {
    if (
      !this.penyimpanan.has(kunci) &&
      this.penyimpanan.size >= this.kapasitasMaks
    ) {
      const kunciPertama = this.penyimpanan.keys().next().value;
      if (typeof kunciPertama === "string") {
        this.penyimpanan.delete(kunciPertama);
      }
    }
    this.penyimpanan.set(kunci, {
      nilai,
      kedaluwarsaPadaMs: waktuSekarangMs + ttlMs,
    });
  }

  /**
   * Menghapus entri tertentu atau seluruh isi cache saat terjadi perubahan konfigurasi.
   */
  public invalidasi(kunci?: string): void {
    if (kunci) {
      this.penyimpanan.delete(kunci);
      return;
    }
    this.penyimpanan.clear();
  }
}

/**
 * Membangun amplop peristiwa integrasi standar yang siap disimpan ke tabel `outbox_peristiwa`.
 *
 * @param parameter - Data pembentuk peristiwa integrasi.
 * @returns Amplop peristiwa sesuai kontrak TECHSTACK.md Bagian 9.
 */
export function bangunAmplopPeristiwaOutbox<
  TPayload extends Record<string, unknown>,
>(parameter: {
  eventId: string;
  eventType: string;
  aggregateId: string;
  correlationId: string;
  payload: TPayload;
  schemaVersion?: number;
  occurredAt?: string;
}): AmplopPeristiwaIntegrasi<TPayload> {
  return {
    eventId: parameter.eventId,
    eventType: parameter.eventType,
    schemaVersion: parameter.schemaVersion ?? 1,
    aggregateId: parameter.aggregateId,
    occurredAt: parameter.occurredAt ?? new Date().toISOString(),
    correlationId: parameter.correlationId,
    payload: parameter.payload,
  };
}

