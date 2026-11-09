/**
 * @fileoverview Workspace antarmuka pengguna untuk Peran Kepala Instalasi Gizi.
 * Mengimplementasikan:
 * 1. Pengawasan Mutu & Metrik Operasional Eksekutif Lintas Unit (BRD Bab XVI).
 * 2. Investigasi Insiden Keselamatan Pasien / RCA (AB-029, AB-030).
 * 3. Penetapan Tindakan Perbaikan dengan Penanggung Jawab & Target Waktu (AB-028).
 * 4. Penutupan Resmi Insiden Secara Sah (Closed-Loop Incident Resolution, AB-029).
 * 5. Evaluasi Pemenuhan Gizi & Pemantauan Sisa Makanan Bangsal / Plate Waste (BRD Bab X, XI).
 * 6. Rekonsiliasi Pelayanan Darurat Pasca-Downtime Sistem (AB-033).
 */

"use client";

import Link from "next/link";
import { Dialog } from "radix-ui";
import React, { useEffect, useRef, useState } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  Check,
  CheckCircle2,
  FileQuestion,
  Flame,
  History,
  LineChart,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  UtensilsCrossed,
  X,
} from "lucide-react";
import {
  LoadingState,
  MinimalToastBanner,
  PermissionDeniedState,
  SafetyHoldBanner,
} from "@/components/molecules/state-feedback";
import { AppShellTemplate } from "@/components/templates/app-shell-template";
import { Button } from "@/components/ui/button";
import { useSesiAdmin } from "@/features/admin/hooks/use-sesi-admin";
import type {
  ItemEvaluasiMutuGiziDto,
  ItemInvestigasiInsidenDto,
  ItemLaporanInsidenKeselamatanDto,
  ItemRekonsiliasiDowntimeDto,
  ItemTindakanKoreksiDto,
  RingkasanOversightOverviewDto,
  ResponsApi,
} from "../../../../packages/shared-types/src/index.ts";

export function HeadNutritionWorkspace() {
  const {
    profil,
    navigasi,
    sedangMemuatSesi,
    keluarSesi,
    notifikasiItems,
    jumlahBelumDibaca,
    sedangMemuatNotifikasi,
    tandaiSatuNotifikasiDibaca,
    tandaiSemuaNotifikasiDibaca,
  } = useSesiAdmin();

  // State Data
  const [overview, setOverview] = useState<RingkasanOversightOverviewDto | null>(null);
  const [daftarInsiden, setDaftarInsiden] = useState<ItemLaporanInsidenKeselamatanDto[]>([]);
  const [daftarEvaluasi, setDaftarEvaluasi] = useState<ItemEvaluasiMutuGiziDto[]>([]);
  const [daftarRekonsiliasi, setDaftarRekonsiliasi] = useState<ItemRekonsiliasiDowntimeDto[]>([]);
  const [memuatData, setMemuatData] = useState<boolean>(true);
  const [pesanSukses, setPesanSukses] = useState<string | null>(null);
  const [pesanGalat, setPesanGalat] = useState<string | null>(null);

  // Tab Operasional
  const [tabAktif, setTabAktif] = useState<"insiden" | "evaluasi" | "downtime">("insiden");

  // Filter Insiden
  const [filterStatusInsiden, setFilterStatusInsiden] = useState<string>("semua");
  const [filterDerajatInsiden, setFilterDerajatInsiden] = useState<string>("semua");

  // Modal Investigasi RCA
  const [modalInvestigasiBuka, setModalInvestigasiBuka] = useState<boolean>(false);
  const [insidenTerpilih, setInsidenTerpilih] = useState<ItemLaporanInsidenKeselamatanDto | null>(null);
  const [akarMasalahInput, setAkarMasalahInput] = useState<string>("");
  const [faktorKontributorInput, setFaktorKontributorInput] = useState<string>("");
  const [rekomendasiInput, setRekomendasiInput] = useState<string>("");
  const [sedangSimpanInvestigasi, setSedangSimpanInvestigasi] = useState<boolean>(false);

  // Modal Tindakan Koreksi
  const [modalTindakanBuka, setModalTindakanBuka] = useState<boolean>(false);
  const [deskripsiTindakanInput, setDeskripsiTindakanInput] = useState<string>("");
  const [pjNamaInput, setPjNamaInput] = useState<string>("");
  const [pjIdInput, setPjIdInput] = useState<string>("");
  const [targetTanggalInput, setTargetTanggalInput] = useState<string>("");
  const [sedangSimpanTindakan, setSedangSimpanTindakan] = useState<boolean>(false);

  // Modal Penutupan Insiden
  const [modalTutupInsidenBuka, setModalTutupInsidenBuka] = useState<boolean>(false);
  const [catatanPenutupanInput, setCatatanPenutupanInput] = useState<string>("");
  const fokusSebelumPenutupan = useRef<HTMLElement | null>(null);
  const [tindakanPenutupan, setTindakanPenutupan] = useState<ItemTindakanKoreksiDto[]>([]);
  const [buktiTindakan, setBuktiTindakan] = useState<Record<string, string>>({});
  const [memuatTindakan, setMemuatTindakan] = useState(false);
  const [galatTindakan, setGalatTindakan] = useState<string | null>(null);
  const [verifikasiAktif, setVerifikasiAktif] = useState<string | null>(null);
  const [sedangTutupInsiden, setSedangTutupInsiden] = useState<boolean>(false);

  // Modal Evaluasi Mutu
  const [modalEvaluasiBuka, setModalEvaluasiBuka] = useState<boolean>(false);
  const [evalTanggalInput, setEvalTanggalInput] = useState<string>("");
  const [evalBangsalIdInput, setEvalBangsalIdInput] = useState<string>("");
  const [evalBangsalNamaInput, setEvalBangsalNamaInput] = useState<string>("");
  const [evalTotalPorsiInput, setEvalTotalPorsiInput] = useState<number | "">("");
  const [evalSisaMakananInput, setEvalSisaMakananInput] = useState<number | "">("");
  const [evalCcpInput, setEvalCcpInput] = useState<number | "">("");
  const [evalDuaIdentitasInput, setEvalDuaIdentitasInput] = useState<number | "">("");
  const [evalCatatanInput, setEvalCatatanInput] = useState<string>("");
  const [sedangSimpanEvaluasi, setSedangSimpanEvaluasi] = useState<boolean>(false);

  // Modal Pengajuan Downtime
  const [modalDowntimeBuka, setModalDowntimeBuka] = useState<boolean>(false);
  const [downTanggalInput, setDownTanggalInput] = useState<string>("");
  const [downDurasiInput, setDownDurasiInput] = useState<number | "">("");
  const [downUnitInput, setDownUnitInput] = useState<string>("");
  const [downFormulirInput, setDownFormulirInput] = useState<number | "">("");
  const [downDuplikasiInput, setDownDuplikasiInput] = useState<number | "">("");
  const [downCatatanInput, setDownCatatanInput] = useState<string>("");
  const [sedangSimpanDowntime, setSedangSimpanDowntime] = useState<boolean>(false);

  const muatSemuaData = async () => {
    setMemuatData(true);
    setPesanGalat(null);
    try {
      const [resOverview, resInsiden, resEvaluasi, resDowntime] = await Promise.all([
        fetch("/api/v1/incidents/overview"),
        fetch("/api/v1/incidents/reports"),
        fetch("/api/v1/incidents/quality-evaluations"),
        fetch("/api/v1/incidents/downtime-reconciliations"),
      ]);

      if (resOverview.ok) {
        const json = (await resOverview.json()) as ResponsApi<RingkasanOversightOverviewDto>;
        if (json.sukses) setOverview(json.data);
      }

      if (resInsiden.ok) {
        const json = (await resInsiden.json()) as ResponsApi<ItemLaporanInsidenKeselamatanDto[]>;
        if (json.sukses) setDaftarInsiden(json.data);
      }

      if (resEvaluasi.ok) {
        const json = (await resEvaluasi.json()) as ResponsApi<ItemEvaluasiMutuGiziDto[]>;
        if (json.sukses) setDaftarEvaluasi(json.data);
      }

      if (resDowntime.ok) {
        const json = (await resDowntime.json()) as ResponsApi<ItemRekonsiliasiDowntimeDto[]>;
        if (json.sukses) setDaftarRekonsiliasi(json.data);
      }
    } catch (err) {
      setPesanGalat(err instanceof Error ? err.message : "Gagal memuat data pengawasan gizi.");
    } finally {
      setMemuatData(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void muatSemuaData();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Handler: Investigasi RCA
  const bukaModalInvestigasi = (insiden: ItemLaporanInsidenKeselamatanDto) => {
    setInsidenTerpilih(insiden);
    setAkarMasalahInput("");
    setFaktorKontributorInput("");
    setRekomendasiInput("");
    setModalInvestigasiBuka(true);
  };

  const tanganiSimpanInvestigasi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!insidenTerpilih) return;
    if (akarMasalahInput.length < 5 || faktorKontributorInput.length < 5 || rekomendasiInput.length < 5) {
      setPesanGalat("Analisis akar masalah (RCA), faktor kontributor, dan rekomendasi wajib minimal 5 karakter (AB-030).");
      return;
    }
    setSedangSimpanInvestigasi(true);
    setPesanGalat(null);
    try {
      const res = await fetch(`/api/v1/incidents/reports/${insidenTerpilih.id}/investigate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          akarMasalahRca: akarMasalahInput,
          faktorKontributor: faktorKontributorInput,
          rekomendasiSistemik: rekomendasiInput,
        }),
      });
      const json = (await res.json()) as ResponsApi<ItemInvestigasiInsidenDto>;
      if (!res.ok || !json.sukses) {
        throw new Error((!json.sukses ? json.galat.pesan : undefined) ?? "Gagal menyimpan investigasi.");
      }
      setPesanSukses(`Investigasi RCA untuk insiden ${insidenTerpilih.nomorInsiden} berhasil dicatat.`);
      setModalInvestigasiBuka(false);
      await muatSemuaData();
    } catch (err) {
      setPesanGalat(err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan investigasi.");
    } finally {
      setSedangSimpanInvestigasi(false);
    }
  };

  // Handler: Tindakan Perbaikan
  const bukaModalTindakan = (insiden: ItemLaporanInsidenKeselamatanDto) => {
    setInsidenTerpilih(insiden);
    setDeskripsiTindakanInput("");
    setPjNamaInput(profil?.namaLengkap ?? "");
    setPjIdInput(profil?.id ?? "");
    setModalTindakanBuka(true);
  };

  const tanganiSimpanTindakan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!insidenTerpilih) return;
    if (deskripsiTindakanInput.length < 5) {
      setPesanGalat("Deskripsi rencana tindakan wajib diisi minimal 5 karakter (AB-030).");
      return;
    }
    setSedangSimpanTindakan(true);
    setPesanGalat(null);
    try {
      const res = await fetch(`/api/v1/incidents/reports/${insidenTerpilih.id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deskripsiTindakan: deskripsiTindakanInput,
          penanggungJawabId: pjIdInput,
          penanggungJawabNama: pjNamaInput,
          targetTanggalSelesai: targetTanggalInput,
        }),
      });
      const json = (await res.json()) as ResponsApi<ItemTindakanKoreksiDto>;
      if (!res.ok || !json.sukses) {
        throw new Error((!json.sukses ? json.galat.pesan : undefined) ?? "Gagal menyimpan tindakan koreksi.");
      }
      setPesanSukses(`Tindakan perbaikan insiden ${insidenTerpilih.nomorInsiden} berhasil ditetapkan ke ${pjNamaInput} (AB-028).`);
      setModalTindakanBuka(false);
      await muatSemuaData();
    } catch (err) {
      setPesanGalat(err instanceof Error ? err.message : "Terjadi kesalahan saat menetapkan tindakan.");
    } finally {
      setSedangSimpanTindakan(false);
    }
  };

  // Handler: Penutupan Insiden Sah (Closed Loop)
  const bukaModalTutupInsiden = async (insiden: ItemLaporanInsidenKeselamatanDto) => {
    fokusSebelumPenutupan.current = document.activeElement as HTMLElement;
    setInsidenTerpilih(insiden);
    setCatatanPenutupanInput("");
    setTindakanPenutupan([]); setBuktiTindakan({}); setGalatTindakan(null); setMemuatTindakan(true);
    setModalTutupInsidenBuka(true);
    try {
      const res = await fetch(`/api/v1/incidents/reports/${insiden.id}`, { cache: "no-store" });
      const json = await res.json() as ResponsApi<{ daftarTindakan: ItemTindakanKoreksiDto[] }>;
      if (!json.sukses) throw new Error(json.galat.pesan);
      setTindakanPenutupan(json.data.daftarTindakan);
    } catch (error) { setGalatTindakan(error instanceof Error ? error.message : "Gagal memuat tindakan koreksi."); }
    finally { setMemuatTindakan(false); }
  };
  const verifikasiTindakan = async (id: string) => {
    if (!insidenTerpilih) return;
    setVerifikasiAktif(id); setGalatTindakan(null);
    try {
      const res = await fetch(`/api/v1/incidents/reports/${insidenTerpilih.id}/actions/${id}/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ buktiPenyelesaian: buktiTindakan[id] ?? "" }) });
      const json = await res.json() as ResponsApi<ItemTindakanKoreksiDto>;
      if (!json.sukses) throw new Error(json.galat.pesan);
      setTindakanPenutupan((items) => items.map((item) => item.id === id ? json.data : item));
    } catch (error) { setGalatTindakan(error instanceof Error ? error.message : "Verifikasi gagal."); }
    finally { setVerifikasiAktif(null); }
  };

  const tanganiTutupInsiden = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!insidenTerpilih) return;
    if (catatanPenutupanInput.length < 5) {
      setPesanGalat("Catatan penutupan dan verifikasi wajib diisi minimal 5 karakter (AB-030).");
      return;
    }
    setSedangTutupInsiden(true);
    setPesanGalat(null);
    try {
      const res = await fetch(`/api/v1/incidents/reports/${insidenTerpilih.id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          catatanPenutupan: catatanPenutupanInput,
        }),
      });
      const json = (await res.json()) as ResponsApi<ItemLaporanInsidenKeselamatanDto>;
      if (!res.ok || !json.sukses) {
        throw new Error((!json.sukses ? json.galat.pesan : undefined) ?? "Gagal menutup insiden.");
      }
      setPesanSukses(`Insiden ${insidenTerpilih.nomorInsiden} resmi ditutup secara sah (Closed Loop, AB-029).`);
      setModalTutupInsidenBuka(false);
      await muatSemuaData();
    } catch (err) {
      setPesanGalat(err instanceof Error ? err.message : "Terjadi kesalahan saat menutup insiden.");
    } finally {
      setSedangTutupInsiden(false);
    }
  };

  // Handler: Tambah Evaluasi Mutu
  const tanganiSimpanEvaluasi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (evalCatatanInput.length < 5) {
      setPesanGalat("Catatan evaluasi mutu wajib diisi minimal 5 karakter (AB-030).");
      return;
    }
    setSedangSimpanEvaluasi(true);
    setPesanGalat(null);
    try {
      const res = await fetch("/api/v1/incidents/quality-evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tanggalEvaluasi: evalTanggalInput,
          bangsalId: evalBangsalIdInput,
          namaBangsal: evalBangsalNamaInput,
          totalPorsiDisajikan: Number(evalTotalPorsiInput),
          rataRataSisaMakananPersen: Number(evalSisaMakananInput),
          kepatuhanCcpSuhuPersen: Number(evalCcpInput),
          kepatuhanDuaIdentitasPersen: Number(evalDuaIdentitasInput),
          catatanEvaluasi: evalCatatanInput,
        }),
      });
      const json = (await res.json()) as ResponsApi<ItemEvaluasiMutuGiziDto>;
      if (!res.ok || !json.sukses) {
        throw new Error((!json.sukses ? json.galat.pesan : undefined) ?? "Gagal mencatat evaluasi mutu.");
      }
      setPesanSukses(`Evaluasi mutu ${json.data.namaBangsal} berhasil dicatat.`);
      setModalEvaluasiBuka(false);
      await muatSemuaData();
    } catch (err) {
      setPesanGalat(err instanceof Error ? err.message : "Terjadi kesalahan saat mencatat evaluasi.");
    } finally {
      setSedangSimpanEvaluasi(false);
    }
  };

  // Handler: Ajukan Rekonsiliasi Downtime
  const tanganiSimpanDowntime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (downCatatanInput.length < 5) {
      setPesanGalat("Catatan rekonsiliasi wajib diisi minimal 5 karakter (AB-030).");
      return;
    }
    setSedangSimpanDowntime(true);
    setPesanGalat(null);
    try {
      const res = await fetch("/api/v1/incidents/downtime-reconciliations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tanggalInsidenDowntime: downTanggalInput,
          durasiDowntimeMenit: Number(downDurasiInput),
          unitTerdampak: downUnitInput,
          jumlahFormulirKertas: Number(downFormulirInput),
          duplikasiTerdeteksi: Number(downDuplikasiInput),
          selisihPesananSelesai: true,
          catatanRekonsiliasi: downCatatanInput,
        }),
      });
      const json = (await res.json()) as ResponsApi<ItemRekonsiliasiDowntimeDto>;
      if (!res.ok || !json.sukses) {
        throw new Error((!json.sukses ? json.galat.pesan : undefined) ?? "Gagal mengajukan rekonsiliasi.");
      }
      setPesanSukses(`Pengajuan rekonsiliasi ${json.data.nomorRekonsiliasi} berhasil dicatat.`);
      setModalDowntimeBuka(false);
      await muatSemuaData();
    } catch (err) {
      setPesanGalat(err instanceof Error ? err.message : "Terjadi kesalahan saat mengajukan rekonsiliasi.");
    } finally {
      setSedangSimpanDowntime(false);
    }
  };

  // Handler: Sahkan Rekonsiliasi Downtime
  const tanganiSahkanDowntime = async (id: string) => {
    setPesanGalat(null);
    try {
      const res = await fetch(`/api/v1/incidents/downtime-reconciliations/${id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keputusan: "disahkan",
          catatan: "Formulir kertas telah diperiksa dan bebas duplikasi pesanan. Rekonsiliasi disahkan resmi (AB-033).",
        }),
      });
      const json = (await res.json()) as ResponsApi<ItemRekonsiliasiDowntimeDto>;
      if (!res.ok || !json.sukses) {
        throw new Error((!json.sukses ? json.galat.pesan : undefined) ?? "Gagal mengesahkan rekonsiliasi.");
      }
      setPesanSukses(`Rekonsiliasi ${json.data.nomorRekonsiliasi} berhasil disahkan.`);
      await muatSemuaData();
    } catch (err) {
      setPesanGalat(err instanceof Error ? err.message : "Terjadi kesalahan saat mengesahkan rekonsiliasi.");
    }
  };

  // Filter List Insiden
  const insidenTerfilter = daftarInsiden.filter((i) => {
    if (filterStatusInsiden !== "semua" && i.statusInsiden !== filterStatusInsiden) {
      return false;
    }
    if (filterDerajatInsiden !== "semua" && i.derajatKeparahan !== filterDerajatInsiden) {
      return false;
    }
    return true;
  });

  if (sedangMemuatSesi) {
    return (
      <LoadingState
        judul="Memuat Ruang Kerja Kepala Instalasi Gizi..."
        deskripsi="Memverifikasi hak akses dan memuat modul pengawasan mutu & insiden."
      />
    );
  }

  if (
    !profil ||
    (profil.peran !== "kepala_instalasi_gizi" &&
      profil.peran !== "administrator" &&
      !profil.daftarIzin.includes("kepala_instalasi:pengawasan:baca"))
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white p-6 rounded-lg shadow-sm border border-slate-200 text-center space-y-4">
          <PermissionDeniedState
            pesan="Akses Terbatas: Khusus Kepala Instalasi Gizi."
            detailKonteks="Sesuai Aturan Keselamatan AB-032, pengawasan operasional lintas unit, investigasi akar masalah insiden (RCA), penetapan tindakan koreksi, dan rekonsiliasi downtime memerlukan wewenang Kepala Instalasi Gizi."
          />
          <div className="pt-2">
            <Link
              href="/portal"
              className="inline-flex items-center justify-center w-full h-9 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-md transition-colors"
            >
              Kembali ke Portal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppShellTemplate
      judulDiKonten
      judulHalaman="Pengawasan Mutu & Insiden Keselamatan Pasien Gizi"
      subjudulHalaman="Pengawasan operasional lintas unit, analisis akar masalah (RCA) insiden keselamatan pasien (AB-029), penetapan tindakan tertutup (AB-028), evaluasi sisa makanan / plate waste (BRD Bab X & XI), dan rekonsiliasi downtime (AB-033)."
      profil={profil}
      navigasi={navigasi}
      notifikasiItems={notifikasiItems}
      jumlahBelumDibaca={jumlahBelumDibaca}
      sedangMemuatNotifikasi={sedangMemuatNotifikasi}
      onTandaiSatuNotifikasiDibaca={tandaiSatuNotifikasiDibaca}
      onTandaiSemuaNotifikasiDibaca={tandaiSemuaNotifikasiDibaca}
      onPilihMenuTerkunci={() => {}}
      onKeluarSesi={keluarSesi}
    >
      <div className="space-y-6">
        {/* HEADER & SERVICE BADGE */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                Pengawasan instalasi gizi
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                incident-audit-service:4007
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight mt-1 flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-primary" />
              Ruang Kerja Kepala Instalasi Gizi
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tata kelola mutu gizi klinis, penanganan insiden keselamatan pasien (closed loop), evaluasi sisa makanan bangsal, dan audit kepatuhan.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={muatSemuaData}
              disabled={memuatData}
              className="flex items-center gap-1.5 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${memuatData ? "animate-spin" : ""}`} />
              Segarkan Data
            </Button>
            <Link href="/portal">
              <Button variant="ghost" size="sm" className="text-xs">
                Portal Peran
              </Button>
            </Link>
          </div>
        </div>

        {/* FEEDBACK TOAST */}
        {pesanGalat && (
          <MinimalToastBanner
            pesan={pesanGalat}
            jenis="kesalahan"
            onTutup={() => setPesanGalat(null)}
          />
        )}
        {pesanSukses && (
          <MinimalToastBanner
            pesan={pesanSukses}
            jenis="berhasil"
            onTutup={() => setPesanSukses(null)}
          />
        )}

        {/* PERMANENT SAFETY HOLD / QUALITY BANNER */}
        <SafetyHoldBanner
          judul="Aturan Bisnis Keselamatan Pasien Gizi (AB-028, AB-029, AB-030 & AB-033)"
          alasanPenahanan="Insiden keselamatan pasien (salah diet, alergi, suhu CCP kritis) wajib ditangani dengan siklus tertutup (Closed Loop): investigasi RCA, rencana perbaikan dengan penanggung jawab yang jelas, verifikasi efektivitas, dan penutupan resmi."
          tindakLanjutWajib="Dilarang menutup insiden tanpa analisis akar masalah dan tindakan korektif terdaftar. Setiap rekonsiliasi pasca-downtime wajib diverifikasi bebas duplikasi pesanan."
        />

        {/* 5 METRIC CARDS OVERSIGHT */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="border rounded-xl p-3.5 bg-card shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-medium">Insiden Aktif</span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold tracking-tight text-amber-600">
              {overview?.totalInsidenAktif ?? 0}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Perlu Penanganan</p>
          </div>

          <div className="border rounded-xl p-3.5 bg-card shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-medium">Insiden Kritis/Tinggi</span>
              <AlertOctagon className="w-4 h-4 text-red-500" />
            </div>
            <p className="text-2xl font-bold tracking-tight text-red-600">
              {overview?.totalInsidenKritis ?? 0}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Prioritas Utama RCA</p>
          </div>

          <div className="border rounded-xl p-3.5 bg-card shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-medium">Rata-rata Plate Waste</span>
              <UtensilsCrossed className="w-4 h-4 text-indigo-500" />
            </div>
            <p className="text-2xl font-bold tracking-tight">
              {overview?.rataRataPlateWasteBangsalPersen ?? 0}%
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Target SPM &le; 20%</p>
          </div>

          <div className="border rounded-xl p-3.5 bg-card shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-medium">Kepatuhan CCP Suhu</span>
              <Flame className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold tracking-tight text-emerald-600">
              {overview?.kepatuhanCcpPusatPersen ?? 0}%
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Suhu Masak &ge; 75 &deg;C</p>
          </div>

          <div className="border rounded-xl p-3.5 bg-card shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-medium">Rekonsiliasi Pending</span>
              <FileQuestion className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold tracking-tight text-blue-600">
              {overview?.totalRekonsiliasiDowntimePending ?? 0}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Downtime Form Darurat</p>
          </div>
        </div>

        {/* TAB NAVIGASI OPERASIONAL */}
        <div className="border-b flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTabAktif("insiden")}
              className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                tabAktif === "insiden"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              Insiden Keselamatan Pasien ({daftarInsiden.length})
            </button>
            <button
              type="button"
              onClick={() => setTabAktif("evaluasi")}
              className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                tabAktif === "evaluasi"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <LineChart className="w-4 h-4" />
              Evaluasi Mutu & Sisa Makanan ({daftarEvaluasi.length})
            </button>
            <button
              type="button"
              onClick={() => setTabAktif("downtime")}
              className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                tabAktif === "downtime"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <History className="w-4 h-4" />
              Rekonsiliasi Downtime ({daftarRekonsiliasi.length})
            </button>
          </div>

          <div className="pb-2">
            {tabAktif === "evaluasi" && (
              <Button
                size="sm"
                onClick={() => setModalEvaluasiBuka(true)}
                className="flex items-center gap-1.5 text-xs h-8"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Evaluasi Bangsal
              </Button>
            )}
            {tabAktif === "downtime" && (
              <Button
                size="sm"
                onClick={() => setModalDowntimeBuka(true)}
                className="flex items-center gap-1.5 text-xs h-8"
              >
                <Plus className="w-3.5 h-3.5" />
                Catat Kejadian Downtime
              </Button>
            )}
          </div>
        </div>

        {/* TAB 1: LAPORAN INSIDEN KESELAMATAN (CLOSED LOOP) */}
        {tabAktif === "insiden" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 p-3 rounded-lg border">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Filter Status:</span>
                <select
                  value={filterStatusInsiden}
                  onChange={(e) => setFilterStatusInsiden(e.target.value)}
                  className="text-xs border rounded-md px-2 py-1 bg-background"
                >
                  <option value="semua">Semua Status</option>
                  <option value="dilaporkan">Dilaporkan</option>
                  <option value="dalam_investigasi">Dalam Investigasi</option>
                  <option value="tindakan_koreksi">Tindakan Koreksi</option>
                  <option value="terverifikasi">Terverifikasi</option>
                  <option value="selesai_ditutup">Selesai Ditutup</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Derajat Keparahan:</span>
                <select
                  value={filterDerajatInsiden}
                  onChange={(e) => setFilterDerajatInsiden(e.target.value)}
                  className="text-xs border rounded-md px-2 py-1 bg-background"
                >
                  <option value="semua">Semua Derajat</option>
                  <option value="kritis">Kritis (Sentinel)</option>
                  <option value="tinggi">Tinggi</option>
                  <option value="sedang">Sedang</option>
                  <option value="rendah">Rendah</option>
                </select>
              </div>
            </div>

            {insidenTerfilter.length === 0 ? (
              <div className="text-center py-12 border rounded-xl bg-card text-muted-foreground text-xs">
                Tidak ada laporan insiden yang cocok dengan filter.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {insidenTerfilter.map((insiden) => (
                  <div
                    key={insiden.id}
                    className="border rounded-xl p-4 bg-card shadow-sm space-y-3 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-primary">
                              {insiden.nomorInsiden}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                                insiden.derajatKeparahan === "kritis"
                                  ? "bg-red-100 text-red-800 border border-red-300"
                                  : insiden.derajatKeparahan === "tinggi"
                                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                                  : insiden.derajatKeparahan === "sedang"
                                  ? "bg-yellow-100 text-yellow-800 border border-yellow-300"
                                  : "bg-blue-100 text-blue-800 border border-blue-300"
                              }`}
                            >
                              {insiden.derajatKeparahan}
                            </span>
                          </div>
                          <h4 className="text-sm font-semibold mt-1">
                            {insiden.jenisInsiden}
                          </h4>
                        </div>

                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                            insiden.statusInsiden === "selesai_ditutup"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : insiden.statusInsiden === "tindakan_koreksi"
                              ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                              : insiden.statusInsiden === "dalam_investigasi"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-slate-100 text-slate-700 border-slate-300"
                          }`}
                        >
                          {insiden.statusInsiden.replace("_", " ").toUpperCase()}
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                        {insiden.deskripsiKejadian}
                      </p>

                      <div className="mt-3 pt-3 border-t text-[11px] space-y-1 text-muted-foreground">
                        <div className="flex justify-between">
                          <span>Unit Pelapor:</span>
                          <span className="font-semibold text-foreground uppercase">
                            {insiden.unitPelapor} ({insiden.pelaporNama})
                          </span>
                        </div>
                        {insiden.namaBangsal && (
                          <div className="flex justify-between">
                            <span>Lokasi Kejadian:</span>
                            <span className="font-medium text-foreground">{insiden.namaBangsal}</span>
                          </div>
                        )}
                        {insiden.pasienTerdampakNama && (
                          <div className="flex justify-between">
                            <span>Pasien Terdampak:</span>
                            <span className="font-medium text-foreground">
                              {insiden.pasienTerdampakNama} ({insiden.nomorRmPasien})
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Waktu Kejadian:</span>
                          <span>{new Date(insiden.tanggalKejadian).toLocaleString("id-ID")}</span>
                        </div>
                        {insiden.penanggungJawabNama && (
                          <div className="flex justify-between text-indigo-700 font-medium pt-1">
                            <span>PJ Tindakan:</span>
                            <span>{insiden.penanggungJawabNama}</span>
                          </div>
                        )}
                        {insiden.catatanPenutupan && (
                          <div className="bg-emerald-50 border border-emerald-200 rounded p-2 text-emerald-900 mt-2">
                            <span className="font-bold block text-[10px] uppercase tracking-wide">
                              Verifikasi Penutupan Sah (AB-029):
                            </span>
                            {insiden.catatanPenutupan}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* AKSI KEPALA INSTALASI */}
                    <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t mt-3">
                      {insiden.statusInsiden !== "selesai_ditutup" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => bukaModalInvestigasi(insiden)}
                            className="text-xs h-8 flex items-center gap-1"
                          >
                            <Search className="w-3.5 h-3.5" />
                            Investigasi RCA
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => bukaModalTindakan(insiden)}
                            className="text-xs h-8 flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Tetapkan Tindakan
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => bukaModalTutupInsiden(insiden)}
                            className="text-xs h-8 bg-emerald-700 hover:bg-emerald-800 text-white flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Tutup Resmi (Sah)
                          </Button>
                        </>
                      )}
                      {insiden.statusInsiden === "selesai_ditutup" && (
                        <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" />
                          Insiden Terverifikasi &amp; Ditutup Sah
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: EVALUASI MUTU & SISA MAKANAN (PLATE WASTE) */}
        {tabAktif === "evaluasi" && (
          <div className="space-y-4">
            <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b text-muted-foreground uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Tanggal Evaluasi</th>
                    <th className="p-3">Bangsal Rawat Inap</th>
                    <th className="p-3 text-center">Porsi Saji</th>
                    <th className="p-3 text-center">Rata-rata Sisa (Plate Waste)</th>
                    <th className="p-3 text-center">Kepatuhan Suhu CCP</th>
                    <th className="p-3 text-center">Kepatuhan 2 Pengenal</th>
                    <th className="p-3">Kategori Mutu</th>
                    <th className="p-3">Catatan &amp; Evaluator</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {daftarEvaluasi.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/20">
                      <td className="p-3 font-mono font-medium">{item.tanggalEvaluasi}</td>
                      <td className="p-3 font-semibold text-foreground">{item.namaBangsal}</td>
                      <td className="p-3 text-center font-mono">{item.totalPorsiDisajikan}</td>
                      <td className="p-3 text-center">
                        <span
                          className={`font-mono font-bold ${
                            item.rataRataSisaMakananPersen > 20
                              ? "text-red-600"
                              : "text-emerald-600"
                          }`}
                        >
                          {item.rataRataSisaMakananPersen}%
                        </span>
                        <span className="block text-[10px] text-muted-foreground">
                          {item.rataRataSisaMakananPersen > 20 ? "Melebihi SPM" : "Standar SPM Kemenkes"}
                        </span>
                      </td>
                      <td className="p-3 text-center font-mono font-medium text-emerald-600">
                        {item.kepatuhanCcpSuhuPersen}%
                      </td>
                      <td className="p-3 text-center font-mono font-medium text-emerald-600">
                        {item.kepatuhanDuaIdentitasPersen}%
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            item.kategoriMutu === "sangat_baik"
                              ? "bg-emerald-100 text-emerald-800"
                              : item.kategoriMutu === "standar"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {item.kategoriMutu.replace("_", " ")}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground max-w-xs">
                        <p className="line-clamp-2">{item.catatanEvaluasi}</p>
                        <span className="block text-[10px] font-medium text-foreground mt-0.5">
                          Evaluator: {item.evaluatorNama}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: REKONSILIASI PELAYANAN DOWNTIME (AB-033) */}
        {tabAktif === "downtime" && (
          <div className="space-y-4">
            <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b text-muted-foreground uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Nomor Rekonsiliasi</th>
                    <th className="p-3">Tanggal &amp; Durasi</th>
                    <th className="p-3">Unit Terdampak</th>
                    <th className="p-3 text-center">Form Kertas</th>
                    <th className="p-3 text-center">Duplikasi Terdeteksi</th>
                    <th className="p-3">Status Pengesahan</th>
                    <th className="p-3">Catatan Audit</th>
                    <th className="p-3 text-right">Aksi Kepala Instalasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {daftarRekonsiliasi.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/20">
                      <td className="p-3 font-mono font-bold text-primary">{item.nomorRekonsiliasi}</td>
                      <td className="p-3">
                        <span className="font-medium block">{item.tanggalInsidenDowntime}</span>
                        <span className="text-[10px] text-muted-foreground">{item.durasiDowntimeMenit} Menit</span>
                      </td>
                      <td className="p-3 font-medium text-foreground">{item.unitTerdampak}</td>
                      <td className="p-3 text-center font-mono font-bold">{item.jumlahFormulirKertas}</td>
                      <td className="p-3 text-center font-mono">
                        <span className={item.duplikasiTerdeteksi > 0 ? "text-red-600 font-bold" : "text-emerald-600 font-medium"}>
                          {item.duplikasiTerdeteksi}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            item.statusRekonsiliasi === "disahkan"
                              ? "bg-emerald-100 text-emerald-800"
                              : item.statusRekonsiliasi === "menunggu_pengesahan"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {item.statusRekonsiliasi.replace("_", " ")}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground max-w-xs">
                        <p className="line-clamp-2">{item.catatanRekonsiliasi}</p>
                        {item.disahkanOlehNama && (
                          <span className="block text-[10px] text-emerald-700 font-semibold mt-0.5">
                            Disahkan: {item.disahkanOlehNama}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {item.statusRekonsiliasi === "menunggu_pengesahan" && (
                          <Button
                            size="sm"
                            onClick={() => tanganiSahkanDowntime(item.id)}
                            className="text-xs h-7 bg-emerald-700 hover:bg-emerald-800 text-white"
                          >
                            Sahkan Rekonsiliasi (AB-033)
                          </Button>
                        )}
                        {item.statusRekonsiliasi === "disahkan" && (
                          <span className="text-[11px] font-semibold text-emerald-600 flex items-center justify-end gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Disahkan
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODAL 1: INVESTIGASI RCA */}
        {modalInvestigasiBuka && insidenTerpilih && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-background border rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Search className="w-5 h-5 text-primary" />
                  Investigasi Akar Masalah RCA: {insidenTerpilih.nomorInsiden}
                </h3>
                <button
                  type="button"
                  onClick={() => setModalInvestigasiBuka(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={tanganiSimpanInvestigasi} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold block">Akar Masalah (Root Cause Analysis - RCA) *</label>
                  <textarea
                    rows={3}
                    value={akarMasalahInput}
                    onChange={(e) => setAkarMasalahInput(e.target.value)}
                    placeholder="Jelaskan akar penyebab utama terjadinya insiden gizi (min. 5 karakter)..."
                    className="w-full border rounded-md p-2 bg-background"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold block">Faktor Kontributor Lingkungan / Sistem *</label>
                  <textarea
                    rows={2}
                    value={faktorKontributorInput}
                    onChange={(e) => setFaktorKontributorInput(e.target.value)}
                    placeholder="Jelaskan faktor pendukung (peralatan, komunikasi, keterlambatan informasi)..."
                    className="w-full border rounded-md p-2 bg-background"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold block">Rekomendasi Pencegahan Sistemik *</label>
                  <textarea
                    rows={2}
                    value={rekomendasiInput}
                    onChange={(e) => setRekomendasiInput(e.target.value)}
                    placeholder="Rekomendasi pencegahan agar kejadian serupa tidak terulang..."
                    className="w-full border rounded-md p-2 bg-background"
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setModalInvestigasiBuka(false)}
                    disabled={sedangSimpanInvestigasi}
                  >
                    Batal
                  </Button>
                  <Button type="submit" disabled={sedangSimpanInvestigasi}>
                    {sedangSimpanInvestigasi ? "Menyimpan..." : "Simpan Hasil Investigasi"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: TETAPKAN TINDAKAN PERBAIKAN */}
        {modalTindakanBuka && insidenTerpilih && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-background border rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Check className="w-5 h-5 text-primary" />
                  Rencana Tindakan Korektif (AB-028)
                </h3>
                <button
                  type="button"
                  onClick={() => setModalTindakanBuka(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={tanganiSimpanTindakan} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold block">Deskripsi Tindakan Perbaikan *</label>
                  <textarea
                    rows={3}
                    value={deskripsiTindakanInput}
                    onChange={(e) => setDeskripsiTindakanInput(e.target.value)}
                    placeholder="Jelaskan tindakan korektif konkret yang wajib dijalankan (min. 5 karakter)..."
                    className="w-full border rounded-md p-2 bg-background"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold block">Penanggung Jawab (PJ) *</label>
                    <input value={pjNamaInput} readOnly aria-label="Penanggung jawab tindakan" className="w-full border rounded-md p-2 bg-slate-50" required />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold block">Target Selesai *</label>
                    <input
                      type="date"
                      value={targetTanggalInput}
                      onChange={(e) => setTargetTanggalInput(e.target.value)}
                      className="w-full border rounded-md p-2 bg-background"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setModalTindakanBuka(false)}
                    disabled={sedangSimpanTindakan}
                  >
                    Batal
                  </Button>
                  <Button type="submit" disabled={sedangSimpanTindakan}>
                    {sedangSimpanTindakan ? "Menyimpan..." : "Tetapkan Tindakan"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 3: PENUTUPAN RESMI INSIDEN (CLOSED LOOP) */}
        {modalTutupInsidenBuka && insidenTerpilih && (
          <Dialog.Root open={modalTutupInsidenBuka} onOpenChange={setModalTutupInsidenBuka}>
            <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
            <Dialog.Content onCloseAutoFocus={(event) => { event.preventDefault(); fokusSebelumPenutupan.current?.focus(); }} className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 max-h-[90vh] overflow-y-auto rounded-xl border bg-background p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <Dialog.Title className="text-base font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Penutupan Sah Insiden: {insidenTerpilih.nomorInsiden}
                </Dialog.Title>
                <button
                  type="button"
                  onClick={() => setModalTutupInsidenBuka(false)}
                  aria-label="Tutup dialog penutupan insiden"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <Dialog.Description className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900 text-xs">
                <span className="font-bold block mb-1">Syarat Closed-Loop (AB-029):</span>
                Penutupan resmi menegaskan bahwa akar masalah telah diinvestigasi dan seluruh rencana tindakan perbaikan telah dievaluasi efektivitasnya.
              </Dialog.Description>

                            <section aria-label="Verifikasi tindakan koreksi" className="space-y-3 text-xs">
                <h4 className="font-semibold">Penyelesaian tindakan koreksi</h4>
                {memuatTindakan ? <p>Memuat tindakan...</p> : !tindakanPenutupan.length ? <p>Tetapkan rencana tindakan sebelum penutupan.</p> : null}
                {galatTindakan ? <p role="alert" className="text-red-700">{galatTindakan}</p> : null}
                {tindakanPenutupan.map((item) => <div key={item.id} className="space-y-2 rounded-lg border p-3">
                  <p className="font-medium">{item.deskripsiTindakan}</p>
                  <p>Penanggung jawab: {item.penanggungJawabNama}</p>
                  {item.statusTindakan === "selesai_efektif" ? <p className="whitespace-pre-wrap text-emerald-700">Selesai terverifikasi: {item.buktiPenyelesaian}</p> : <>
                    <label htmlFor={`bukti-${item.id}`} className="block font-medium">Bukti pelaksanaan dan efektivitas</label>
                    <textarea id={`bukti-${item.id}`} className="w-full rounded-md border p-2" minLength={10} maxLength={5000} value={buktiTindakan[item.id] ?? ""} onChange={(event) => setBuktiTindakan((values) => ({ ...values, [item.id]: event.target.value }))} />
                    <Button type="button" disabled={verifikasiAktif !== null || (buktiTindakan[item.id]?.trim().length ?? 0) < 10} onClick={() => void verifikasiTindakan(item.id)}>{verifikasiAktif === item.id ? "Memverifikasi..." : "Verifikasi Selesai"}</Button>
                  </>}
                </div>)}
              </section>

              <form onSubmit={tanganiTutupInsiden} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label htmlFor="catatan-penutupan" className="font-semibold block">Catatan Verifikasi &amp; Hasil Evaluasi Akhir *</label>
                  <textarea
                    id="catatan-penutupan"
                    rows={4}
                    value={catatanPenutupanInput}
                    onChange={(e) => setCatatanPenutupanInput(e.target.value)}
                    placeholder="Catat hasil verifikasi penyelesaian dan konfirmasi bahwa risiko telah terkendali aman (min. 5 karakter)..."
                    className="w-full border rounded-md p-2 bg-background"
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setModalTutupInsidenBuka(false)}
                    disabled={sedangTutupInsiden}
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    className="bg-emerald-700 hover:bg-emerald-800 text-white"
                    disabled={sedangTutupInsiden || memuatTindakan || !!galatTindakan || !tindakanPenutupan.length || tindakanPenutupan.some((item) => item.statusTindakan !== "selesai_efektif")}
                  >
                    {sedangTutupInsiden ? "Menutup Insiden..." : "Tutup Insiden Secara Sah"}
                  </Button>
                </div>
              </form>
            </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        )}

        {/* MODAL 4: EVALUASI MUTU BANGSAL */}
        {modalEvaluasiBuka && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-background border rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <LineChart className="w-5 h-5 text-primary" />
                  Rekam Evaluasi Mutu Bangsal (Plate Waste)
                </h3>
                <button
                  type="button"
                  onClick={() => setModalEvaluasiBuka(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={tanganiSimpanEvaluasi} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold block">Tanggal Evaluasi</label>
                    <input
                      type="date"
                      value={evalTanggalInput}
                      onChange={(e) => setEvalTanggalInput(e.target.value)}
                      className="w-full border rounded-md p-2 bg-background"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold block">Bangsal</label>
                    <input value={evalBangsalIdInput} onChange={(e) => setEvalBangsalIdInput(e.target.value)} placeholder="ID bangsal dari master" className="w-full border rounded-md p-2 bg-background" required />
                    <label className="font-semibold block">Nama Bangsal</label>
                    <input value={evalBangsalNamaInput} onChange={(e) => setEvalBangsalNamaInput(e.target.value)} className="w-full border rounded-md p-2 bg-background" required />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold block">Total Porsi Saji</label>
                    <input
                      type="number"
                      value={evalTotalPorsiInput}
                      onChange={(e) => setEvalTotalPorsiInput(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full border rounded-md p-2 bg-background"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold block">Sisa Makanan (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={evalSisaMakananInput}
                      onChange={(e) => setEvalSisaMakananInput(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full border rounded-md p-2 bg-background"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold block">Kepatuhan CCP (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={evalCcpInput}
                      onChange={(e) => setEvalCcpInput(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full border rounded-md p-2 bg-background"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold block">Kepatuhan 2 Pengenal Bedside (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={evalDuaIdentitasInput}
                    onChange={(e) => setEvalDuaIdentitasInput(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full border rounded-md p-2 bg-background"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold block">Catatan &amp; Analisis Mutu *</label>
                  <textarea
                    rows={3}
                    value={evalCatatanInput}
                    onChange={(e) => setEvalCatatanInput(e.target.value)}
                    placeholder="Analisis penyebab sisa makanan bangsal atau kepatuhan prosedur (min. 5 karakter)..."
                    className="w-full border rounded-md p-2 bg-background"
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setModalEvaluasiBuka(false)}
                    disabled={sedangSimpanEvaluasi}
                  >
                    Batal
                  </Button>
                  <Button type="submit" disabled={sedangSimpanEvaluasi}>
                    {sedangSimpanEvaluasi ? "Menyimpan..." : "Simpan Evaluasi"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 5: PENGAJUAN DOWNTIME */}
        {modalDowntimeBuka && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-background border rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <History className="w-5 h-5 text-primary" />
                  Pencatatan Kejadian Downtime (AB-033)
                </h3>
                <button
                  type="button"
                  onClick={() => setModalDowntimeBuka(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={tanganiSimpanDowntime} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold block">Tanggal Kejadian</label>
                    <input
                      type="date"
                      value={downTanggalInput}
                      onChange={(e) => setDownTanggalInput(e.target.value)}
                      className="w-full border rounded-md p-2 bg-background"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold block">Durasi (Menit)</label>
                    <input
                      type="number"
                      value={downDurasiInput}
                      onChange={(e) => setDownDurasiInput(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full border rounded-md p-2 bg-background"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold block">Unit Terdampak</label>
                  <input
                    type="text"
                    value={downUnitInput}
                    onChange={(e) => setDownUnitInput(e.target.value)}
                    className="w-full border rounded-md p-2 bg-background"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold block">Jumlah Form Kertas Terpakai</label>
                    <input
                      type="number"
                      value={downFormulirInput}
                      onChange={(e) => setDownFormulirInput(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full border rounded-md p-2 bg-background"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold block">Duplikasi Terdeteksi</label>
                    <input
                      type="number"
                      value={downDuplikasiInput}
                      onChange={(e) => setDownDuplikasiInput(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full border rounded-md p-2 bg-background"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold block">Catatan Rekonsiliasi &amp; Penanganan *</label>
                  <textarea
                    rows={3}
                    value={downCatatanInput}
                    onChange={(e) => setDownCatatanInput(e.target.value)}
                    placeholder="Jelaskan penanganan formulir kertas darurat dan konfirmasi data (min. 5 karakter)..."
                    className="w-full border rounded-md p-2 bg-background"
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setModalDowntimeBuka(false)}
                    disabled={sedangSimpanDowntime}
                  >
                    Batal
                  </Button>
                  <Button type="submit" disabled={sedangSimpanDowntime}>
                    {sedangSimpanDowntime ? "Menyimpan..." : "Simpan Pengajuan"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShellTemplate>
  );
}
