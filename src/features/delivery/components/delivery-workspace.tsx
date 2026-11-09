/**
 * @fileoverview Workspace antarmuka pengguna untuk Peran Petugas Distribusi.
 * Mengimplementasikan:
 * 1. Manajemen Troli Pengantaran Bangsal & Status Rute (Persiapan -> Berangkat -> Kembali).
 * 2. Verifikasi Sedikitnya Dua Identitas Pasien Sebelum Serah (AB-020: Nama + Tgl Lahir/RM).
 * 3. Pemeriksaan Kesesuaian Instruksi Diet Terkini (AB-021: Tolak serah jika diet berubah/NPO).
 * 4. Perekaman Serah Terima Makanan Bedside (AB-023: Diserahkan bukan berarti dikonsumsi).
 * 5. Penahanan Distribusi Makanan Klinis (AB-022, AB-030).
 * 6. Pencatatan Laporan Insiden Distribusi Makanan (AB-030).
 */

"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  DoorOpen,
  FileWarning,
  Navigation,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Truck,
  UserCheck,
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
  HubunganPenerimaMakanan,
  ItemLaporanInsidenDto,
  ItemPorsiDistribusiDto,
  ItemTroliDistribusiDto,
  JenisInsidenDistribusi,
  MetodeVerifikasiIdentitas,
  RingkasanDistribusiOverviewDto,
  SesiMakanDapur,
  ResponsApi,
} from "../../../../packages/shared-types/src/index.ts";

type TabDistribusi = "troli" | "porsi" | "tahan" | "insiden";

export function DeliveryWorkspace() {
  const {
    profil,
    navigasi,
    sedangMemuatSesi,
    notifikasiItems,
    jumlahBelumDibaca,
    sedangMemuatNotifikasi,
    tandaiSatuNotifikasiDibaca,
    tandaiSemuaNotifikasiDibaca,
    keluarSesi,
  } = useSesiAdmin();

  const [tabAktif, setTabAktif] = useState<TabDistribusi>("troli");
  const [memuatData, setMemuatData] = useState(false);
  const [pesanGalat, setPesanGalat] = useState<string | null>(null);
  const [pesanSukses, setPesanSukses] = useState<string | null>(null);

  // Data states
  const [overview, setOverview] = useState<RingkasanDistribusiOverviewDto | null>(null);
  const [daftarTroli, setDaftarTroli] = useState<ItemTroliDistribusiDto[]>([]);
  const [daftarPorsi, setDaftarPorsi] = useState<ItemPorsiDistribusiDto[]>([]);
  const [daftarInsiden, setDaftarInsiden] = useState<ItemLaporanInsidenDto[]>([]);

  // Filter states
  const [filterBangsal, setFilterBangsal] = useState<string>("SEMUA");
  const [filterSesi, setFilterSesi] = useState<string>("SEMUA");
  const [filterStatusTroli, setFilterStatusTroli] = useState<string>("SEMUA");
  const [filterStatusSerah, setFilterStatusSerah] = useState<string>("SEMUA");

  // Modal 1: Buat Troli Baru
  const [modalTroliBuka, setModalTroliBuka] = useState(false);
  const [bangsalTroliInput, setBangsalTroliInput] = useState("");
  const [namaBangsalTroliInput, setNamaBangsalTroliInput] = useState("");
  const [sesiTroliInput, setSesiTroliInput] = useState<SesiMakanDapur>("siang");
  const [tanggalTroliInput, setTanggalTroliInput] = useState("");
  const [catatanTroliInput, setCatatanTroliInput] = useState("");
  const [sedangSimpanTroli, setSedangSimpanTroli] = useState(false);

  // Modal 2: Verifikasi Dua Identitas & Serah Makanan (AB-020, AB-021, AB-023)
  const [modalSerahBuka, setModalSerahBuka] = useState(false);
  const [porsiSerahTerpilih, setPorsiSerahTerpilih] = useState<ItemPorsiDistribusiDto | null>(null);
  const [namaVerifInput, setNamaVerifInput] = useState("");
  const [tglLahirVerifInput, setTglLahirVerifInput] = useState("");
  const [rmVerifInput, setRmVerifInput] = useState("");
  const [metodeVerifInput, setMetodeVerifInput] = useState<MetodeVerifikasiIdentitas>("gelang_pasien");
  const [namaPenerimaInput, setNamaPenerimaInput] = useState("");
  const [hubunganPenerimaInput, setHubunganPenerimaInput] = useState<HubunganPenerimaMakanan>("pasien_sendiri");
  const [catatanVerifInput, setCatatanVerifInput] = useState("");
  const [sedangSimpanSerah, setSedangSimpanSerah] = useState(false);

  // Modal 3: Tahan Porsi Saat Pengantaran (AB-022, AB-030)
  const [modalTahanBuka, setModalTahanBuka] = useState(false);
  const [porsiTahanTerpilih, setPorsiTahanTerpilih] = useState<ItemPorsiDistribusiDto | null>(null);
  const [alasanTahanInput, setAlasanTahanInput] = useState("");
  const [sedangSimpanTahan, setSedangSimpanTahan] = useState(false);

  // Modal 4: Lapor Insiden Pengantaran (AB-030)
  const [modalInsidenBuka, setModalInsidenBuka] = useState(false);
  const [bangsalInsidenInput, setBangsalInsidenInput] = useState("");
  const [namaBangsalInsidenInput, setNamaBangsalInsidenInput] = useState("");
  const [jenisInsidenInput, setJenisInsidenInput] = useState<JenisInsidenDistribusi>("makanan_tumpah_rusak");
  const [deskripsiInsidenInput, setDeskripsiInsidenInput] = useState("");
  const [tindakanInsidenInput, setTindakanInsidenInput] = useState("");
  const [sedangSimpanInsiden, setSedangSimpanInsiden] = useState(false);

  const muatSemuaData = async () => {
    setMemuatData(true);
    setPesanGalat(null);
    try {
      const [resOverview, resTroli, resPorsi, resInsiden] = await Promise.all([
        fetch("/api/v1/delivery-intake/overview"),
        fetch("/api/v1/delivery-intake/trolleys"),
        fetch("/api/v1/delivery-intake/items"),
        fetch("/api/v1/delivery-intake/incidents"),
      ]);

      if (resOverview.ok) {
        const json = (await resOverview.json()) as ResponsApi<RingkasanDistribusiOverviewDto>;
        if (json.sukses) setOverview(json.data);
      }
      if (resTroli.ok) {
        const json = (await resTroli.json()) as ResponsApi<{ items: ItemTroliDistribusiDto[] }>;
        if (json.sukses) setDaftarTroli(json.data.items);
      }
      if (resPorsi.ok) {
        const json = (await resPorsi.json()) as ResponsApi<{ items: ItemPorsiDistribusiDto[] }>;
        if (json.sukses) setDaftarPorsi(json.data.items);
      }
      if (resInsiden.ok) {
        const json = (await resInsiden.json()) as ResponsApi<{ items: ItemLaporanInsidenDto[] }>;
        if (json.sukses) setDaftarInsiden(json.data.items);
      }
    } catch (err) {
      setPesanGalat(err instanceof Error ? err.message : "Gagal memuat data distribusi makanan.");
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

  // Handler: Buat Troli Baru
  const tanganiBuatTroli = async (e: React.FormEvent) => {
    e.preventDefault();
    setSedangSimpanTroli(true);
    setPesanGalat(null);
    setPesanSukses(null);
    try {
      const payload = {
        bangsalId: bangsalTroliInput,
        namaBangsal: namaBangsalTroliInput,
        sesiMakan: sesiTroliInput,
        tanggalDistribusi: tanggalTroliInput,
        porsiIds: [],
        catatan: catatanTroliInput || "Troli pengantaran reguler",
      };
      const res = await fetch("/api/v1/delivery-intake/trolleys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as ResponsApi<ItemTroliDistribusiDto>;
      if (!res.ok || !json.sukses) {
        throw new Error((!json.sukses ? json.galat.pesan : undefined) ?? "Gagal membuat troli pengantaran.");
      }
      setPesanSukses(`Troli ${json.data.nomorTroli} berhasil dibuat dengan status persiapan.`);
      setModalTroliBuka(false);
      setCatatanTroliInput("");
      await muatSemuaData();
    } catch (err) {
      setPesanGalat(err instanceof Error ? err.message : "Terjadi kesalahan saat membuat troli.");
    } finally {
      setSedangSimpanTroli(false);
    }
  };

  // Handler: Berangkatkan Troli
  const tanganiBerangkatkanTroli = async (troliId: string) => {
    setMemuatData(true);
    setPesanGalat(null);
    setPesanSukses(null);
    try {
      const res = await fetch(`/api/v1/delivery-intake/trolleys/${troliId}/depart`, {
        method: "POST",
      });
      const json = (await res.json()) as ResponsApi<ItemTroliDistribusiDto>;
      if (!res.ok || !json.sukses) {
        throw new Error((!json.sukses ? json.galat.pesan : undefined) ?? "Gagal memberangkatkan troli.");
      }
      setPesanSukses(`Troli ${json.data.nomorTroli} resmi diberangkatkan ke ${json.data.namaBangsal}.`);
      await muatSemuaData();
    } catch (err) {
      setPesanGalat(err instanceof Error ? err.message : "Terjadi kesalahan saat memberangkatkan troli.");
    } finally {
      setMemuatData(false);
    }
  };

  // Handler: Selesaikan Troli (Kembali)
  const tanganiKembalikanTroli = async (troliId: string) => {
    setMemuatData(true);
    setPesanGalat(null);
    setPesanSukses(null);
    try {
      const res = await fetch(`/api/v1/delivery-intake/trolleys/${troliId}/return`, {
        method: "POST",
      });
      const json = (await res.json()) as ResponsApi<ItemTroliDistribusiDto>;
      if (!res.ok || !json.sukses) {
        throw new Error((!json.sukses ? json.galat.pesan : undefined) ?? "Gagal mengembalikan troli.");
      }
      setPesanSukses(`Troli ${json.data.nomorTroli} telah kembali ke dapur gizi dan rute selesai.`);
      await muatSemuaData();
    } catch (err) {
      setPesanGalat(err instanceof Error ? err.message : "Terjadi kesalahan saat mengembalikan troli.");
    } finally {
      setMemuatData(false);
    }
  };

  // Handler: Verifikasi 2 Identitas & Serah Makanan (AB-020, AB-021, AB-023)
  const tanganiVerifikasiDanSerah = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!porsiSerahTerpilih) return;
    setSedangSimpanSerah(true);
    setPesanGalat(null);
    setPesanSukses(null);
    try {
      const payload = {
        namaPasienVerifikasi: namaVerifInput,
        tanggalLahirVerifikasi: tglLahirVerifInput,
        nomorRmVerifikasi: rmVerifInput || undefined,
        metodeVerifikasi: metodeVerifInput,
        namaPenerima: namaPenerimaInput,
        hubunganPenerima: hubunganPenerimaInput,
        catatanVerifikasi: catatanVerifInput,
      };
      const res = await fetch(`/api/v1/delivery-intake/items/${porsiSerahTerpilih.id}/verify-and-handover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as ResponsApi<ItemPorsiDistribusiDto>;
      if (!res.ok || !json.sukses) {
        throw new Error((!json.sukses ? json.galat.pesan : undefined) ?? "Gagal verifikasi atau penyerahan makanan.");
      }
      setPesanSukses(`Makanan untuk ${json.data.namaPasien} (${json.data.kamarBed}) berhasil diserahkan kepada ${json.data.namaPenerima}.`);
      setModalSerahBuka(false);
      setPorsiSerahTerpilih(null);
      await muatSemuaData();
    } catch (err) {
      setPesanGalat(err instanceof Error ? err.message : "Terjadi kesalahan saat serah makanan.");
    } finally {
      setSedangSimpanSerah(false);
    }
  };

  // Handler: Tahan Porsi Saat Pengantaran (AB-022, AB-030)
  const tanganiTahanPorsi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!porsiTahanTerpilih) return;
    if (alasanTahanInput.length < 5) {
      setPesanGalat("Alasan penahanan porsi makanan wajib minimal 5 karakter (AB-030).");
      return;
    }
    setSedangSimpanTahan(true);
    setPesanGalat(null);
    setPesanSukses(null);
    try {
      const payload = { alasanPenahanan: alasanTahanInput };
      const res = await fetch(`/api/v1/delivery-intake/items/${porsiTahanTerpilih.id}/hold`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as ResponsApi<ItemPorsiDistribusiDto>;
      if (!res.ok || !json.sukses) {
        throw new Error((!json.sukses ? json.galat.pesan : undefined) ?? "Gagal menahan porsi makanan.");
      }
      setPesanSukses(`Porsi ${json.data.nomorLabel} (${json.data.namaPasien}) berhasil ditahan di troli.`);
      setModalTahanBuka(false);
      setPorsiTahanTerpilih(null);
      await muatSemuaData();
    } catch (err) {
      setPesanGalat(err instanceof Error ? err.message : "Terjadi kesalahan saat menahan porsi.");
    } finally {
      setSedangSimpanTahan(false);
    }
  };

  // Handler: Buat Laporan Insiden (AB-030)
  const tanganiBuatInsiden = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deskripsiInsidenInput.length < 5 || tindakanInsidenInput.length < 5) {
      setPesanGalat("Deskripsi dan tindakan koreksi insiden wajib minimal 5 karakter (AB-030).");
      return;
    }
    setSedangSimpanInsiden(true);
    setPesanGalat(null);
    setPesanSukses(null);
    try {
      const payload = {
        bangsalId: bangsalInsidenInput,
        namaBangsal: namaBangsalInsidenInput,
        jenisInsiden: jenisInsidenInput,
        deskripsiInsiden: deskripsiInsidenInput,
        tindakanKoreksi: tindakanInsidenInput,
      };
      const res = await fetch("/api/v1/delivery-intake/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as ResponsApi<ItemLaporanInsidenDto>;
      if (!res.ok || !json.sukses) {
        throw new Error((!json.sukses ? json.galat.pesan : undefined) ?? "Gagal melaporkan insiden.");
      }
      setPesanSukses(`Insiden ${json.data.nomorInsiden} berhasil dilaporkan.`);
      setModalInsidenBuka(false);
      await muatSemuaData();
    } catch (err) {
      setPesanGalat(err instanceof Error ? err.message : "Terjadi kesalahan saat membuat laporan insiden.");
    } finally {
      setSedangSimpanInsiden(false);
    }
  };

  if (sedangMemuatSesi) {
    return (
      <LoadingState
        judul="Memuat Ruang Kerja Petugas Distribusi..."
        deskripsi="Memverifikasi hak akses dan memuat modul distribusi makanan bangsal."
      />
    );
  }

  if (
    !profil ||
    (profil.peran !== "petugas_distribusi" &&
      profil.peran !== "administrator" &&
      !profil.daftarIzin.includes("distribusi:penyerahan:verifikasi"))
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white p-6 rounded-lg shadow-sm border border-slate-200 text-center space-y-4">
          <PermissionDeniedState
            pesan="Akses Terbatas: Khusus Petugas Distribusi."
            detailKonteks="Sesuai Aturan Keselamatan AB-032, serah terima troli, verifikasi dua identitas pasien (AB-020), dan pencatatan penyerahan porsi memerlukan wewenang Petugas Distribusi."
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
      judulHalaman="Distribusi Makanan & Handover Bangsal"
      subjudulHalaman="Pengelompokan troli bangsal, verifikasi dua identitas pasien (AB-020), pemeriksaan diet terkini (AB-021), penyerahan bedside (AB-023), penahanan klinis, dan laporan insiden."
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
        {/* HEADER & SAFETY BANNER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                Distribusi aktif
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                <Truck className="w-3.5 h-3.5 text-primary" />
                delivery-intake-service:4006
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight mt-1 flex items-center gap-2">
              <Truck className="w-6 h-6 text-primary" />
              Ruang Kerja Petugas Distribusi & Handover Bangsal
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pengelompokan troli bangsal, verifikasi wajib dua identitas pasien (AB-020),
              pemeriksaan diet terkini (AB-021), penyerahan makanan (AB-023), dan penanganan insiden (AB-030).
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

        {/* FEEDBACK TOAST BANNER */}
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

        {/* PERINGATAN KESELAMATAN ATURAN BISNIS */}
        <SafetyHoldBanner
          judul="Aturan Keselamatan Pasien Wajib (AB-020 & AB-021)"
          alasanPenahanan="Wajib memverifikasi sedikitnya DUA pengenal pasien (Nama Lengkap + Tanggal Lahir / No. RM) sebelum makanan diserahkan. Nomor kamar/bed BUKAN satu-satunya pengenal."
          tindakLanjutWajib="Jika status diet di rekam medis telah berubah (misal pasien NPO/puasa), makanan lama DILARANG diserahkan dan otomatis ditahan."
        />

        {/* OVERVIEW METRIK DASBOR DISTRIBUSI */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="border rounded-xl p-3.5 bg-card shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-medium">Troli Aktif</span>
              <Truck className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold tracking-tight">
              {overview?.totalTroliAktif ?? 0}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Persiapan / Rute</p>
          </div>

          <div className="border rounded-xl p-3.5 bg-card shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-medium">Porsi Siap Kirim</span>
              <UtensilsCrossed className="w-4 h-4 text-indigo-500" />
            </div>
            <p className="text-2xl font-bold tracking-tight">
              {overview?.totalPorsiSiapKirim ?? 0}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Dalam Troli</p>
          </div>

          <div className="border rounded-xl p-3.5 bg-card shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-medium">Berhasil Diserahkan</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold tracking-tight text-emerald-600">
              {overview?.totalPorsiBerhasilDiserahkan ?? 0}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Lolos 2 Identitas (AB-020)</p>
          </div>

          <div className="border rounded-xl p-3.5 bg-card shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-medium">Ditahan Klinis</span>
              <ShieldAlert className="w-4 h-4 text-destructive" />
            </div>
            <p className="text-2xl font-bold tracking-tight text-destructive">
              {overview?.totalPorsiDitahanKlinis ?? 0}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Diet Berubah / NPO (AB-022)</p>
          </div>

          <div className="border rounded-xl p-3.5 bg-card shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-medium">Insiden Aktif</span>
              <FileWarning className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold tracking-tight text-amber-600">
              {overview?.totalInsidenAktif ?? 0}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Tercatat di Lapangan</p>
          </div>
        </div>

        {/* TAB NAVIGASI OPERASIONAL */}
        <div className="flex border-b space-x-2 max-w-full overflow-x-auto [&>button]:shrink-0 [&>button]:whitespace-nowrap">
          <button
            type="button"
            onClick={() => setTabAktif("troli")}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              tabAktif === "troli"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            Troli Pengantaran Bangsal ({daftarTroli.length})
          </button>

          <button
            type="button"
            onClick={() => setTabAktif("porsi")}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              tabAktif === "porsi"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            Verifikasi & Serah Makanan Pasien ({daftarPorsi.length})
          </button>

          <button
            type="button"
            onClick={() => setTabAktif("tahan")}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              tabAktif === "tahan"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Penahanan Distribusi ({daftarPorsi.filter((p) => p.statusSerah === "ditahan_klinis").length})
          </button>

          <button
            type="button"
            onClick={() => setTabAktif("insiden")}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              tabAktif === "insiden"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Laporan Insiden ({daftarInsiden.length})
          </button>
        </div>

        {/* TAB 1: TROLI PENGANTARAN BANGSAL */}
        {tabAktif === "troli" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setModalTroliBuka(true)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Buat Troli Pengantaran Baru
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={muatSemuaData}
                  disabled={memuatData}
                  className="flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${memuatData ? "animate-spin" : ""}`} />
                  Segarkan
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Sesi:</span>
                <select
                  value={filterSesi}
                  onChange={(e) => setFilterSesi(e.target.value)}
                  className="border rounded-md px-2.5 py-1 text-xs bg-background"
                >
                  <option value="SEMUA">Semua Sesi</option>
                  <option value="pagi">Pagi</option>
                  <option value="siang">Siang</option>
                  <option value="malam">Malam</option>
                </select>

                <span className="text-xs text-muted-foreground ml-2">Status:</span>
                <select
                  value={filterStatusTroli}
                  onChange={(e) => setFilterStatusTroli(e.target.value)}
                  className="border rounded-md px-2.5 py-1 text-xs bg-background"
                >
                  <option value="SEMUA">Semua Status</option>
                  <option value="persiapan">Persiapan</option>
                  <option value="dalam_perjalanan">Dalam Perjalanan</option>
                  <option value="selesai">Selesai</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {daftarTroli
                .filter((t) => (filterSesi === "SEMUA" ? true : t.sesiMakan === filterSesi))
                .filter((t) => (filterStatusTroli === "SEMUA" ? true : t.status === filterStatusTroli))
                .map((troli) => (
                  <div key={troli.id} className="border rounded-xl p-4 bg-card shadow-sm space-y-3">
                    <div className="flex justify-between items-start border-b pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-base">{troli.nomorTroli}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                              troli.status === "selesai"
                                ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20"
                                : troli.status === "dalam_perjalanan"
                                  ? "bg-blue-500/10 text-blue-700 border border-blue-500/20 animate-pulse"
                                  : "bg-amber-500/10 text-amber-700 border border-amber-500/20"
                            }`}
                          >
                            {troli.status}
                          </span>
                          <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-medium uppercase">
                            Sesi {troli.sesiMakan}
                          </span>
                        </div>
                        <h4 className="font-semibold text-sm mt-0.5 text-foreground">{troli.namaBangsal}</h4>
                        <p className="text-xs text-muted-foreground">
                          Petugas: <strong>{troli.petugasDistribusiNama}</strong> | Tanggal: {troli.tanggalDistribusi}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {troli.status === "persiapan" && (
                          <Button
                            size="sm"
                            onClick={() => tanganiBerangkatkanTroli(troli.id)}
                            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 text-xs"
                          >
                            <Navigation className="w-3.5 h-3.5" />
                            Berangkatkan Troli
                          </Button>
                        )}
                        {troli.status === "dalam_perjalanan" && (
                          <Button
                            size="sm"
                            onClick={() => tanganiKembalikanTroli(troli.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 text-xs"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Selesai & Kembali
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="border rounded p-2 bg-muted/20">
                        <span className="text-[11px] text-muted-foreground block">Muatan Porsi</span>
                        <span className="font-bold text-sm">{troli.totalPorsi}</span>
                      </div>
                      <div className="border rounded p-2 bg-emerald-500/10 text-emerald-800">
                        <span className="text-[11px] block">Terserah</span>
                        <span className="font-bold text-sm">{troli.totalTerserah}</span>
                      </div>
                      <div className="border rounded p-2 bg-destructive/10 text-destructive">
                        <span className="text-[11px] block">Ditahan</span>
                        <span className="font-bold text-sm">{troli.totalDitahan}</span>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground italic">&ldquo;{troli.catatan}&rdquo;</p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* TAB 2: VERIFIKASI & PENYERAHAN MAKANAN PASIEN (BEDSIDE) */}
        {tabAktif === "porsi" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold">Filter Bangsal:</span>
                <select
                  value={filterBangsal}
                  onChange={(e) => setFilterBangsal(e.target.value)}
                  className="border rounded-md px-2.5 py-1 text-xs bg-background"
                >
                  <option value="SEMUA">Semua Bangsal</option>
                  <option value="bng-001">Bangsal Melati</option>
                  <option value="bng-002">Bangsal Mawar</option>
                </select>

                <span className="text-xs font-semibold ml-2">Status Serah:</span>
                <select
                  value={filterStatusSerah}
                  onChange={(e) => setFilterStatusSerah(e.target.value)}
                  className="border rounded-md px-2.5 py-1 text-xs bg-background"
                >
                  <option value="SEMUA">Semua Status</option>
                  <option value="menunggu_pengiriman">Menunggu Pengiriman</option>
                  <option value="dalam_troli">Dalam Troli</option>
                  <option value="berhasil_diserahkan">Berhasil Diserahkan</option>
                  <option value="ditahan_klinis">Ditahan Klinis</option>
                </select>
              </div>

              <div className="text-xs text-muted-foreground">
                Total: <strong>{daftarPorsi.length} Porsi Makanan</strong>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {daftarPorsi
                .filter((p) => (filterBangsal === "SEMUA" ? true : p.bangsalId === filterBangsal))
                .filter((p) => (filterStatusSerah === "SEMUA" ? true : p.statusSerah === filterStatusSerah))
                .map((porsi) => (
                  <div key={porsi.id} className="border rounded-xl p-4 bg-card shadow-sm space-y-3">
                    <div className="flex justify-between items-start border-b pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm font-mono">{porsi.nomorLabel}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                              porsi.statusSerah === "berhasil_diserahkan"
                                ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20"
                                : porsi.statusSerah === "ditahan_klinis"
                                  ? "bg-destructive/10 text-destructive border border-destructive/20"
                                  : "bg-blue-500/10 text-blue-700 border border-blue-500/20"
                            }`}
                          >
                            {porsi.statusSerah}
                          </span>
                        </div>
                        <h4 className="font-bold text-base mt-1 text-foreground flex items-center gap-2">
                          <DoorOpen className="w-4 h-4 text-primary" />
                          {porsi.namaPasien}
                          <span className="text-xs text-muted-foreground font-mono">({porsi.nomorRm})</span>
                        </h4>
                        <p className="text-xs font-semibold text-muted-foreground">
                          {porsi.kamarBed} | Lahir: {porsi.tanggalLahirPasien}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1.5">
                        {porsi.statusSerah !== "berhasil_diserahkan" && porsi.statusSerah !== "ditahan_klinis" && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setPorsiSerahTerpilih(porsi);
                              setNamaVerifInput(porsi.namaPasien);
                              setTglLahirVerifInput(porsi.tanggalLahirPasien);
                              setRmVerifInput(porsi.nomorRm);
                              setNamaPenerimaInput(porsi.namaPasien);
                              setModalSerahBuka(true);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 text-xs"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Verifikasi & Serahkan (AB-020)
                          </Button>
                        )}

                        {porsi.statusSerah !== "berhasil_diserahkan" && porsi.statusSerah !== "ditahan_klinis" && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setPorsiTahanTerpilih(porsi);
                              setModalTahanBuka(true);
                            }}
                            className="flex items-center gap-1 text-xs"
                          >
                            <ShieldAlert className="w-3 h-3" />
                            Tahan Makanan (AB-022)
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Informasi Menu & Diet Terkini (AB-021) */}
                    <div className="space-y-2 text-xs">
                      <div className="border rounded-lg p-2.5 bg-muted/20">
                        <p className="text-[11px] text-muted-foreground">Menu Makanan Label:</p>
                        <p className="font-semibold">{porsi.namaMenu}</p>
                        <p className="text-muted-foreground mt-0.5">
                          Diet Label: <strong>{porsi.jenisDietLabel}</strong>
                        </p>
                      </div>

                      {/* Status Kesesuaian Diet Rekam Medis (AB-021) */}
                      <div
                        className={`border rounded-lg p-2.5 flex items-start gap-2 ${
                          porsi.statusKesesuaianDiet === "berubah_perlu_tahan" ||
                          porsi.dietTerkiniPasien.toLowerCase().includes("npo")
                            ? "bg-destructive/10 border-destructive/30 text-destructive"
                            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-800"
                        }`}
                      >
                        {porsi.statusKesesuaianDiet === "berubah_perlu_tahan" ||
                        porsi.dietTerkiniPasien.toLowerCase().includes("npo") ? (
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        ) : (
                          <Check className="w-4 h-4 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className="font-bold">
                            Diet Terkini Pasien: {porsi.dietTerkiniPasien}
                          </p>
                          {porsi.statusKesesuaianDiet === "berubah_perlu_tahan" ||
                          porsi.dietTerkiniPasien.toLowerCase().includes("npo") ? (
                            <p className="text-[11px] mt-0.5">
                              ⚠ PERINGATAN: Diet rekam medis pasien telah berubah (NPO/Puasa). Makanan lama dilarang diserahkan (AB-021).
                            </p>
                          ) : (
                            <p className="text-[11px] mt-0.5">
                              ✓ Sesuai dengan instruksi diet aktif di rekam medis.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Riwayat Serah Jika Sudah Diserahkan */}
                      {porsi.statusSerah === "berhasil_diserahkan" && (
                        <div className="border rounded-lg p-2.5 bg-emerald-50 border-emerald-200 text-emerald-900 text-[11px] space-y-1">
                          <p className="font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Diserahkan kepada: {porsi.namaPenerima} ({porsi.hubunganPenerima})
                          </p>
                          <p className="text-muted-foreground">
                            Waktu Serah: {porsi.waktuSerah} | Dua Pengenal Terverifikasi: ✓ Ya
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* TAB 3: PENAHANAN DISTRIBUSI */}
        {tabAktif === "tahan" && (
          <div className="space-y-4">
            <div className="border rounded-xl p-4 bg-card shadow-sm space-y-3">
              <h3 className="font-bold text-base flex items-center gap-2 text-destructive">
                <ShieldAlert className="w-5 h-5" />
                Daftar Porsi Makanan Ditahan di Bangsal (AB-022)
              </h3>
              <p className="text-xs text-muted-foreground">
                Makanan di bawah ini ditahan dari penyerahan pasien karena perubahan diet klinis mendadak,
                instruksi puasa (NPO), atau ketidaksesuaian rekam medis.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                {daftarPorsi
                  .filter((p) => p.statusSerah === "ditahan_klinis")
                  .map((p) => (
                    <div key={p.id} className="border border-destructive/30 rounded-xl p-3 bg-destructive/5 space-y-2 text-xs">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-mono text-[11px] font-bold text-destructive">{p.nomorLabel}</span>
                          <h4 className="font-bold text-sm text-foreground">{p.namaPasien} ({p.nomorRm})</h4>
                          <p className="text-muted-foreground">{p.kamarBed}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-destructive text-destructive-foreground font-semibold uppercase">
                          Ditahan Klinis
                        </span>
                      </div>
                      <div className="border-t pt-2 border-destructive/20">
                        <p className="font-semibold text-destructive">Alasan Penahanan Wajib:</p>
                        <p className="italic text-muted-foreground">&ldquo;{p.alasanGagalAtauTahan}&rdquo;</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: LAPORAN INSIDEN PENGANTARAN */}
        {tabAktif === "insiden" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Button
                onClick={() => setModalInsidenBuka(true)}
                className="bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-2 text-xs"
              >
                <AlertTriangle className="w-4 h-4" />
                Catat Laporan Insiden Baru (AB-030)
              </Button>
              <span className="text-xs text-muted-foreground">
                Total: <strong>{daftarInsiden.length} Insiden</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {daftarInsiden.map((insiden) => (
                <div key={insiden.id} className="border rounded-xl p-4 bg-card shadow-sm space-y-2 text-xs">
                  <div className="flex justify-between items-start border-b pb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold font-mono text-sm">{insiden.nomorInsiden}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-amber-500/10 text-amber-700 border border-amber-500/20">
                          {insiden.jenisInsiden}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-blue-500/10 text-blue-700 border border-blue-500/20">
                          {insiden.statusPenyelesaian}
                        </span>
                      </div>
                      <p className="text-muted-foreground mt-0.5">
                        Lokasi: <strong>{insiden.namaBangsal}</strong> | Dilaporkan oleh: {insiden.dilaporkanOlehNama} | Waktu: {insiden.waktuKejadian}
                      </p>
                    </div>
                  </div>

                  <div>
                    <span className="font-semibold text-muted-foreground">Deskripsi Insiden:</span>
                    <p className="text-foreground mt-0.5">{insiden.deskripsiInsiden}</p>
                  </div>

                  <div className="border-t pt-2">
                    <span className="font-semibold text-emerald-700">Tindakan Koreksi:</span>
                    <p className="text-foreground mt-0.5">{insiden.tindakanKoreksi}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MODAL 1: BUAT TROLI PENGANTARAN BARU */}
        {modalTroliBuka && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-card border rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-base flex items-center gap-2">
                  <Truck className="w-5 h-5 text-primary" />
                  Buat Troli Pengantaran Baru
                </h3>
                <button
                  type="button"
                  onClick={() => setModalTroliBuka(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={tanganiBuatTroli} className="space-y-4 text-xs">
                <div>
                  <label className="block font-medium mb-1">Bangsal Tujuan:</label>
                  <select
                    value={bangsalTroliInput}
                    onChange={(e) => {
                      setBangsalTroliInput(e.target.value);
                      if (e.target.value === "bng-001") setNamaBangsalTroliInput("Bangsal Melati (Penyakit Dalam)");
                      if (e.target.value === "bng-002") setNamaBangsalTroliInput("Bangsal Mawar (Bedah Umum)");
                    }}
                    className="w-full border rounded-md px-3 py-1.5 bg-background text-sm"
                  >
                    <option value="bng-001">Bangsal Melati (Penyakit Dalam)</option>
                    <option value="bng-002">Bangsal Mawar (Bedah Umum)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium mb-1">Sesi Makan:</label>
                    <select
                      value={sesiTroliInput}
                      onChange={(e) => setSesiTroliInput(e.target.value as SesiMakanDapur)}
                      className="w-full border rounded-md px-3 py-1.5 bg-background text-sm"
                    >
                      <option value="pagi">Pagi (Sarapan)</option>
                      <option value="siang">Siang (Makan Siang)</option>
                      <option value="malam">Malam (Makan Malam)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Tanggal Distribusi:</label>
                    <input
                      type="date"
                      value={tanggalTroliInput}
                      onChange={(e) => setTanggalTroliInput(e.target.value)}
                      className="w-full border rounded-md px-3 py-1.5 bg-background text-sm"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium mb-1">Catatan Pengantaran:</label>
                  <textarea
                    rows={2}
                    value={catatanTroliInput}
                    onChange={(e) => setCatatanTroliInput(e.target.value)}
                    placeholder="Contoh: Kloter makan siang Bangsal Melati lantai 2..."
                    className="w-full border rounded-md px-3 py-1.5 bg-background text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setModalTroliBuka(false)}
                  >
                    Batal
                  </Button>
                  <Button type="submit" disabled={sedangSimpanTroli}>
                    {sedangSimpanTroli ? "Menyimpan..." : "Simpan Troli"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: VERIFIKASI DUA IDENTITAS & HANDOVER (AB-020, AB-021, AB-023) */}
        {modalSerahBuka && porsiSerahTerpilih && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-card border rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-base flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  Verifikasi Dua Pengenal & Serah Makanan
                </h3>
                <button
                  type="button"
                  onClick={() => setModalSerahBuka(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="border rounded-lg p-3 bg-muted/20 text-xs space-y-1">
                <p className="font-bold text-sm">{porsiSerahTerpilih.namaPasien} ({porsiSerahTerpilih.nomorRm})</p>
                <p className="text-muted-foreground">Lokasi: <strong>{porsiSerahTerpilih.kamarBed}</strong> | Menu: {porsiSerahTerpilih.namaMenu}</p>
                <p className="text-muted-foreground">Diet Label: <strong>{porsiSerahTerpilih.jenisDietLabel}</strong></p>
              </div>

              <form onSubmit={tanganiVerifikasiDanSerah} className="space-y-3 text-xs">
                <div className="border rounded-lg p-3 bg-blue-50/50 border-blue-200 space-y-3">
                  <h4 className="font-bold text-blue-900 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-blue-700" />
                    Pencocokan Sedikitnya Dua Pengenal (AB-020):
                  </h4>

                  <div>
                    <label className="block font-medium mb-1">Pengenal 1: Nama Lengkap Pasien:</label>
                    <input
                      type="text"
                      value={namaVerifInput}
                      onChange={(e) => setNamaVerifInput(e.target.value)}
                      placeholder="Nama lengkap pasien di gelang..."
                      className="w-full border rounded-md px-3 py-1.5 bg-background text-xs"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-medium mb-1">Pengenal 2: Tanggal Lahir:</label>
                      <input
                        type="date"
                        value={tglLahirVerifInput}
                        onChange={(e) => setTglLahirVerifInput(e.target.value)}
                        className="w-full border rounded-md px-3 py-1.5 bg-background text-xs"
                        required
                      />
                    </div>
                    <div>
                      <label className="block font-medium mb-1">Nomor RM Pasien:</label>
                      <input
                        type="text"
                        value={rmVerifInput}
                        onChange={(e) => setRmVerifInput(e.target.value)}
                        placeholder="RM-2026-XXXX"
                        className="w-full border rounded-md px-3 py-1.5 bg-background text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium mb-1">Metode Verifikasi di Ranjang:</label>
                    <select
                      value={metodeVerifInput}
                      onChange={(e) => setMetodeVerifInput(e.target.value as MetodeVerifikasiIdentitas)}
                      className="w-full border rounded-md px-3 py-1.5 bg-background text-xs"
                    >
                      <option value="gelang_pasien">Pemeriksaan Barcode Gelang Pasien (Direkomendasikan)</option>
                      <option value="tanya_pasien_keluarga">Konfirmasi Lisan Pasien / Keluarga</option>
                      <option value="rekam_medis_bedside">Pencocokan Rekam Medis Bedside</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-medium mb-1">Nama Penerima Makanan:</label>
                    <input
                      type="text"
                      value={namaPenerimaInput}
                      onChange={(e) => setNamaPenerimaInput(e.target.value)}
                      className="w-full border rounded-md px-3 py-1.5 bg-background text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Hubungan Penerima:</label>
                    <select
                      value={hubunganPenerimaInput}
                      onChange={(e) => setHubunganPenerimaInput(e.target.value as HubunganPenerimaMakanan)}
                      className="w-full border rounded-md px-3 py-1.5 bg-background text-xs"
                    >
                      <option value="pasien_sendiri">Pasien Sendiri</option>
                      <option value="keluarga_pasien">Keluarga Pasien</option>
                      <option value="perawat_penanggung_jawab">Perawat Penanggung Jawab</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-medium mb-1">Catatan Verifikasi & Serah:</label>
                  <input
                    type="text"
                    value={catatanVerifInput}
                    onChange={(e) => setCatatanVerifInput(e.target.value)}
                    className="w-full border rounded-md px-3 py-1.5 bg-background text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setModalSerahBuka(false)}
                  >
                    Batal
                  </Button>
                  <Button type="submit" disabled={sedangSimpanSerah} className="bg-emerald-600 hover:bg-emerald-700">
                    {sedangSimpanSerah ? "Memverifikasi..." : "Konfirmasi & Serahkan Makanan"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 3: TAHAN PORSI KARENA PERUBAHAN KLINIS (AB-022, AB-030) */}
        {modalTahanBuka && porsiTahanTerpilih && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-card border rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-base flex items-center gap-2 text-destructive">
                  <ShieldAlert className="w-5 h-5" />
                  Tahan Makanan di Bangsal (AB-022)
                </h3>
                <button
                  type="button"
                  onClick={() => setModalTahanBuka(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="border rounded-lg p-3 bg-muted/20 text-xs">
                <p className="font-bold">{porsiTahanTerpilih.namaPasien} ({porsiTahanTerpilih.nomorRm})</p>
                <p className="text-muted-foreground">{porsiTahanTerpilih.kamarBed} | Menu: {porsiTahanTerpilih.namaMenu}</p>
              </div>

              <form onSubmit={tanganiTahanPorsi} className="space-y-4 text-xs">
                <div>
                  <label className="block font-medium mb-1">
                    Alasan Wajib Penahanan Klinis (AB-030, min. 5 karakter):
                  </label>
                  <textarea
                    rows={3}
                    value={alasanTahanInput}
                    onChange={(e) => setAlasanTahanInput(e.target.value)}
                    placeholder="Contoh: Pasien diinstruksikan puasa (NPO) pre-tindakan cito..."
                    className="w-full border rounded-md px-3 py-1.5 bg-background text-xs"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {alasanTahanInput.length}/5 karakter minimum.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setModalTahanBuka(false)}
                  >
                    Batal
                  </Button>
                  <Button type="submit" variant="destructive" disabled={sedangSimpanTahan}>
                    {sedangSimpanTahan ? "Menahan..." : "Tahan Makanan"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 4: CATAT LAPORAN INSIDEN (AB-030) */}
        {modalInsidenBuka && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-card border rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-base flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="w-5 h-5" />
                  Catat Laporan Insiden Distribusi Makanan
                </h3>
                <button
                  type="button"
                  onClick={() => setModalInsidenBuka(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={tanganiBuatInsiden} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium mb-1">Bangsal Kejadian:</label>
                    <select
                      value={bangsalInsidenInput}
                      onChange={(e) => {
                        setBangsalInsidenInput(e.target.value);
                        if (e.target.value === "bng-001") setNamaBangsalInsidenInput("Bangsal Melati");
                        if (e.target.value === "bng-002") setNamaBangsalInsidenInput("Bangsal Mawar");
                      }}
                      className="w-full border rounded-md px-3 py-1.5 bg-background text-xs"
                    >
                      <option value="bng-001">Bangsal Melati</option>
                      <option value="bng-002">Bangsal Mawar</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Jenis Insiden:</label>
                    <select
                      value={jenisInsidenInput}
                      onChange={(e) => setJenisInsidenInput(e.target.value as JenisInsidenDistribusi)}
                      className="w-full border rounded-md px-3 py-1.5 bg-background text-xs"
                    >
                      <option value="makanan_tumpah_rusak">Makanan Tumpah / Rusak di Perjalanan</option>
                      <option value="diet_tidak_sesuai">Diet Tidak Sesuai Rekam Medis</option>
                      <option value="pasien_puasa_npo">Pasien Puasa (NPO) Mendadak</option>
                      <option value="pasien_pindah_kamar">Pasien Pindah Kamar / Pulang</option>
                      <option value="pasien_menolak">Pasien Menolak Makanan</option>
                      <option value="keterlambatan_ekstrem">Keterlambatan Ekstrem Pengiriman</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-medium mb-1">
                    Deskripsi Insiden (AB-030, min. 5 karakter):
                  </label>
                  <textarea
                    rows={2}
                    value={deskripsiInsidenInput}
                    onChange={(e) => setDeskripsiInsidenInput(e.target.value)}
                    className="w-full border rounded-md px-3 py-1.5 bg-background text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block font-medium mb-1">
                    Tindakan Koreksi Langsung (AB-030, min. 5 karakter):
                  </label>
                  <textarea
                    rows={2}
                    value={tindakanInsidenInput}
                    onChange={(e) => setTindakanInsidenInput(e.target.value)}
                    className="w-full border rounded-md px-3 py-1.5 bg-background text-xs"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setModalInsidenBuka(false)}
                  >
                    Batal
                  </Button>
                  <Button type="submit" disabled={sedangSimpanInsiden} className="bg-amber-600 hover:bg-amber-700">
                    {sedangSimpanInsiden ? "Menyimpan..." : "Laporkan Insiden"}
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
