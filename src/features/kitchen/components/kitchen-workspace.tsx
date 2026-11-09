/**
 * @fileoverview Workspace antarmuka pengguna untuk Peran Petugas Dapur.
 * Mengimplementasikan:
 * 1. Rencana Produksi Reguler H-1 & Estimasi Kebutuhan Bahan Mentah (AB-012, AB-014).
 * 2. Pencatatan Batch Memasak & Suhu Critical Control Point (CCP >= 75 C, AB-018, AB-019).
 * 3. Pemeriksaan Mutu Akhir Organoleptik & Suhu Saji Sebelum Distribusi (AB-019, AB-022).
 * 4. Pengepakan, Pelabelan Pasien & Penahanan Pesanan Terdampak Perubahan Klinis (BRD 8.5, AB-010, AB-013).
 * 5. Ketertelusuran Bahan Gudang ke Porsi Pasien / Recall Traceability (BRD 8.6).
 */

"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import {
  CalendarDays,
  Check,
  Flame,
  PackageCheck,
  Plus,
  QrCode,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Thermometer,
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
  ItemBatchProduksiDto,
  ItemLabelPorsiPasienDto,
  ItemPemeriksaanMutuProduksiDto,
  ItemRencanaProduksiDto,
  RingkasanDapurOverviewDto,
  SesiMakanDapur,
  ResponsApi,
} from "../../../../packages/shared-types/src/index.ts";

type TabDapur = "rencana" | "batch" | "qc" | "porsi" | "telusur";

export function KitchenWorkspace() {
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

  const [tabAktif, setTabAktif] = useState<TabDapur>("rencana");
  const [memuatData, setMemuatData] = useState(false);
  const [pesanGalat, setPesanGalat] = useState<string | null>(null);
  const [pesanSukses, setPesanSukses] = useState<string | null>(null);

  // Data state
  const [overview, setOverview] = useState<RingkasanDapurOverviewDto | null>(null);
  const [daftarRencana, setDaftarRencana] = useState<ItemRencanaProduksiDto[]>([]);
  const [daftarBatch, setDaftarBatch] = useState<ItemBatchProduksiDto[]>([]);
  const [daftarQC, setDaftarQC] = useState<ItemPemeriksaanMutuProduksiDto[]>([]);
  const [daftarLabel, setDaftarLabel] = useState<ItemLabelPorsiPasienDto[]>([]);

  // Filter state
  const [filterSesi, setFilterSesi] = useState<string>("SEMUA");
  const [filterStatusRencana, setFilterStatusRencana] = useState<string>("SEMUA");
  const [filterStatusBatch, setFilterStatusBatch] = useState<string>("SEMUA");
  const [filterStatusPorsi, setFilterStatusPorsi] = useState<string>("SEMUA");

  // Traceability state
  const [inputCariLot, setInputCariLot] = useState("");
  const [hasilTrace, setHasilTrace] = useState<{
    nomorLot: string;
    batchTerdampak: ItemBatchProduksiDto[];
    porsiTerdampak: ItemLabelPorsiPasienDto[];
  } | null>(null);
  const [sedangTrace, setSedangTrace] = useState(false);

  // Modal 1: Buat Rencana Produksi H-1
  const [modalRencanaBuka, setModalRencanaBuka] = useState(false);
  const [tanggalPelayananInput, setTanggalPelayananInput] = useState("");
  const [sesiRencanaInput, setSesiRencanaInput] = useState<SesiMakanDapur>("siang");
  const [catatanRencanaInput, setCatatanRencanaInput] = useState("");
  const [sedangSimpanRencana, setSedangSimpanRencana] = useState(false);

  // Modal 2: Catat Batch Memasak Baru
  const [modalBatchBuka, setModalBatchBuka] = useState(false);
  const [rencanaIdPilihan, setRencanaIdPilihan] = useState("");
  const [resepPilihan, setResepPilihan] = useState("");
  const [namaMasakanInput, setNamaMasakanInput] = useState("");
  const [sesiBatchInput, setSesiBatchInput] = useState<SesiMakanDapur>("siang");
  const [targetPorsiInput, setTargetPorsiInput] = useState("");
  const [chefInput, setChefInput] = useState("");
  const [bahanIdInput, setBahanIdInput] = useState("");
  const [namaBahanInput, setNamaBahanInput] = useState("");
  const [jumlahBahanInput, setJumlahBahanInput] = useState("");
  const [satuanBahanInput, setSatuanBahanInput] = useState("");
  const [nomorLotBahanInput, setNomorLotBahanInput] = useState("");
  const [sedangSimpanBatch, setSedangSimpanBatch] = useState(false);
  const [resepDapur, setResepDapur] = useState<Array<{ id: string; namaMenu: string }>>([]);
  const [lotDapur, setLotDapur] = useState<Array<{ bahanId: string; namaBahan: string; nomorLot: string; satuan: string; jumlahTersedia: number }>>([]);
  const [lotTambahan, setLotTambahan] = useState<Array<{ bahanId: string; namaBahan: string; nomorLot: string; jumlahDigunakan: number; satuan: string }>>([]);


  // Modal 3: Catat Suhu Inti CCP
  const [modalCcpBuka, setModalCcpBuka] = useState(false);
  const [batchCcpTerpilih, setBatchCcpTerpilih] = useState<ItemBatchProduksiDto | null>(null);
  const [suhuCcpInput, setSuhuCcpInput] = useState("");
  const [catatanCcpInput, setCatatanCcpInput] = useState("");
  const [sedangSimpanCcp, setSedangSimpanCcp] = useState(false);

  // Modal 4: Catat Pemeriksaan Mutu Akhir
  const [modalQcBuka, setModalQcBuka] = useState(false);
  const [batchQcTerpilih, setBatchQcTerpilih] = useState<ItemBatchProduksiDto | null>(null);
  const [suhuSajiInput, setSuhuSajiInput] = useState("");
  const [ujiTeksturInput, setUjiTeksturInput] = useState<"sesuai" | "tidak_sesuai" | "">("");
  const [ujiAromaInput, setUjiAromaInput] = useState<"normal_segar" | "menyimpang" | "">("");
  const [ujiRasaInput, setUjiRasaInput] = useState<"sesuai_standar" | "tidak_sesuai" | "">("");
  const [ujiVisualInput, setUjiVisualInput] = useState<"bersih_menarik" | "kurang_baik" | "">("");
  const [statusMutuInput, setStatusMutuInput] = useState<"lolos_pemeriksaan" | "ditahan_gagal_mutu" | "">("");
  const [catatanQcInput, setCatatanQcInput] = useState("");
  const [sedangSimpanQc, setSedangSimpanQc] = useState(false);

  // Modal 5: Tahan Porsi Pasien (Perubahan Klinis)
  const [modalTahanBuka, setModalTahanBuka] = useState(false);
  const [labelTahanTerpilih, setLabelTahanTerpilih] = useState<ItemLabelPorsiPasienDto | null>(null);
  const [alasanTahanInput, setAlasanTahanInput] = useState("Perubahan diet klinis: Pasien diinstruksikan puasa (NPO) pre-tindakan medis.");
  const [sedangSimpanTahan, setSedangSimpanTahan] = useState(false);

  // Pemuatan data
  const muatSemuaData = async () => {
    setMemuatData(true);
    setPesanGalat(null);
    try {
      const [resOverview, resRencana, resBatch, resQC, resLabel] = await Promise.all([
        fetch("/api/v1/kitchen/overview"),
        fetch("/api/v1/kitchen/production-plans"),
        fetch("/api/v1/kitchen/batches"),
        fetch("/api/v1/kitchen/quality-inspections"),
        fetch("/api/v1/kitchen/portion-labels"),
      ]);

      if (resOverview.ok) {
        const json = (await resOverview.json()) as ResponsApi<RingkasanDapurOverviewDto>;
        if (json.sukses) setOverview(json.data);
      }
      if (resRencana.ok) {
        const json = (await resRencana.json()) as ResponsApi<{ items: ItemRencanaProduksiDto[] }>;
        if (json.sukses) setDaftarRencana(json.data.items);
      }
      if (resBatch.ok) {
        const json = (await resBatch.json()) as ResponsApi<{ items: ItemBatchProduksiDto[] }>;
        if (json.sukses) setDaftarBatch(json.data.items);
      }
      if (resQC.ok) {
        const json = (await resQC.json()) as ResponsApi<{ items: ItemPemeriksaanMutuProduksiDto[] }>;
        if (json.sukses) setDaftarQC(json.data.items);
      }
      if (resLabel.ok) {
        const json = (await resLabel.json()) as ResponsApi<{ items: ItemLabelPorsiPasienDto[] }>;
        if (json.sukses) setDaftarLabel(json.data.items);
      }
    } catch (err) {
      setPesanGalat(err instanceof Error ? err.message : "Gagal memuat data dapur.");
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

  // Handler: Buat Rencana Produksi H-1
  const tanganiBuatRencana = async (e: React.FormEvent) => {
    e.preventDefault();
    setSedangSimpanRencana(true);
    setPesanGalat(null);
    setPesanSukses(null);
    try {
      const payload = {
        tanggalPelayanan: tanggalPelayananInput,
        jenisRencana: tanggalPelayananInput === new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }) ? "mendadak" : "reguler",
        sesiMakan: sesiRencanaInput,
        catatan: catatanRencanaInput,
      };
      const res = await fetch("/api/v1/kitchen/production-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as ResponsApi<ItemRencanaProduksiDto>;
      if (!res.ok || !json.sukses) {
        throw new Error((!json.sukses ? json.galat.pesan : undefined) ?? "Gagal membuat rencana produksi.");
      }
      setPesanSukses(`Rencana produksi ${json.data.nomorRencana} berhasil dibuat dengan status draft.`);
      setModalRencanaBuka(false);
      setCatatanRencanaInput("");
      await muatSemuaData();
    } catch (err) {
      setPesanGalat(err instanceof Error ? err.message : "Terjadi kesalahan saat membuat rencana produksi.");
    } finally {
      setSedangSimpanRencana(false);
    }
  };

  // Handler: Sahkan Rencana Produksi (AB-012)
  const tanganiSahkanRencana = async (rencanaId: string) => {
    setMemuatData(true);
    setPesanGalat(null);
    setPesanSukses(null);
    try {
      const res = await fetch(`/api/v1/kitchen/production-plans/${rencanaId}/approve`, {
        method: "POST",
      });
      const json = (await res.json()) as ResponsApi<ItemRencanaProduksiDto>;
      if (!res.ok || !json.sukses) {
        throw new Error((!json.sukses ? json.galat.pesan : undefined) ?? "Gagal mengesahkan rencana produksi.");
      }
      setPesanSukses(`Rencana ${json.data.nomorRencana} resmi disahkan untuk hari pelayanan ${json.data.tanggalPelayanan}.`);
      await muatSemuaData();
    } catch (err) {
      setPesanGalat(err instanceof Error ? err.message : "Terjadi kesalahan saat mengesahkan rencana.");
    } finally {
      setMemuatData(false);
    }
  };

  const bukaModalBatch = async () => {
    try {
      const [resRecipe, resLots] = await Promise.all([fetch("/api/v1/operasional/recipes"), fetch("/api/v1/operasional/issued-lots")]);
      const recipeJson = await resRecipe.json() as ResponsApi<{ items: typeof resepDapur }>;
      const lotJson = await resLots.json() as ResponsApi<{ items: typeof lotDapur }>;
      if (!recipeJson.sukses) throw new Error(recipeJson.galat.pesan);
      if (!lotJson.sukses) throw new Error(lotJson.galat.pesan);
      setResepDapur(recipeJson.data.items); setLotDapur(lotJson.data.items);
      setLotTambahan([]); setNomorLotBahanInput(""); setJumlahBahanInput("");
      setModalBatchBuka(true);
    } catch (error) { setPesanGalat(error instanceof Error ? error.message : "Data resep dan lot belum tersedia."); }
  };

  // Handler: Buat Batch Memasak Baru (AB-018)
  const tanganiBuatBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const lots = [...lotTambahan, ...(nomorLotBahanInput ? [{ bahanId: bahanIdInput, namaBahan: namaBahanInput, nomorLot: nomorLotBahanInput, jumlahDigunakan: Number(jumlahBahanInput), satuan: satuanBahanInput }] : [])];
    if (!rencanaIdPilihan || !resepPilihan || !namaMasakanInput.trim() || Number(targetPorsiInput) <= 0 || !chefInput.trim() || !lots.length || lots.some((l) => !l.bahanId || !l.nomorLot || l.jumlahDigunakan <= 0)) {
      setPesanGalat("Pilih rencana, resep, penanggung jawab, dan seluruh lot bahan yang benar-benar dipakai.");
      return;
    }
    setSedangSimpanBatch(true);
    setPesanGalat(null);
    setPesanSukses(null);
    try {
      const payload = {
        rencanaProduksiId: rencanaIdPilihan,
        resepId: resepPilihan,
        namaMasakan: namaMasakanInput,
        sesiMakan: sesiBatchInput,
        jumlahPorsiTarget: Number(targetPorsiInput),
        chefPenanggungJawab: chefInput,
        catatanKoki: "Mulai persiapan dan memasak bahan baku terpilih.",
        lotBahanDigunakan: lots,
      };
      const res = await fetch("/api/v1/kitchen/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as ResponsApi<ItemBatchProduksiDto>;
      if (!res.ok || !json.sukses) {
        throw new Error((!json.sukses ? json.galat.pesan : undefined) ?? "Gagal mencatat batch memasak.");
      }
      setPesanSukses(`Batch memasak ${json.data.nomorBatch} ('${json.data.namaMasakan}') berhasil dicatat.`);
      setModalBatchBuka(false);
      await muatSemuaData();
    } catch (err) {
      setPesanGalat(err instanceof Error ? err.message : "Terjadi kesalahan saat membuat batch.");
    } finally {
      setSedangSimpanBatch(false);
    }
  };

  // Handler: Catat Suhu Inti CCP (AB-019)
  const tanganiSimpanCcp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchCcpTerpilih) return;
    if (!suhuCcpInput || isNaN(Number(suhuCcpInput))) {
      setPesanGalat("Masukkan suhu masak inti CCP yang valid.");
      return;
    }
    setSedangSimpanCcp(true);
    setPesanGalat(null);
    setPesanSukses(null);
    try {
      const payload = {
        suhuMasakCcpCelsius: Number(suhuCcpInput),
        catatanKoki: catatanCcpInput.trim() || undefined,
      };
      const res = await fetch(`/api/v1/kitchen/batches/${batchCcpTerpilih.id}/ccp-temp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as ResponsApi<ItemBatchProduksiDto>;
      if (!res.ok || !json.sukses) {
        throw new Error((!json.sukses ? json.galat.pesan : undefined) ?? "Gagal merekam suhu CCP.");
      }
      setPesanSukses(`Suhu CCP untuk ${json.data.nomorBatch} (${json.data.suhuMasakCcpCelsius} C) berhasil diverifikasi.`);
      setModalCcpBuka(false);
      setBatchCcpTerpilih(null);
      await muatSemuaData();
    } catch (err) {
      setPesanGalat(err instanceof Error ? err.message : "Terjadi kesalahan saat merekam suhu CCP.");
    } finally {
      setSedangSimpanCcp(false);
    }
  };

  // Handler: Catat Pemeriksaan Mutu Akhir (AB-019, AB-022)
  const tanganiSimpanQc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchQcTerpilih) return;
    if (!suhuSajiInput || !ujiTeksturInput || !ujiAromaInput || !ujiRasaInput || !ujiVisualInput || !statusMutuInput || catatanQcInput.length < 5) {
      setPesanGalat("Isi suhu, seluruh hasil pemeriksaan mutu, status, dan catatan aktual sebelum menyimpan.");
      return;
    }
    setSedangSimpanQc(true);
    setPesanGalat(null);
    setPesanSukses(null);
    try {
      const payload = {
        batchProduksiId: batchQcTerpilih.id,
        suhuSajiCelsius: Number(suhuSajiInput),
        ujiTekstur: ujiTeksturInput,
        ujiAroma: ujiAromaInput,
        ujiRasa: ujiRasaInput,
        ujiTampilanVisual: ujiVisualInput,
        statusMutu: statusMutuInput,
        catatanPemeriksaan: catatanQcInput,
      };
      const res = await fetch("/api/v1/kitchen/quality-inspections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as ResponsApi<ItemPemeriksaanMutuProduksiDto>;
      if (!res.ok || !json.sukses) {
        throw new Error((!json.sukses ? json.galat.pesan : undefined) ?? "Gagal menyimpan pemeriksaan mutu.");
      }
      setPesanSukses(
        `Pemeriksaan mutu batch ${json.data.nomorBatch} selesai. Status: ${json.data.statusMutu === "lolos_pemeriksaan" ? "LOLOS PEMERIKSAAN (Siap Porsi)" : "DITAHAN GAGAL MUTU"}.`,
      );
      setModalQcBuka(false);
      setBatchQcTerpilih(null);
      await muatSemuaData();
    } catch (err) {
      setPesanGalat(err instanceof Error ? err.message : "Terjadi kesalahan saat mencatat QC.");
    } finally {
      setSedangSimpanQc(false);
    }
  };

  // Handler: Siapkan Porsi untuk Distribusi (AB-019, AB-022)
  const tanganiSiapkanPorsi = async (label: ItemLabelPorsiPasienDto) => {
    setMemuatData(true);
    setPesanGalat(null);
    setPesanSukses(null);
    try {
      // Cari batch yang lolos QC
      const batchLolos = daftarBatch.find((b) => b.status === "lolos_qc") || daftarBatch[0];
      if (!batchLolos) {
        throw new Error("Belum ada batch masakan yang lolos pemeriksaan mutu (QC).");
      }
      const res = await fetch(`/api/v1/kitchen/portion-labels/${label.id}/ready`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchProduksiId: batchLolos.id, suhuKemasanCelsius: 63.0 }),
      });
      const json = (await res.json()) as ResponsApi<ItemLabelPorsiPasienDto>;
      if (!res.ok || !json.sukses) {
        throw new Error((!json.sukses ? json.galat.pesan : undefined) ?? "Gagal menyiapkan porsi distribusi.");
      }
      setPesanSukses(`Porsi ${json.data.nomorLabel} untuk ${json.data.namaPasien} siap diserahkan ke Petugas Distribusi.`);
      await muatSemuaData();
    } catch (err) {
      setPesanGalat(err instanceof Error ? err.message : "Terjadi kesalahan saat menyiapkan porsi.");
    } finally {
      setMemuatData(false);
    }
  };

  // Handler: Tahan Porsi Pasien (Perubahan Klinis AB-010, AB-013)
  const tanganiSimpanTahanPorsi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!labelTahanTerpilih) return;
    if (alasanTahanInput.length < 5) {
      setPesanGalat("Alasan penahanan pesanan porsi wajib diisi minimal 5 karakter (AB-010).");
      return;
    }
    setSedangSimpanTahan(true);
    setPesanGalat(null);
    setPesanSukses(null);
    try {
      const res = await fetch(`/api/v1/kitchen/portion-labels/${labelTahanTerpilih.id}/hold`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alasanPenahanan: alasanTahanInput }),
      });
      const json = (await res.json()) as ResponsApi<ItemLabelPorsiPasienDto>;
      if (!res.ok || !json.sukses) {
        throw new Error((!json.sukses ? json.galat.pesan : undefined) ?? "Gagal menahan porsi pasien.");
      }
      setPesanSukses(`Pesanan porsi ${json.data.nomorLabel} (${json.data.namaPasien}) berhasil DITAHAN PERUBAHAN KLINIS.`);
      setModalTahanBuka(false);
      setLabelTahanTerpilih(null);
      await muatSemuaData();
    } catch (err) {
      setPesanGalat(err instanceof Error ? err.message : "Terjadi kesalahan saat menahan porsi.");
    } finally {
      setSedangSimpanTahan(false);
    }
  };

  // Handler: Lepas Penahanan Porsi (AB-013)
  const tanganiLepasPenahanan = async (labelId: string) => {
    setMemuatData(true);
    setPesanGalat(null);
    setPesanSukses(null);
    try {
      const res = await fetch(`/api/v1/kitchen/portion-labels/${labelId}/release`, {
        method: "POST",
      });
      const json = (await res.json()) as ResponsApi<ItemLabelPorsiPasienDto>;
      if (!res.ok || !json.sukses) {
        throw new Error((!json.sukses ? json.galat.pesan : undefined) ?? "Gagal melepas penahanan porsi.");
      }
      setPesanSukses(`Penahanan porsi ${json.data.nomorLabel} (${json.data.namaPasien}) berhasil dilepas.`);
      await muatSemuaData();
    } catch (err) {
      setPesanGalat(err instanceof Error ? err.message : "Terjadi kesalahan saat melepas penahanan.");
    } finally {
      setMemuatData(false);
    }
  };

  // Handler: Cari Ketertelusuran Lot (Traceability Recall BRD 8.6)
  const tanganiCariTraceability = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCariLot) return;
    setSedangTrace(true);
    setPesanGalat(null);
    try {
      const res = await fetch(`/api/v1/kitchen/traceability/lots/${encodeURIComponent(inputCariLot.trim())}`);
      const json = (await res.json()) as ResponsApi<{
        nomorLot: string;
        batchTerdampak: ItemBatchProduksiDto[];
        porsiTerdampak: ItemLabelPorsiPasienDto[];
      }>;
      if (!res.ok || !json.sukses) {
        throw new Error((!json.sukses ? json.galat.pesan : undefined) ?? "Gagal menelusuri nomor lot bahan.");
      }
      setHasilTrace(json.data);
    } catch (err) {
      setPesanGalat(err instanceof Error ? err.message : "Gagal menelusuri nomor lot.");
    } finally {
      setSedangTrace(false);
    }
  };

  if (sedangMemuatSesi) {
    return (
      <LoadingState
        judul="Memuat Ruang Kerja Petugas Dapur..."
        deskripsi="Memverifikasi hak akses dan memuat modul produksi makanan."
      />
    );
  }

  if (
    !profil ||
    (profil.peran !== "petugas_dapur" &&
      profil.peran !== "administrator" &&
      !profil.daftarIzin.includes("dapur:produksi:kelola"))
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white p-6 rounded-lg shadow-sm border border-slate-200 text-center space-y-4">
          <PermissionDeniedState
            pesan="Akses Terbatas: Khusus Petugas Dapur (Chef)."
            detailKonteks="Sesuai Aturan Keselamatan AB-032, perencanaan produksi, batch cooking CCP, uji mutu akhir, dan pelabelan porsi makanan memerlukan wewenang Petugas Dapur."
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
      judulHalaman="Dapur Pengolahan & Pengendalian Makanan"
      subjudulHalaman="Perencanaan produksi H-1, pemantauan suhu masak CCP, kontrol mutu organoleptik, penahanan pesanan klinis, dan pelabelan porsi pasien."
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
        {/* Banner Pesan Sukses / Galat */}
        {pesanSukses && (
          <MinimalToastBanner
            pesan={pesanSukses}
            jenis="berhasil"
            onTutup={() => setPesanSukses(null)}
          />
        )}
        {pesanGalat && (
          <SafetyHoldBanner
            judul="Peringatan Keselamatan Produksi Dapur"
            alasanPenahanan={pesanGalat}
            tindakLanjutWajib="Periksa kembali instruksi diet, status QC organoleptik/suhu, atau alasan penahanan klinis."
          />
        )}

        {/* Safety Hold Banner jika ada pesanan ditahan klinis */}
        {(overview?.totalPesananDitahanKlinis ?? 0) > 0 && (
          <SafetyHoldBanner
            judul={`${overview?.totalPesananDitahanKlinis} Pesanan Porsi Ditahan Akibat Perubahan Diet Klinis (AB-010, AB-013)`}
            alasanPenahanan="Terdapat pasien rawat inap yang mengalami perubahan instruksi diet DPJP, larangan puasa (NPO), atau rujukan alergi baru. Makanan dilarang diporsikan atau dialirkan ke petugas distribusi sebelum penyesuaian diverifikasi aman."
            tindakLanjutWajib="Verifikasi perubahan diet terkini bersama DPJP/Dietisien sebelum melepas status penahanan porsi."
          />
        )}

        {/* 4 Kartu Metrik Operasional Dapur */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border rounded-xl p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Rencana Produksi H-1
              </p>
              <h3 className="text-2xl font-bold mt-1">
                {overview?.totalRencanaH1 ?? daftarRencana.length}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Estimasi porsi reguler terkoordinasi
              </p>
            </div>
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
              <CalendarDays className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-card border rounded-xl p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Batch Memasak Aktif
              </p>
              <h3 className="text-2xl font-bold mt-1 text-amber-600">
                {overview?.totalBatchMemasak ?? daftarBatch.length}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Pengawasan suhu inti CCP &ge; 75 &deg;C
              </p>
            </div>
            <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center text-amber-600">
              <Flame className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-card border rounded-xl p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Porsi Siap Distribusi
              </p>
              <h3 className="text-2xl font-bold mt-1 text-emerald-600">
                {overview?.totalPorsiSiapDistribusi ?? daftarLabel.filter((l) => l.statusPorsi === "siap_distribusi").length}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Label tervalidasi & lolos QC
              </p>
            </div>
            <div className="w-12 h-12 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-600">
              <PackageCheck className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-card border rounded-xl p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Pesanan Ditahan Klinis
              </p>
              <h3 className="text-2xl font-bold mt-1 text-destructive">
                {overview?.totalPesananDitahanKlinis ?? daftarLabel.filter((l) => l.statusPorsi === "ditahan_perubahan_klinis").length}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Blokade fail-closed perubahan diet (AB-010)
              </p>
            </div>
            <div className="w-12 h-12 bg-destructive/10 rounded-lg flex items-center justify-center text-destructive">
              <ShieldAlert className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Tab Navigasi Dapur */}
        <div className="border-b flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            onClick={() => setTabAktif("rencana")}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              tabAktif === "rencana"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            Rencana Produksi H-1 ({daftarRencana.length})
          </button>

          <button
            type="button"
            onClick={() => setTabAktif("batch")}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              tabAktif === "batch"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Flame className="w-4 h-4" />
            Batch Memasak & CCP ({daftarBatch.length})
          </button>

          <button
            type="button"
            onClick={() => setTabAktif("qc")}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              tabAktif === "qc"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Pemeriksaan Mutu Akhir ({daftarQC.length})
          </button>

          <button
            type="button"
            onClick={() => setTabAktif("porsi")}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              tabAktif === "porsi"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Tag className="w-4 h-4" />
            Label Porsi Pasien ({daftarLabel.length})
          </button>

          <button
            type="button"
            onClick={() => setTabAktif("telusur")}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              tabAktif === "telusur"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <QrCode className="w-4 h-4" />
            Ketertelusuran Bahan (Recall Traceability)
          </button>
        </div>

        {/* TAB 1: RENCANA PRODUKSI H-1 */}
        {tabAktif === "rencana" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => {
                    setTanggalPelayananInput("");
                    setCatatanRencanaInput("");
                    setModalRencanaBuka(true);
                  }}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Buat Rencana H-1 Baru
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
                <span className="text-xs text-muted-foreground">Filter Sesi:</span>
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
                <span className="text-xs text-muted-foreground ml-2">Filter Status:</span>
                <select
                  value={filterStatusRencana}
                  onChange={(e) => setFilterStatusRencana(e.target.value)}
                  className="border rounded-md px-2.5 py-1 text-xs bg-background"
                >
                  <option value="SEMUA">Semua Status</option>
                  <option value="draft">Draft</option>
                  <option value="disetujui">Disetujui</option>
                  <option value="selesai">Selesai</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {daftarRencana
                .filter((r) =>
                  filterStatusRencana === "SEMUA" ? true : r.status === filterStatusRencana,
                )
                .filter((r) =>
                  filterSesi === "SEMUA" ? true : r.sesiMakan === filterSesi,
                )
                .map((rencana) => (
                  <div key={rencana.id} className="border rounded-xl p-4 bg-card shadow-sm space-y-3">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-base">{rencana.nomorRencana}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                              rencana.status === "disetujui"
                                ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20"
                                : "bg-amber-500/10 text-amber-700 border border-amber-500/20"
                            }`}
                          >
                            {rencana.status}
                          </span>
                          <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-medium uppercase">
                            Sesi {rencana.sesiMakan}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Tanggal Pelayanan: <strong className="text-foreground">{rencana.tanggalPelayanan}</strong> | Penanggung Jawab: {rencana.penanggungJawabNama}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {rencana.status === "draft" && (
                          <Button
                            size="sm"
                            onClick={() => tanganiSahkanRencana(rencana.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 text-xs"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Sahkan Rencana (AB-012)
                          </Button>
                        )}
                        <span className="text-xs bg-muted px-2 py-1 rounded">
                          Total Estimasi: <strong>{rencana.totalEstimasiPorsi} Porsi</strong>
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">{rencana.catatan}</p>

                    {/* Rincian Kalkulasi Kebutuhan Bahan (AB-014) */}
                    <div>
                      <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2 flex items-center gap-1.5">
                        <UtensilsCrossed className="w-3.5 h-3.5" />
                        Kalkulasi Kebutuhan Bahan Mentah Otomatis (AB-014)
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {rencana.kebutuhanBahan.map((bhn) => (
                          <div
                            key={bhn.bahanId}
                            className="border rounded-lg p-2.5 bg-muted/30 text-xs flex justify-between items-center"
                          >
                            <div>
                              <p className="font-semibold">{bhn.namaBahan}</p>
                              <p className="text-muted-foreground text-[11px]">
                                Butuh: <strong>{bhn.jumlahDibutuhkan} {bhn.satuan}</strong>
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-700 font-medium">
                                Stok: {bhn.stokTersediaGudang} {bhn.satuan}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* TAB 2: BATCH MEMASAK & CCP */}
        {tabAktif === "batch" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => {
                    setRencanaIdPilihan("");
                    setResepPilihan("");
                    setNamaMasakanInput("");
                    setTargetPorsiInput("");
                    setChefInput("");
                    setBahanIdInput("");
                    setNamaBahanInput("");
                    setJumlahBahanInput("");
                    setSatuanBahanInput("");
                    setNomorLotBahanInput("");
                    void bukaModalBatch();
                  }}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2 text-sm"
                >
                  <Flame className="w-4 h-4" />
                  Mulai Batch Memasak Baru
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
                <span className="text-xs text-muted-foreground">Filter Status:</span>
                <select
                  value={filterStatusBatch}
                  onChange={(e) => setFilterStatusBatch(e.target.value)}
                  className="border rounded-md px-2.5 py-1 text-xs bg-background"
                >
                  <option value="SEMUA">Semua Status</option>
                  <option value="memasak">Sedang Memasak</option>
                  <option value="selesai_masak">Selesai Masak</option>
                  <option value="lolos_qc">Lolos QC</option>
                  <option value="gagal_qc">Gagal QC</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {daftarBatch
                .filter((b) =>
                  filterStatusBatch === "SEMUA" ? true : b.status === filterStatusBatch,
                )
                .map((batch) => (
                  <div key={batch.id} className="border rounded-xl p-4 bg-card shadow-sm space-y-3">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-base">{batch.nomorBatch}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                              batch.status === "lolos_qc"
                                ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20"
                                : batch.status === "gagal_qc"
                                  ? "bg-destructive/10 text-destructive border border-destructive/20"
                                  : "bg-amber-500/10 text-amber-700 border border-amber-500/20"
                            }`}
                          >
                            {batch.status}
                          </span>
                          <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-medium uppercase">
                            Sesi {batch.sesiMakan}
                          </span>
                        </div>
                        <h4 className="font-semibold text-sm mt-0.5 text-foreground">{batch.namaMasakan}</h4>
                        <p className="text-xs text-muted-foreground">
                          Koki: <strong>{batch.chefPenanggungJawab}</strong> | Target: <strong>{batch.jumlahPorsiTarget} Porsi</strong> | Realisasi: <strong>{batch.jumlahPorsiRealisasi} Porsi</strong>
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {batch.suhuMasakCcpCelsius !== null ? (
                          <div
                            className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 ${
                              batch.suhuMasakCcpCelsius >= 75
                                ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/30"
                                : "bg-destructive/10 text-destructive border border-destructive/30"
                            }`}
                          >
                            <Thermometer className="w-3.5 h-3.5" />
                            Suhu CCP: {batch.suhuMasakCcpCelsius} °C {batch.suhuMasakCcpCelsius >= 75 ? "✓ Aman" : "⚠ Kritis"}
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => {
                              setBatchCcpTerpilih(batch);
                              setSuhuCcpInput("");
                              setCatatanCcpInput("");
                              setModalCcpBuka(true);
                            }}
                            className="bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5 text-xs"
                          >
                            <Thermometer className="w-3.5 h-3.5" />
                            Catat Suhu CCP (AB-019)
                          </Button>
                        )}

                        {batch.status === "selesai_masak" && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setBatchQcTerpilih(batch);
                              setSuhuSajiInput("");
                              setUjiTeksturInput("");
                              setUjiAromaInput("");
                              setUjiRasaInput("");
                              setUjiVisualInput("");
                              setStatusMutuInput("");
                              setCatatanQcInput("");
                              setModalQcBuka(true);
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 text-xs"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Uji Mutu Akhir (QC)
                          </Button>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground italic">&ldquo;{batch.catatanKoki}&rdquo;</p>

                    {/* Lot Bahan Gudang Terlacak (AB-018) */}
                    <div>
                      <h5 className="text-[11px] font-semibold uppercase text-muted-foreground tracking-wider mb-1 flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        Ketertelusuran Lot Bahan Gudang Terpakai (AB-018)
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {batch.lotBahanDigunakan.map((lot, idx) => (
                          <span
                            key={idx}
                            className="text-xs bg-muted px-2 py-1 rounded border flex items-center gap-1 font-mono"
                          >
                            <strong>{lot.nomorLot}</strong> ({lot.namaBahan}: {lot.jumlahDigunakan} {lot.satuan})
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* TAB 3: PEMERIKSAAN MUTU AKHIR */}
        {tabAktif === "qc" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-base">Riwayat Pemeriksaan Mutu Akhir & Organoleptik</h3>
                <p className="text-xs text-muted-foreground">
                  Pemeriksaan suhu saji, tekstur makanan, aroma, rasa, dan tampilan visual sebelum pengepakan (AB-019, AB-022).
                </p>
              </div>
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

            <div className="grid grid-cols-1 gap-3">
              {daftarQC.map((qc) => (
                <div key={qc.id} className="border rounded-xl p-4 bg-card shadow-sm space-y-2">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b pb-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{qc.nomorBatch}</span>
                        <span className="text-sm font-semibold">{qc.namaMasakan}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                            qc.statusMutu === "lolos_pemeriksaan"
                              ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20"
                              : "bg-destructive/10 text-destructive border border-destructive/20"
                          }`}
                        >
                          {qc.statusMutu === "lolos_pemeriksaan" ? "Lolos QC (Aman)" : "Ditahan Gagal Mutu (AB-022)"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Pemeriksa: <strong>{qc.pemeriksaNama}</strong> | Waktu: {new Date(qc.waktuPemeriksaan).toLocaleTimeString("id-ID")}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="px-2 py-1 rounded text-xs bg-muted font-medium">
                        Suhu Saji: <strong>{qc.suhuSajiCelsius} °C</strong>
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2 bg-muted/30 rounded border">
                      <span className="text-muted-foreground block text-[11px]">Uji Tekstur:</span>
                      <strong className={qc.ujiTekstur === "sesuai" ? "text-emerald-700" : "text-destructive"}>
                        {qc.ujiTekstur.toUpperCase()}
                      </strong>
                    </div>
                    <div className="p-2 bg-muted/30 rounded border">
                      <span className="text-muted-foreground block text-[11px]">Uji Aroma:</span>
                      <strong className={qc.ujiAroma === "normal_segar" ? "text-emerald-700" : "text-destructive"}>
                        {qc.ujiAroma.toUpperCase()}
                      </strong>
                    </div>
                    <div className="p-2 bg-muted/30 rounded border">
                      <span className="text-muted-foreground block text-[11px]">Uji Rasa:</span>
                      <strong className={qc.ujiRasa === "sesuai_standar" ? "text-emerald-700" : "text-destructive"}>
                        {qc.ujiRasa.toUpperCase()}
                      </strong>
                    </div>
                    <div className="p-2 bg-muted/30 rounded border">
                      <span className="text-muted-foreground block text-[11px]">Tampilan Visual:</span>
                      <strong className={qc.ujiTampilanVisual === "bersih_menarik" ? "text-emerald-700" : "text-destructive"}>
                        {qc.ujiTampilanVisual.toUpperCase()}
                      </strong>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground italic bg-muted/10 p-2 rounded">
                    Catatan: &ldquo;{qc.catatanPemeriksaan}&rdquo;
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: LABEL PORSI PASIEN & PENGEPAKAN */}
        {tabAktif === "porsi" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="font-semibold text-base">Pengepakan & Pelabelan Porsi Makanan Pasien</h3>
                <p className="text-xs text-muted-foreground">
                  Label porsi pasien dengan identitas aman, jadwal makan, bentuk makanan, instruksi diet, dan alergen (BRD 8.5).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Filter Status:</span>
                <select
                  value={filterStatusPorsi}
                  onChange={(e) => setFilterStatusPorsi(e.target.value)}
                  className="border rounded-md px-2.5 py-1 text-xs bg-background"
                >
                  <option value="SEMUA">Semua Status</option>
                  <option value="terencana">Terencana</option>
                  <option value="siap_kemas">Siap Kemas</option>
                  <option value="siap_distribusi">Siap Distribusi</option>
                  <option value="ditahan_perubahan_klinis">Ditahan Perubahan Klinis (AB-010)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {daftarLabel
                .filter((l) =>
                  filterStatusPorsi === "SEMUA" ? true : l.statusPorsi === filterStatusPorsi,
                )
                .map((lbl) => (
                  <div
                    key={lbl.id}
                    className={`border rounded-xl p-4 bg-card shadow-sm space-y-3 relative ${
                      lbl.statusPorsi === "ditahan_perubahan_klinis"
                        ? "border-destructive/60 bg-destructive/5"
                        : ""
                    }`}
                  >
                    <div className="flex justify-between items-start border-b pb-2.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm">{lbl.nomorLabel}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                              lbl.statusPorsi === "siap_distribusi"
                                ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20"
                                : lbl.statusPorsi === "ditahan_perubahan_klinis"
                                  ? "bg-destructive text-destructive-foreground font-bold"
                                  : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {lbl.statusPorsi === "ditahan_perubahan_klinis"
                              ? "DITAHAN KLINIS (AB-010)"
                              : lbl.statusPorsi.replace(/_/g, " ")}
                          </span>
                        </div>
                        <h4 className="font-bold text-base mt-1 text-foreground">{lbl.namaPasien}</h4>
                        <p className="text-xs text-muted-foreground font-mono">
                          {lbl.nomorRm} | {lbl.bangsalKamarBed}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-semibold uppercase block">
                          Sesi {lbl.sesiMakan}
                        </span>
                        <span className="text-[11px] text-muted-foreground block mt-1">
                          {lbl.tanggalPelayanan}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div>
                        <span className="text-muted-foreground">Menu: </span>
                        <strong>{lbl.namaMenu}</strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Bentuk Makanan: </span>
                        <span className="bg-muted px-1.5 py-0.5 rounded font-medium">
                          {lbl.bentukMakanan.replace(/_/g, " ").toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Instruksi Diet: </span>
                        <span className="text-blue-700 font-semibold">{lbl.jenisDiet}</span>
                      </div>
                      <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-800 text-[11px]">
                        <strong>Peringatan Alergi / Restriksi:</strong> {lbl.informasiAlergen}
                      </div>

                      {lbl.statusPorsi === "ditahan_perubahan_klinis" && (
                        <div className="p-2.5 rounded bg-destructive/10 border border-destructive/30 text-destructive text-xs space-y-1">
                          <p className="font-bold flex items-center gap-1.5">
                            <ShieldAlert className="w-4 h-4" />
                            ALASAN PENAHANAN KESELAMATAN (AB-010, AB-013):
                          </p>
                          <p className="italic">&ldquo;{lbl.alasanPenahanan}&rdquo;</p>
                        </div>
                      )}
                    </div>

                    {/* Tombol Aksi Porsi */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t text-xs">
                      <div className="text-muted-foreground text-[11px]">
                        Batch: <strong className="font-mono">{lbl.nomorBatch ?? "Belum diikat"}</strong>
                      </div>

                      <div className="flex items-center gap-2">
                        {lbl.statusPorsi === "ditahan_perubahan_klinis" ? (
                          <Button
                            size="sm"
                            onClick={() => tanganiLepasPenahanan(lbl.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
                          >
                            Lepas Penahanan (AB-013)
                          </Button>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setLabelTahanTerpilih(lbl);
                                setModalTahanBuka(true);
                              }}
                              className="text-xs h-8"
                            >
                              Tahan (Perubahan Klinis)
                            </Button>

                            {lbl.statusPorsi !== "siap_distribusi" && (
                              <Button
                                size="sm"
                                onClick={() => tanganiSiapkanPorsi(lbl)}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-8 flex items-center gap-1.5"
                              >
                                <PackageCheck className="w-3.5 h-3.5" />
                                Siapkan Distribusi
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* TAB 5: KETERTELUSURAN BAHAN (RECALL TRACEABILITY BRD 8.6) */}
        {tabAktif === "telusur" && (
          <div className="space-y-4">
            <div className="border rounded-xl p-4 bg-card shadow-sm space-y-3">
              <div>
                <h3 className="font-semibold text-base flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-primary" />
                  Pencarian Ketertelusuran Bahan Baku (Recall Traceability BRD 8.6)
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Masukkan nomor lot bahan baku gudang untuk melacak seluruh batch memasak dan pasien rawat inap yang mengonsumsi bahan tersebut.
                </p>
              </div>

              <form onSubmit={tanganiCariTraceability} className="flex gap-2 max-w-md">
                <input
                  type="text"
                  value={inputCariLot}
                  onChange={(e) => setInputCariLot(e.target.value)}
                  placeholder="Contoh: LOT-20261109-002"
                  className="flex-1 border rounded-md px-3 py-1.5 text-sm bg-background font-mono"
                  required
                />
                <Button type="submit" disabled={sedangTrace} className="text-xs">
                  {sedangTrace ? "Mencari..." : "Lacak Lot (Recall)"}
                </Button>
              </form>
            </div>

            {hasilTrace && (
              <div className="border rounded-xl p-4 bg-card shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <h4 className="font-bold text-sm">
                    Hasil Ketertelusuran untuk Nomor Lot: <span className="font-mono text-primary">{hasilTrace.nomorLot}</span>
                  </h4>
                  <span className="text-xs text-muted-foreground">
                    {hasilTrace.batchTerdampak.length} Batch Terdampak | {hasilTrace.porsiTerdampak.length} Porsi Pasien
                  </span>
                </div>

                {/* Batch Terdampak */}
                <div>
                  <h5 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                    Batch Memasak Terkait:
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {hasilTrace.batchTerdampak.map((b) => (
                      <div key={b.id} className="border rounded-lg p-2.5 bg-muted/20 text-xs space-y-1">
                        <p className="font-bold">{b.nomorBatch} - {b.namaMasakan}</p>
                        <p className="text-muted-foreground">Status: <strong>{b.status}</strong> | Koki: {b.chefPenanggungJawab}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pasien Terdampak */}
                <div>
                  <h5 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                    Porsi Pasien Penerima (Terdampak):
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {hasilTrace.porsiTerdampak.map((p) => (
                      <div key={p.id} className="border rounded-lg p-2.5 bg-muted/20 text-xs space-y-1">
                        <p className="font-bold">{p.namaPasien} ({p.nomorRm})</p>
                        <p className="text-muted-foreground">{p.bangsalKamarBed} | Menu: {p.namaMenu}</p>
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary font-medium">
                          Status Porsi: {p.statusPorsi}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODAL 1: BUAT RENCANA PRODUKSI H-1 */}
        {modalRencanaBuka && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-card border rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-base flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-primary" />
                  Buat Rencana Produksi Reguler H-1
                </h3>
                <button
                  type="button"
                  onClick={() => setModalRencanaBuka(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={tanganiBuatRencana} className="space-y-4 text-xs">
                <div>
                  <label className="block font-medium mb-1">Tanggal Pelayanan (Hari H):</label>
                  <input
                    type="date"
                    value={tanggalPelayananInput}
                    onChange={(e) => setTanggalPelayananInput(e.target.value)}
                    className="w-full border rounded-md px-3 py-1.5 bg-background text-sm"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Rencana dipersiapkan H-1 untuk pelayanan hari esok (AB-012).
                  </p>
                </div>

                <div>
                  <label className="block font-medium mb-1">Sesi Makan:</label>
                  <select
                    value={sesiRencanaInput}
                    onChange={(e) => setSesiRencanaInput(e.target.value as SesiMakanDapur)}
                    className="w-full border rounded-md px-3 py-1.5 bg-background text-sm"
                  >
                    <option value="pagi">Pagi (Sarapan)</option>
                    <option value="siang">Siang (Makan Siang Utama)</option>
                    <option value="malam">Malam (Makan Malam)</option>
                    <option value="snack_pagi">Snack Pagi</option>
                    <option value="snack_sore">Snack Sore</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium mb-1">Catatan Operasional Rencana:</label>
                  <textarea
                    rows={2}
                    placeholder="Alasan wajib untuk produksi mendadak pada hari pelayanan"
                    value={catatanRencanaInput}
                    onChange={(e) => setCatatanRencanaInput(e.target.value)}
                    className="w-full border rounded-md px-3 py-1.5 bg-background text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setModalRencanaBuka(false)}
                  >
                    Batal
                  </Button>
                  <Button type="submit" disabled={sedangSimpanRencana}>
                    {sedangSimpanRencana ? "Menyimpan..." : "Simpan Rencana H-1"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: CATAT BATCH MEMASAK BARU */}
        {modalBatchBuka && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-card border rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-base flex items-center gap-2">
                  <Flame className="w-5 h-5 text-amber-600" />
                  Mulai Batch Memasak Baru
                </h3>
                <button
                  type="button"
                  onClick={() => setModalBatchBuka(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={tanganiBuatBatch} className="space-y-4 text-xs">
                <div>
                  <label className="block font-medium mb-1">Pilih Rencana Produksi H-1:</label>
                  <select
                    value={rencanaIdPilihan}
                    onChange={(e) => setRencanaIdPilihan(e.target.value)}
                    className="w-full border rounded-md px-3 py-1.5 bg-background text-xs"
                    required
                  >
                    <option value="">Pilih rencana yang tersimpan</option>
                    {daftarRencana.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nomorRencana} ({r.tanggalPelayanan} - Sesi {r.sesiMakan})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium mb-1">Resep pada katalog:</label>
                    <select aria-label="Resep pada katalog" value={resepPilihan} onChange={(e) => { setResepPilihan(e.target.value); setNamaMasakanInput(resepDapur.find((r) => r.id === e.target.value)?.namaMenu ?? ""); }} className="w-full border rounded-md px-3 py-1.5 bg-background text-xs" required>
                      <option value="">Pilih resep yang tersimpan</option>{resepDapur.map((r) => <option key={r.id} value={r.id}>{r.namaMenu}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Sesi Makan:</label>
                    <select
                      value={sesiBatchInput}
                      onChange={(e) => setSesiBatchInput(e.target.value as SesiMakanDapur)}
                      className="w-full border rounded-md px-3 py-1.5 bg-background text-xs"
                    >
                      <option value="pagi">Pagi</option>
                      <option value="siang">Siang</option>
                      <option value="malam">Malam</option>
                      <option value="snack_pagi">Snack Pagi</option>
                      <option value="snack_sore">Snack Sore</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium mb-1">Nama Masakan / Batch:</label>
                    <input
                      type="text"
                      value={namaMasakanInput}
                      onChange={(e) => setNamaMasakanInput(e.target.value)}
                      className="w-full border rounded-md px-3 py-1.5 bg-background text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Target Jumlah Porsi:</label>
                    <input
                      type="number"
                      value={targetPorsiInput}
                      onChange={(e) => setTargetPorsiInput(e.target.value)}
                      min="1"
                      className="w-full border rounded-md px-3 py-1.5 bg-background text-xs"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium mb-1">Chef Penanggung Jawab:</label>
                    <input
                      type="text"
                      value={chefInput}
                      onChange={(e) => setChefInput(e.target.value)}
                      className="w-full border rounded-md px-3 py-1.5 bg-background text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Lot bahan yang dikeluarkan gudang:</label>
                    <select aria-label="Lot bahan yang sudah dikeluarkan gudang" value={nomorLotBahanInput} onChange={(e) => { const lot = lotDapur.find((l) => l.nomorLot === e.target.value); setNomorLotBahanInput(e.target.value); setBahanIdInput(lot?.bahanId ?? ""); setNamaBahanInput(lot?.namaBahan ?? ""); setSatuanBahanInput(lot?.satuan ?? ""); }} className="w-full border rounded-md px-3 py-1.5 bg-background text-xs" required={!lotTambahan.length}>
                      <option value="">Pilih lot bahan</option>{lotDapur.map((l) => <option key={l.nomorLot} value={l.nomorLot}>{l.namaBahan} ? {l.nomorLot} ? {l.jumlahTersedia} {l.satuan}</option>)}
                    </select>
                  </div>
                </div>
                <label className="block font-medium">Jumlah aktual terpakai ({satuanBahanInput || "satuan lot"})
                  <input aria-label="Jumlah bahan terpakai" type="number" min="0.001" step="any" value={jumlahBahanInput} onChange={(e) => setJumlahBahanInput(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-1.5 bg-background text-xs" required={Boolean(nomorLotBahanInput)} />
                </label>
                <Button type="button" variant="outline" onClick={() => { if (!nomorLotBahanInput || Number(jumlahBahanInput) <= 0) { setPesanGalat("Pilih lot dan jumlah aktual terlebih dahulu."); return; } setLotTambahan([...lotTambahan, { bahanId: bahanIdInput, namaBahan: namaBahanInput, nomorLot: nomorLotBahanInput, jumlahDigunakan: Number(jumlahBahanInput), satuan: satuanBahanInput }]); setNomorLotBahanInput(""); setJumlahBahanInput(""); }}>Tambahkan lot ke batch</Button>
                <ul className="space-y-2">{lotTambahan.map((lot, index) => <li key={index} className="flex items-center justify-between gap-2 rounded-md bg-slate-50 p-2"><span>{lot.namaBahan} ? {lot.nomorLot} ? {lot.jumlahDigunakan} {lot.satuan}</span><Button type="button" variant="ghost" onClick={() => setLotTambahan(lotTambahan.filter((_, i) => i !== index))}>Hapus</Button></li>)}</ul>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setModalBatchBuka(false)}
                  >
                    Batal
                  </Button>
                  <Button type="submit" disabled={sedangSimpanBatch}>
                    {sedangSimpanBatch ? "Memulai..." : "Mulai Memasak"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 3: CATAT SUHU CCP INTI MEMASAK */}
        {modalCcpBuka && batchCcpTerpilih && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-card border rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-base flex items-center gap-2">
                  <Thermometer className="w-5 h-5 text-amber-600" />
                  Verifikasi Suhu Inti CCP ({batchCcpTerpilih.nomorBatch})
                </h3>
                <button
                  type="button"
                  onClick={() => setModalCcpBuka(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={tanganiSimpanCcp} className="space-y-4 text-xs">
                <div>
                  <label className="block font-medium mb-1">Suhu Masak Inti Terukur (°C):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={suhuCcpInput}
                    onChange={(e) => setSuhuCcpInput(e.target.value)}
                    className="w-full border rounded-md px-3 py-1.5 bg-background text-sm font-semibold"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Ambang batas minimum keamanan pangan rumah sakit: <strong>&ge; 75 &deg;C</strong>.
                  </p>
                </div>

                <div>
                  <label className="block font-medium mb-1">Catatan Koki / Verifikasi:</label>
                  <textarea
                    rows={2}
                    value={catatanCcpInput}
                    onChange={(e) => setCatatanCcpInput(e.target.value)}
                    placeholder="Catatan pengukuran atau verifikasi aktual"
                    className="w-full border rounded-md px-3 py-1.5 bg-background text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setModalCcpBuka(false)}
                  >
                    Batal
                  </Button>
                  <Button type="submit" disabled={sedangSimpanCcp}>
                    {sedangSimpanCcp ? "Menyimpan..." : "Simpan Suhu CCP"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 4: CATAT PEMERIKSAAN MUTU AKHIR (QC) */}
        {modalQcBuka && batchQcTerpilih && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-card border rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-base flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-blue-600" />
                  Pemeriksaan Mutu Akhir ({batchQcTerpilih.nomorBatch})
                </h3>
                <button
                  type="button"
                  onClick={() => setModalQcBuka(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={tanganiSimpanQc} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium mb-1">Suhu Saji Terukur (°C):</label>
                    <input
                      type="number"
                      step="0.1"
                      value={suhuSajiInput}
                      onChange={(e) => setSuhuSajiInput(e.target.value)}
                      className="w-full border rounded-md px-3 py-1.5 bg-background text-xs font-semibold"
                      required
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">Hangat: &gt; 60 °C</p>
                  </div>

                  <div>
                    <label className="block font-medium mb-1">Keputusan Status Mutu:</label>
                    <select
                      value={statusMutuInput}
                      onChange={(e) => setStatusMutuInput(e.target.value as "lolos_pemeriksaan" | "ditahan_gagal_mutu" | "")}
                      required
                      className={`w-full border rounded-md px-3 py-1.5 text-xs font-semibold ${
                        statusMutuInput === "lolos_pemeriksaan"
                          ? "bg-emerald-500/10 text-emerald-800"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      <option value="" disabled>Pilih hasil pemeriksaan</option>
                      <option value="lolos_pemeriksaan">LOLOS PEMERIKSAAN (Siap Porsi)</option>
                      <option value="ditahan_gagal_mutu">DITAHAN GAGAL MUTU (AB-022)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium mb-1">Uji Tekstur:</label>
                    <select
                      value={ujiTeksturInput}
                      onChange={(e) => setUjiTeksturInput(e.target.value as "sesuai" | "tidak_sesuai" | "")}
                      className="w-full border rounded-md px-2.5 py-1.5 bg-background text-xs"
                      required
                    >
                      <option value="" disabled>Pilih hasil pemeriksaan</option>
                      <option value="sesuai">Sesuai Resep/Bentuk</option>
                      <option value="tidak_sesuai">Tidak Sesuai</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Uji Aroma:</label>
                    <select
                      value={ujiAromaInput}
                      onChange={(e) => setUjiAromaInput(e.target.value as "normal_segar" | "menyimpang" | "")}
                      className="w-full border rounded-md px-2.5 py-1.5 bg-background text-xs"
                      required
                    >
                      <option value="" disabled>Pilih hasil pemeriksaan</option>
                      <option value="normal_segar">Normal Segar</option>
                      <option value="menyimpang">Menyimpang</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium mb-1">Uji Rasa:</label>
                    <select
                      value={ujiRasaInput}
                      onChange={(e) => setUjiRasaInput(e.target.value as "sesuai_standar" | "tidak_sesuai" | "")}
                      className="w-full border rounded-md px-2.5 py-1.5 bg-background text-xs"
                      required
                    >
                      <option value="" disabled>Pilih hasil pemeriksaan</option>
                      <option value="sesuai_standar">Sesuai Standar Diet</option>
                      <option value="tidak_sesuai">Tidak Sesuai</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Tampilan Visual:</label>
                    <select
                      value={ujiVisualInput}
                      onChange={(e) => setUjiVisualInput(e.target.value as "bersih_menarik" | "kurang_baik" | "")}
                      className="w-full border rounded-md px-2.5 py-1.5 bg-background text-xs"
                      required
                    >
                      <option value="" disabled>Pilih hasil pemeriksaan</option>
                      <option value="bersih_menarik">Bersih & Menarik</option>
                      <option value="kurang_baik">Kurang Baik</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-medium mb-1">Catatan Pemeriksaan Organoleptik (min 5 karakter):</label>
                  <textarea
                    rows={2}
                    value={catatanQcInput}
                    onChange={(e) => setCatatanQcInput(e.target.value)}
                    className="w-full border rounded-md px-3 py-1.5 bg-background text-xs"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setModalQcBuka(false)}
                  >
                    Batal
                  </Button>
                  <Button type="submit" disabled={sedangSimpanQc}>
                    {sedangSimpanQc ? "Menyimpan..." : "Simpan Hasil QC"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 5: TAHAN PORSI KARENA PERUBAHAN KLINIS (AB-010, AB-013) */}
        {modalTahanBuka && labelTahanTerpilih && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-card border rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-base flex items-center gap-2 text-destructive">
                  <ShieldAlert className="w-5 h-5 text-destructive" />
                  Tahan Pesanan Porsi (AB-010, AB-013)
                </h3>
                <button
                  type="button"
                  onClick={() => setModalTahanBuka(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-1">
                <p>Pasien: <strong>{labelTahanTerpilih.namaPasien}</strong> ({labelTahanTerpilih.nomorRm})</p>
                <p>Lokasi: {labelTahanTerpilih.bangsalKamarBed}</p>
                <p>Label: <span className="font-mono">{labelTahanTerpilih.nomorLabel}</span></p>
              </div>

              <form onSubmit={tanganiSimpanTahanPorsi} className="space-y-4 text-xs">
                <div>
                  <label className="block font-medium mb-1">
                    Alasan Penahanan Klinis Wajib (min 5 karakter):
                  </label>
                  <textarea
                    rows={3}
                    value={alasanTahanInput}
                    onChange={(e) => setAlasanTahanInput(e.target.value)}
                    className="w-full border rounded-md px-3 py-1.5 bg-background text-xs"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Makanan yang ditahan otomatis dilarang untuk pemorsian dan dilarang dialirkan ke tahap distribusi (AB-022).
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
                    {sedangSimpanTahan ? "Menahan..." : "Tahan Pesanan Sekarang"}
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
