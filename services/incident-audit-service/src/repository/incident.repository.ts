/**
 * @fileoverview Repositori data untuk `incident-audit-service` (Tahap 10 — Kepala Instalasi Gizi).
 * Menyediakan implementasi InMemory fallback dan MySQL native repository.
 */

import type {
  DerajatKeparahanInsiden,
  StatusInsidenGizi,
} from "../../../../packages/shared-types/src/index.ts";
import {
  SEED_EVALUASI_MUTU,
  SEED_INVESTIGASI_INSIDEN,
  SEED_LAPORAN_INSIDEN,
  SEED_REKONSILIASI_DOWNTIME,
  SEED_TINDAKAN_PERBAIKAN,
} from "../database/seeds/incident.seed.ts";
import type {
  EvaluasiMutuGiziEntitas,
  InvestigasiInsidenEntitas,
  LaporanInsidenKeselamatanEntitas,
  RekonsiliasiDowntimeEntitas,
  TindakanPerbaikanEntitas,
} from "../model/incident.model.ts";

export interface IncidentRepository {
  ambilSemuaInsiden(filter?: {
    status?: StatusInsidenGizi;
    derajat?: DerajatKeparahanInsiden;
  }): Promise<LaporanInsidenKeselamatanEntitas[]>;
  ambilInsidenBerdasarkanId(id: string): Promise<LaporanInsidenKeselamatanEntitas | null>;
  ambilInsidenBerdasarkanNomor(nomor: string): Promise<LaporanInsidenKeselamatanEntitas | null>;
  simpanInsiden(insiden: LaporanInsidenKeselamatanEntitas): Promise<LaporanInsidenKeselamatanEntitas>;
  perbaruiInsiden(
    id: string,
    patch: Partial<LaporanInsidenKeselamatanEntitas>,
  ): Promise<LaporanInsidenKeselamatanEntitas>;
  hitungNomorInsidenBerikutnya(): Promise<string>;

  simpanInvestigasi(inv: InvestigasiInsidenEntitas): Promise<InvestigasiInsidenEntitas>;
  ambilInvestigasiBerdasarkanInsidenId(
    insidenId: string,
  ): Promise<InvestigasiInsidenEntitas | null>;

  simpanTindakanKoreksi(tindakan: TindakanPerbaikanEntitas): Promise<TindakanPerbaikanEntitas>;
  ambilDaftarTindakanBerdasarkanInsidenId(
    insidenId: string,
  ): Promise<TindakanPerbaikanEntitas[]>;
  perbaruiTindakanKoreksi(
    id: string,
    patch: Partial<TindakanPerbaikanEntitas>,
  ): Promise<TindakanPerbaikanEntitas>;

  ambilSemuaEvaluasiMutu(): Promise<EvaluasiMutuGiziEntitas[]>;
  simpanEvaluasiMutu(ev: EvaluasiMutuGiziEntitas): Promise<EvaluasiMutuGiziEntitas>;

  ambilSemuaRekonsiliasiDowntime(): Promise<RekonsiliasiDowntimeEntitas[]>;
  ambilRekonsiliasiBerdasarkanId(
    id: string,
  ): Promise<RekonsiliasiDowntimeEntitas | null>;
  simpanRekonsiliasiDowntime(
    rec: RekonsiliasiDowntimeEntitas,
  ): Promise<RekonsiliasiDowntimeEntitas>;
  perbaruiRekonsiliasiDowntime(
    id: string,
    patch: Partial<RekonsiliasiDowntimeEntitas>,
  ): Promise<RekonsiliasiDowntimeEntitas>;
  hitungNomorRekonsiliasiBerikutnya(): Promise<string>;
}

export class InMemoryIncidentRepository implements IncidentRepository {
  private insidenList: LaporanInsidenKeselamatanEntitas[] = [];
  private investigasiList: InvestigasiInsidenEntitas[] = [];
  private tindakanList: TindakanPerbaikanEntitas[] = [];
  private evaluasiList: EvaluasiMutuGiziEntitas[] = [];
  private rekonsiliasiList: RekonsiliasiDowntimeEntitas[] = [];

  constructor() {
    this.insidenList = structuredClone(SEED_LAPORAN_INSIDEN);
    this.investigasiList = structuredClone(SEED_INVESTIGASI_INSIDEN);
    this.tindakanList = structuredClone(SEED_TINDAKAN_PERBAIKAN);
    this.evaluasiList = structuredClone(SEED_EVALUASI_MUTU);
    this.rekonsiliasiList = structuredClone(SEED_REKONSILIASI_DOWNTIME);
  }

  public async ambilSemuaInsiden(filter?: {
    status?: StatusInsidenGizi;
    derajat?: DerajatKeparahanInsiden;
  }): Promise<LaporanInsidenKeselamatanEntitas[]> {
    let hasil = [...this.insidenList];
    if (filter?.status) {
      hasil = hasil.filter((i) => i.statusInsiden === filter.status);
    }
    if (filter?.derajat) {
      hasil = hasil.filter((i) => i.derajatKeparahan === filter.derajat);
    }
    return hasil.sort(
      (a, b) => new Date(b.tanggalKejadian).getTime() - new Date(a.tanggalKejadian).getTime(),
    );
  }

  public async ambilInsidenBerdasarkanId(
    id: string,
  ): Promise<LaporanInsidenKeselamatanEntitas | null> {
    const item = this.insidenList.find((i) => i.id === id);
    return item ? structuredClone(item) : null;
  }

  public async ambilInsidenBerdasarkanNomor(
    nomor: string,
  ): Promise<LaporanInsidenKeselamatanEntitas | null> {
    const item = this.insidenList.find((i) => i.nomorInsiden === nomor);
    return item ? structuredClone(item) : null;
  }

  public async simpanInsiden(
    insiden: LaporanInsidenKeselamatanEntitas,
  ): Promise<LaporanInsidenKeselamatanEntitas> {
    this.insidenList.push(structuredClone(insiden));
    return structuredClone(insiden);
  }

  public async perbaruiInsiden(
    id: string,
    patch: Partial<LaporanInsidenKeselamatanEntitas>,
  ): Promise<LaporanInsidenKeselamatanEntitas> {
    const index = this.insidenList.findIndex((i) => i.id === id);
    if (index === -1) {
      throw new Error(`Insiden dengan ID ${id} tidak ditemukan.`);
    }
    const sekarang = new Date().toISOString();
    const updated = {
      ...this.insidenList[index]!,
      ...patch,
      updatedAt: sekarang,
    };
    this.insidenList[index] = updated;
    return structuredClone(updated);
  }

  public async hitungNomorInsidenBerikutnya(): Promise<string> {
    const tahunBulan = new Date().toISOString().slice(0, 7).replace("-", "");
    const total = this.insidenList.length + 1;
    return `INC-${tahunBulan}-${String(total).padStart(3, "0")}`;
  }

  public async simpanInvestigasi(
    inv: InvestigasiInsidenEntitas,
  ): Promise<InvestigasiInsidenEntitas> {
    const existingIndex = this.investigasiList.findIndex(
      (i) => i.insidenId === inv.insidenId,
    );
    if (existingIndex >= 0) {
      this.investigasiList[existingIndex] = structuredClone(inv);
    } else {
      this.investigasiList.push(structuredClone(inv));
    }
    return structuredClone(inv);
  }

  public async ambilInvestigasiBerdasarkanInsidenId(
    insidenId: string,
  ): Promise<InvestigasiInsidenEntitas | null> {
    const item = this.investigasiList.find((i) => i.insidenId === insidenId);
    return item ? structuredClone(item) : null;
  }

  public async simpanTindakanKoreksi(
    tindakan: TindakanPerbaikanEntitas,
  ): Promise<TindakanPerbaikanEntitas> {
    this.tindakanList.push(structuredClone(tindakan));
    return structuredClone(tindakan);
  }

  public async ambilDaftarTindakanBerdasarkanInsidenId(
    insidenId: string,
  ): Promise<TindakanPerbaikanEntitas[]> {
    return this.tindakanList
      .filter((t) => t.insidenId === insidenId)
      .map((t) => structuredClone(t));
  }

  public async perbaruiTindakanKoreksi(
    id: string,
    patch: Partial<TindakanPerbaikanEntitas>,
  ): Promise<TindakanPerbaikanEntitas> {
    const index = this.tindakanList.findIndex((t) => t.id === id);
    if (index === -1) {
      throw new Error(`Tindakan koreksi dengan ID ${id} tidak ditemukan.`);
    }
    const updated = {
      ...this.tindakanList[index]!,
      ...patch,
    };
    this.tindakanList[index] = updated;
    return structuredClone(updated);
  }

  public async ambilSemuaEvaluasiMutu(): Promise<EvaluasiMutuGiziEntitas[]> {
    return [...this.evaluasiList].sort(
      (a, b) => new Date(b.tanggalEvaluasi).getTime() - new Date(a.tanggalEvaluasi).getTime(),
    );
  }

  public async simpanEvaluasiMutu(
    ev: EvaluasiMutuGiziEntitas,
  ): Promise<EvaluasiMutuGiziEntitas> {
    this.evaluasiList.push(structuredClone(ev));
    return structuredClone(ev);
  }

  public async ambilSemuaRekonsiliasiDowntime(): Promise<RekonsiliasiDowntimeEntitas[]> {
    return [...this.rekonsiliasiList].sort(
      (a, b) =>
        new Date(b.tanggalInsidenDowntime).getTime() -
        new Date(a.tanggalInsidenDowntime).getTime(),
    );
  }

  public async ambilRekonsiliasiBerdasarkanId(
    id: string,
  ): Promise<RekonsiliasiDowntimeEntitas | null> {
    const item = this.rekonsiliasiList.find((r) => r.id === id);
    return item ? structuredClone(item) : null;
  }

  public async simpanRekonsiliasiDowntime(
    rec: RekonsiliasiDowntimeEntitas,
  ): Promise<RekonsiliasiDowntimeEntitas> {
    this.rekonsiliasiList.push(structuredClone(rec));
    return structuredClone(rec);
  }

  public async perbaruiRekonsiliasiDowntime(
    id: string,
    patch: Partial<RekonsiliasiDowntimeEntitas>,
  ): Promise<RekonsiliasiDowntimeEntitas> {
    const index = this.rekonsiliasiList.findIndex((r) => r.id === id);
    if (index === -1) {
      throw new Error(`Rekonsiliasi dengan ID ${id} tidak ditemukan.`);
    }
    const updated = {
      ...this.rekonsiliasiList[index]!,
      ...patch,
    };
    this.rekonsiliasiList[index] = updated;
    return structuredClone(updated);
  }

  public async hitungNomorRekonsiliasiBerikutnya(): Promise<string> {
    const tahunBulan = new Date().toISOString().slice(0, 7).replace("-", "");
    const total = this.rekonsiliasiList.length + 1;
    return `REC-${tahunBulan}-${String(total).padStart(3, "0")}`;
  }
}

