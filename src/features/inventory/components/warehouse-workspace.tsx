/**
 * @fileoverview Workspace antarmuka pengguna untuk Peran Petugas Gudang.
 * Mengimplementasikan:
 * 1. Manajemen katalog bahan baku & monitoring stok minimum / safety stock (BRD Bab VII.1).
 * 2. Penerimaan lot bahan baku dengan inspeksi mutu organoleptik & suhu (AB-015: bahan tidak layak dilarang untuk produksi).
 * 3. Alokasi stok bahan untuk permintaan dapur (AB-016: alokasi memindahkan stok layak ke dialokasikan tanpa memotong stok fisik).
 * 4. Pengeluaran aktual bahan secara FEFO/FIFO dengan pencatatan nomor lot terlacak (AB-017, AB-018).
 * 5. Stok opname fisik berkala dengan alasan wajib dan jejak audit mutasi (BRD Bab VII.6, AB-030).
 */

"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  Filter,
  History,
  PackageCheck,
  PackagePlus,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Snowflake,
  Sun,
  ThermometerSnowflake,
  Trash2,
  Utensils,
  X,
} from "lucide-react";
import { StatusBadge } from "@/components/atoms/status-badge";
import {
  LoadingState,
  MinimalToastBanner,
  PermissionDeniedState,
  SafetyHoldBanner,
} from "@/components/molecules/state-feedback";
import {
  DataTableFoundation,
  type DefinisiKolomTabel,
} from "@/components/organisms/data-table-foundation";
import { AppShellTemplate } from "@/components/templates/app-shell-template";
import { Button } from "@/components/ui/button";
import { useSesiAdmin } from "@/features/admin/hooks/use-sesi-admin";
import type {
  ItemKartuStokMutasiDto,
  ItemKatalogBahanDto,
  ItemPenerimaanLotDto,
  ItemPermintaanBahanDto,
  ResponsApi,
  StatusMutuPenerimaan,
} from "../../../../packages/shared-types/src/index.ts";

type TabGudang = "katalog" | "penerimaan" | "permintaan" | "opname";

export function WarehouseWorkspace() {
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

  const [tabAktif, setTabAktif] = useState<TabGudang>("katalog");
  const [kataKunciCari, setKataKunciCari] = useState("");
  const [halaman, setHalaman] = useState(1);
  const [memuatData, setMemuatData] = useState(false);
  const [pesanGalat, setPesanGalat] = useState<string | null>(null);
  const [pesanSukses, setPesanSukses] = useState<string | null>(null);

  // Data domain gudang
  const [daftarBahan, setDaftarBahan] = useState<ItemKatalogBahanDto[]>([]);
  const [daftarLot, setDaftarLot] = useState<ItemPenerimaanLotDto[]>([]);
  const [daftarPermintaan, setDaftarPermintaan] = useState<ItemPermintaanBahanDto[]>([]);
  const [kartuStok, setKartuStok] = useState<ItemKartuStokMutasiDto[]>([]);

  // Filter state
  const [filterKategori, setFilterKategori] = useState<string>("SEMUA");
  const [filterStatusStok, setFilterStatusStok] = useState<string>("SEMUA");
  const [filterSuhu, setFilterSuhu] = useState<string>("SEMUA");

  // Modal State: Penerimaan Lot Bahan
  const [modalLotBuka, setModalLotBuka] = useState(false);
  const [bahanTerpilihLot, setBahanTerpilihLot] = useState<string>("");
  const [pemasokInput, setPemasokInput] = useState<string>("");
  const [jumlahMasukInput, setJumlahMasukInput] = useState<number | "">("");
  const [tanggalTerimaInput, setTanggalTerimaInput] = useState<string>("");
  const [tanggalEdInput, setTanggalEdInput] = useState<string>("");
  const [statusMutuInput, setStatusMutuInput] = useState<StatusMutuPenerimaan>("layak_diterima");
  const [catatanMutuInput, setCatatanMutuInput] = useState<string>("");
  const [suhuCelsiusInput, setSuhuCelsiusInput] = useState<number | "">("");
  const [sedangSimpanLot, setSedangSimpanLot] = useState(false);

  // Modal State: Buat Permintaan Bahan Dapur
  const [modalPermintaanBuka, setModalPermintaanBuka] = useState(false);
  const [unitPemintaInput, setUnitPemintaInput] = useState<string>("Dapur Pengolahan Utama");
  const [keteranganReqInput, setKeteranganReqInput] = useState<string>("");
  const [bahanReqTerpilih, setBahanReqTerpilih] = useState<string>("");
  const [tanggalKebutuhanInput, setTanggalKebutuhanInput] = useState("");
  const [jumlahReqInput, setJumlahReqInput] = useState<number | "">("");
  const [sedangSimpanReq, setSedangSimpanReq] = useState(false);

  // Modal State: Stok Opname
  const [modalOpnameBuka, setModalOpnameBuka] = useState(false);
  const [bahanOpnameTerpilih, setBahanOpnameTerpilih] = useState<ItemKatalogBahanDto | null>(null);
  const [stokFisikAktualInput, setStokFisikAktualInput] = useState<number | "">("");
  const [alasanOpnameInput, setAlasanOpnameInput] = useState<string>("");
  const [sedangSimpanOpname, setSedangSimpanOpname] = useState(false);

  // Modal State: Pembuangan Lot
  const [modalDisposalBuka, setModalDisposalBuka] = useState(false);
  const [lotDisposalTerpilih, setLotDisposalTerpilih] = useState<ItemPenerimaanLotDto | null>(null);
  const [alasanDisposalInput, setAlasanDisposalInput] = useState<string>("");
  const [sedangProsesDisposal, setSedangProsesDisposal] = useState(false);

  // Muat data gudang dari backend
  const muatSemuaData = async () => {
    setMemuatData(true);
    setPesanGalat(null);
    try {
      const [resBahan, resLot, resReq, resLedger] = await Promise.all([
        fetch("/api/v1/inventory/items"),
        fetch("/api/v1/inventory/lots"),
        fetch("/api/v1/inventory/requests"),
        fetch("/api/v1/inventory/ledger"),
      ]);

      if (resBahan.ok) {
        const jsonBahan = (await resBahan.json()) as ResponsApi<{ items: ItemKatalogBahanDto[] }>;
        if (jsonBahan.sukses) {
          setDaftarBahan(jsonBahan.data.items);
          if (jsonBahan.data.items.length > 0 && !bahanTerpilihLot) {
            setBahanTerpilihLot(jsonBahan.data.items[0].id);
            setBahanReqTerpilih(jsonBahan.data.items[0].id);
          }
        }
      }

      if (resLot.ok) {
        const jsonLot = (await resLot.json()) as ResponsApi<{ items: ItemPenerimaanLotDto[] }>;
        if (jsonLot.sukses) {
          setDaftarLot(jsonLot.data.items);
        }
      }

      if (resReq.ok) {
        const jsonReq = (await resReq.json()) as ResponsApi<{ items: ItemPermintaanBahanDto[] }>;
        if (jsonReq.sukses) {
          setDaftarPermintaan(jsonReq.data.items);
        }
      }

      if (resLedger.ok) {
        const jsonLedger = (await resLedger.json()) as ResponsApi<{ items: ItemKartuStokMutasiDto[] }>;
        if (jsonLedger.sukses) {
          setKartuStok(jsonLedger.data.items);
        }
      }
    } catch {
      setPesanGalat("Gagal memuat data inventaris dari server.");
    } finally {
      setMemuatData(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void muatSemuaData();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handler: Simpan Penerimaan Lot Baru (AB-015)
  const tanganiSimpanLot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bahanTerpilihLot || !jumlahMasukInput || Number(jumlahMasukInput) <= 0) {
      setPesanGalat("Pilih bahan baku dan masukkan jumlah masuk yang valid (> 0).");
      return;
    }
    setSedangSimpanLot(true);
    setPesanGalat(null);
    setPesanSukses(null);

    try {
      const payload = {
        bahanId: bahanTerpilihLot,
        namaPemasok: pemasokInput,
        jumlahMasuk: Number(jumlahMasukInput),
        tanggalPenerimaan: tanggalTerimaInput,
        tanggalKedaluwarsa: tanggalEdInput,
        statusMutu: statusMutuInput,
        catatanPemeriksaan: catatanMutuInput,
        suhuTercatatCelsius: suhuCelsiusInput !== "" ? Number(suhuCelsiusInput) : null,
      };

      const res = await fetch("/api/v1/inventory/lots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await res.json()) as ResponsApi<ItemPenerimaanLotDto>;
      if (!res.ok || !json.sukses) {
        throw new Error((!json.sukses ? json.galat.pesan : undefined) ?? "Perekaman penerimaan lot gagal.");
      }

      setPesanSukses(
        `Lot ${json.data.nomorLot} untuk bahan '${json.data.namaBahan}' (${json.data.jumlahMasuk} ${json.data.satuan}) berhasil dicatat. Status mutu: ${json.data.statusMutu}.`,
      );
      setModalLotBuka(false);
      setPemasokInput("");
      setJumlahMasukInput("");
      setCatatanMutuInput("");
      setSuhuCelsiusInput("");
      await muatSemuaData();
    } catch (err) {
      setPesanGalat(err instanceof Error ? err.message : "Terjadi kesalahan saat mencatat lot.");
    } finally {
      setSedangSimpanLot(false);
    }
  };

  // Handler: Alokasikan Stok Permintaan Dapur (AB-016)
  const tanganiAlokasiPermintaan = async (reqId: string) => {
    setMemuatData(true);
    setPesanGalat(null);
    setPesanSukses(null);
    try {
      const res = await fetch(`/api/v1/inventory/requests/${reqId}/allocate`, {
        method: "POST",
      });
      const json = (await res.json()) as ResponsApi<ItemPermintaanBahanDto>;
      if (!res.ok || !json.sukses) {
        throw new Error((!json.sukses ? json.galat.pesan : undefined) ?? "Gagal mengalokasikan stok bahan.");
      }
      setPesanSukses(
        `Permintaan ${json.data.nomorPermintaan} berhasil dialokasikan. Stok layak direservasi untuk dapur.`,
      );
      await muatSemuaData();
    } catch (err) {
      setPesanGalat(err instanceof Error ? err.message : "Terjadi kesalahan saat mengalokasikan stok.");
    } finally {
      setMemuatData(false);
    }
  };

  // Handler: Pengeluaran Aktual Bahan FEFO (AB-017, AB-018)
  const tanganiPengeluaranPermintaan = async (reqId: string) => {
    setMemuatData(true);
    setPesanGalat(null);
    setPesanSukses(null);
    try {
      const res = await fetch(`/api/v1/inventory/requests/${reqId}/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ catatanPengeluaran: "Pengeluaran FEFO diserahkan fisik ke juru masak dapur." }),
      });
      const json = (await res.json()) as ResponsApi<ItemPermintaanBahanDto>;
      if (!res.ok || !json.sukses) {
        throw new Error((!json.sukses ? json.galat.pesan : undefined) ?? "Gagal mengeluarkan bahan baku.");
      }
      setPesanSukses(
        `Bahan untuk permintaan ${json.data.nomorPermintaan} berhasil dikeluarkan secara FEFO. Stok fisik telah dipotong dan dicatat pada kartu stok.`,
      );
      await muatSemuaData();
    } catch (err) {
      setPesanGalat(err instanceof Error ? err.message : "Terjadi kesalahan saat mengeluarkan bahan.");
    } finally {
      setMemuatData(false);
    }
  };

  // Handler: Buat Permintaan Bahan Dapur
  const tanganiBuatPermintaan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bahanReqTerpilih || !jumlahReqInput || Number(jumlahReqInput) <= 0) {
      setPesanGalat("Pilih bahan dan masukkan jumlah permintaan yang valid.");
      return;
    }
    setSedangSimpanReq(true);
    setPesanGalat(null);
    setPesanSukses(null);

    try {
      const payload = {
        tanggalKebutuhan: tanggalKebutuhanInput,
        unitPeminta: unitPemintaInput,
        keterangan: keteranganReqInput || "Permintaan bahan rutin dapur",
        daftarItem: [{ bahanId: bahanReqTerpilih, jumlahDiminta: Number(jumlahReqInput) }],
      };

      const res = await fetch("/api/v1/inventory/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await res.json()) as ResponsApi<ItemPermintaanBahanDto>;
      if (!res.ok || !json.sukses) {
        throw new Error((!json.sukses ? json.galat.pesan : undefined) ?? "Pembuatan permintaan bahan gagal.");
      }

      setPesanSukses(`Permintaan bahan ${json.data.nomorPermintaan} berhasil diajukan.`);
      setModalPermintaanBuka(false);
      setKeteranganReqInput("");
      setJumlahReqInput("");
      await muatSemuaData();
    } catch (err) {
      setPesanGalat(err instanceof Error ? err.message : "Terjadi kesalahan saat membuat permintaan.");
    } finally {
      setSedangSimpanReq(false);
    }
  };

  // Handler: Simpan Stok Opname (BRD 7.6, AB-030)
  const tanganiSimpanOpname = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bahanOpnameTerpilih || stokFisikAktualInput === "") {
      setPesanGalat("Lengkapi data bahan dan jumlah stok fisik aktual.");
      return;
    }
    if (alasanOpnameInput.length < 5) {
      setPesanGalat("Alasan penyesuaian stok opname wajib diisi minimal 5 karakter (BRD 7.6).");
      return;
    }

    setSedangSimpanOpname(true);
    setPesanGalat(null);
    setPesanSukses(null);

    try {
      const payload = {
        bahanId: bahanOpnameTerpilih.id,
        stokFisikAktual: Number(stokFisikAktualInput),
        alasanWajib: alasanOpnameInput,
      };

      const res = await fetch("/api/v1/inventory/stock-opname", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await res.json()) as ResponsApi<{ selisih: number }>;
      if (!res.ok || !json.sukses) {
        throw new Error((!json.sukses ? json.galat.pesan : undefined) ?? "Penyesuaian stok opname gagal.");
      }

      setPesanSukses(
        `Stok opname bahan '${bahanOpnameTerpilih.namaBahan}' berhasil disesuaikan. Selisih: ${json.data.selisih} ${bahanOpnameTerpilih.satuan}. Tercatat di kartu stok audit.`,
      );
      setModalOpnameBuka(false);
      setAlasanOpnameInput("");
      setStokFisikAktualInput("");
      await muatSemuaData();
    } catch (err) {
      setPesanGalat(err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan stok opname.");
    } finally {
      setSedangSimpanOpname(false);
    }
  };

  // Handler: Pembuangan Bahan Kedaluwarsa/Rusak
  const tanganiDisposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lotDisposalTerpilih) return;
    if (alasanDisposalInput.length < 5) {
      setPesanGalat("Alasan pembuangan bahan wajib diisi minimal 5 karakter.");
      return;
    }

    setSedangProsesDisposal(true);
    setPesanGalat(null);
    setPesanSukses(null);

    try {
      const res = await fetch(`/api/v1/inventory/lots/${lotDisposalTerpilih.id}/dispose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alasan: alasanDisposalInput }),
      });

      const json = (await res.json()) as ResponsApi<ItemPenerimaanLotDto>;
      if (!res.ok || !json.sukses) {
        throw new Error((!json.sukses ? json.galat.pesan : undefined) ?? "Pembuangan bahan gagal.");
      }

      setPesanSukses(`Lot ${json.data.nomorLot} berhasil dimusnahkan/dibuang. Stok gudang telah dipotong.`);
      setModalDisposalBuka(false);
      setAlasanDisposalInput("");
      await muatSemuaData();
    } catch (err) {
      setPesanGalat(err instanceof Error ? err.message : "Terjadi kesalahan saat membuang bahan.");
    } finally {
      setSedangProsesDisposal(false);
    }
  };

  if (sedangMemuatSesi) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoadingState
          judul="Memuat Workspace Gudang..."
          deskripsi="Memverifikasi izin akses inventaris dan keselamatan stok bahan..."
        />
      </div>
    );
  }

  if (
    !profil ||
    (profil.peran !== "petugas_gudang" &&
      !profil.daftarIzin.includes("gudang:persediaan:kelola"))
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white p-6 rounded-lg shadow-sm border border-slate-200 text-center space-y-4">
          <PermissionDeniedState
            pesan="Akses Terbatas: Khusus Petugas Gudang."
            detailKonteks="Sesuai Aturan Keselamatan AB-032, pengelolaan inventaris, penerimaan bahan baku, alokasi FEFO, dan stok opname memerlukan wewenang Petugas Gudang."
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

  // Filter bahan baku
  const bahanTersaring = daftarBahan.filter((b) => {
    const cocokTeks =
      b.namaBahan.toLowerCase().includes(kataKunciCari.toLowerCase()) ||
      b.kodeBahan.toLowerCase().includes(kataKunciCari.toLowerCase()) ||
      b.kategori.toLowerCase().includes(kataKunciCari.toLowerCase());

    const cocokKategori = filterKategori === "SEMUA" || b.kategori === filterKategori;
    const cocokStatus = filterStatusStok === "SEMUA" || b.statusStok === filterStatusStok;
    const cocokSuhu = filterSuhu === "SEMUA" || b.suhuPenyimpanan === filterSuhu;

    return cocokTeks && cocokKategori && cocokStatus && cocokSuhu;
  });
  const totalHalaman = Math.max(1, Math.ceil(bahanTersaring.length / 10));
  const halamanAktif = Math.min(halaman, totalHalaman);

  // Metrik ringkasan
  const totalBahan = daftarBahan.length;
  const totalMenipis = daftarBahan.filter((b) => b.statusStok === "menipis" || b.statusStok === "habis").length;
  const totalReqMenunggu = daftarPermintaan.filter((r) => r.status === "menunggu").length;
  const totalLotKarantina = daftarLot.filter((l) => l.statusMutu !== "layak_diterima" || l.statusLot === "kedaluwarsa").length;

  // Kolom Tabel Katalog Bahan
  const kolomBahan: readonly DefinisiKolomTabel<ItemKatalogBahanDto>[] = [
    {
      id: "bahan",
      header: "Bahan Baku & Kode",
      renderSel: (b: ItemKatalogBahanDto) => (
        <div>
          <div className="font-semibold text-slate-900">{b.namaBahan}</div>
          <div className="text-xs text-slate-500 font-mono">
            {b.kodeBahan} • {b.satuan}
          </div>
          {b.daftarAlergen.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {b.daftarAlergen.map((alg) => (
                <span
                  key={alg}
                  className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300"
                >
                  ⚠️ Alergen: {alg}
                </span>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      id: "kategori",
      header: "Kategori & Suhu",
      renderSel: (b: ItemKatalogBahanDto) => (
        <div>
          <span className="text-xs font-medium text-slate-800 capitalize">
            {b.kategori.replace(/_/g, " ")}
          </span>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
            {b.suhuPenyimpanan === "freezer_beku" ? (
              <Snowflake className="w-3.5 h-3.5 text-cyan-600" />
            ) : b.suhuPenyimpanan === "chiller_dingin" ? (
              <ThermometerSnowflake className="w-3.5 h-3.5 text-blue-600" />
            ) : (
              <Sun className="w-3.5 h-3.5 text-amber-600" />
            )}
            <span>{b.suhuPenyimpanan.replace(/_/g, " ")}</span>
          </div>
        </div>
      ),
    },
    {
      id: "stokRincian",
      header: "Rincian Stok Gudang",
      renderSel: (b: ItemKatalogBahanDto) => (
        <div className="text-xs space-y-0.5">
          <div>
            Fisik: <strong className="text-slate-900 font-mono">{b.stokFisik}</strong> {b.satuan}
          </div>
          <div className="text-slate-600">
            Layak: <span className="font-mono text-emerald-700 font-semibold">{b.stokLayak}</span> | Dialokasikan:{" "}
            <span className="font-mono text-amber-700 font-semibold">{b.stokDialokasikan}</span>
          </div>
          {b.stokDitahan > 0 && (
            <div className="text-rose-700 font-semibold text-[11px]">
              Ditahan/Karantina: {b.stokDitahan} {b.satuan}
            </div>
          )}
        </div>
      ),
    },
    {
      id: "statusTersedia",
      header: "Stok Bebas & Status",
      renderSel: (b: ItemKatalogBahanDto) => {
        let varian: "sesuai" | "menunggu" | "ditahan" = "sesuai";
        let label = "Stok Aman";
        if (b.statusStok === "habis") {
          varian = "ditahan";
          label = "Stok Habis";
        } else if (b.statusStok === "menipis") {
          varian = "menunggu";
          label = "Mendekati Minimum";
        }

        return (
          <div className="space-y-1">
            <div className="text-sm font-bold text-slate-900">
              {b.stokTersedia} <span className="text-xs font-normal text-slate-500">{b.satuan}</span>
            </div>
            <StatusBadge varian={varian} label={label} />
            <div className="text-[10px] text-slate-400">Min: {b.stokMinimum} {b.satuan}</div>
          </div>
        );
      },
    },
    {
      id: "aksi",
      header: "Tindakan",
      renderSel: (b: ItemKatalogBahanDto) => (
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs border-blue-300 hover:bg-blue-50 text-blue-800"
            onClick={() => {
              setBahanTerpilihLot(b.id);
              setTanggalTerimaInput(new Date().toLocaleDateString("en-CA"));
              setModalLotBuka(true);
            }}
          >
            <PackagePlus className="w-3 h-3 mr-1" />
            Terima
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs border-amber-300 hover:bg-amber-50 text-amber-800"
            onClick={() => {
              setBahanOpnameTerpilih(b);
              setStokFisikAktualInput(b.stokFisik);
              setAlasanOpnameInput("");
              setModalOpnameBuka(true);
            }}
          >
            <Scale className="w-3 h-3 mr-1" />
            Opname
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AppShellTemplate
      judulDiKonten
      judulHalaman="Manajemen Inventaris & Mutu Bahan"
      subjudulHalaman="Penerimaan bahan, uji mutu organoleptik/suhu (AB-015), pengendalian stok FEFO/FIFO (AB-017, AB-018), alokasi dapur, dan stok opname berkala."
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
        {/* Banner Alert Feedback */}
        {pesanGalat && (
          <SafetyHoldBanner
            judul="Peringatan Keselamatan Inventaris Gudang"
            alasanPenahanan={pesanGalat}
            tindakLanjutWajib="Periksa kembali kondisi fisik bahan, suhu simpan, tanggal kedaluwarsa, atau kecukupan stok layak tersedia."
          />
        )}
        {pesanSukses && (
          <MinimalToastBanner
            pesan={pesanSukses}
            jenis="berhasil"
            onTutup={() => setPesanSukses(null)}
          />
        )}

        {/* Top Header Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200 mb-2">
                <Boxes className="w-3.5 h-3.5" />
                Petugas Gudang (Inventaris & Mutu Bahan)
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Penerimaan, Pengendalian Stok FEFO & Permintaan Dapur
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Pemeriksaan kualitas penerimaan bahan baku, karantina bahan tidak layak (AB-015), reservasi alokasi (AB-016), dan pengeluaran aktual bertelusur lot (AB-018).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={muatSemuaData}
                disabled={memuatData}
                className="text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${memuatData ? "animate-spin" : ""}`} />
                Segarkan
              </Button>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                onClick={() => { setTanggalTerimaInput(new Date().toLocaleDateString("en-CA")); setModalLotBuka(true); }}
              >
                <PackagePlus className="w-3.5 h-3.5 mr-1.5" />
                Penerimaan Baru
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-emerald-300 text-emerald-800 hover:bg-emerald-50 text-xs"
                onClick={() => setModalPermintaanBuka(true)}
              >
                <Utensils className="w-3.5 h-3.5 mr-1.5" />
                Permintaan Bahan
              </Button>
            </div>
          </div>
        </div>

        {/* Metrik Status Gudang */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-700 rounded-lg">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">{totalBahan}</div>
              <div className="text-xs text-slate-500 font-medium">Total Bahan Master</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 text-amber-700 rounded-lg">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-700">{totalMenipis}</div>
              <div className="text-xs text-slate-500 font-medium">Stok Menipis / Habis</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-emerald-700">{totalReqMenunggu}</div>
              <div className="text-xs text-slate-500 font-medium">Permintaan Menunggu Alokasi</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="p-2.5 bg-rose-50 text-rose-700 rounded-lg">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-rose-700">{totalLotKarantina}</div>
              <div className="text-xs text-slate-500 font-medium">Lot Ditahan / Karantina</div>
            </div>
          </div>
        </div>

        {/* Tab Navigasi Gudang */}
        <div className="flex border-b border-slate-200 gap-2 max-w-full overflow-x-auto [&>button]:shrink-0 [&>button]:whitespace-nowrap">
          <button
            type="button"
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              tabAktif === "katalog"
                ? "border-blue-600 text-blue-700 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
            onClick={() => setTabAktif("katalog")}
          >
            <Boxes className="w-4 h-4" />
            Katalog Bahan &amp; Stok ({daftarBahan.length})
          </button>

          <button
            type="button"
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              tabAktif === "penerimaan"
                ? "border-blue-600 text-blue-700 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
            onClick={() => setTabAktif("penerimaan")}
          >
            <PackageCheck className="w-4 h-4" />
            Penerimaan Lot &amp; Uji Mutu ({daftarLot.length})
          </button>

          <button
            type="button"
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              tabAktif === "permintaan"
                ? "border-blue-600 text-blue-700 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
            onClick={() => setTabAktif("permintaan")}
          >
            <Utensils className="w-4 h-4" />
            Permintaan Bahan Dapur ({daftarPermintaan.length})
          </button>

          <button
            type="button"
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              tabAktif === "opname"
                ? "border-blue-600 text-blue-700 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
            onClick={() => setTabAktif("opname")}
          >
            <History className="w-4 h-4" />
            Kartu Stok &amp; Opname ({kartuStok.length})
          </button>
        </div>

        {/* TAB 1: Katalog Bahan Baku */}
        {tabAktif === "katalog" && (
          <div className="space-y-4">
            <DataTableFoundation<ItemKatalogBahanDto>
              judulTabel="Katalog Bahan Baku &amp; Status Ketersediaan"
              deskripsiTabel="Stok fisik, stok layak, alokasi dapur, dan batas stok minimum (safety stock)"
              kolom={kolomBahan}
              data={bahanTersaring.slice((halamanAktif - 1) * 10, halamanAktif * 10)}
              ambilKunciBaris={(b) => b.id}
              kataKunciCari={kataKunciCari}
              onUbahKataKunciCari={(nilai) => { setKataKunciCari(nilai); setHalaman(1); }}
              placeholderCari="Cari nama bahan, kode, atau kategori..."
              halamanSaatIni={halamanAktif}
              totalHalaman={totalHalaman}
              totalData={bahanTersaring.length}
              onUbahHalaman={setHalaman}
              sedangMemuat={memuatData}
              judulKosong="Tidak Ada Bahan"
              deskripsiKosong="Tidak ada bahan baku yang cocok dengan filter pencarian."
              slotFilterTambahan={
                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-slate-500" />
                  <select
                    value={filterKategori}
                    onChange={(e) => { setFilterKategori(e.target.value); setHalaman(1); }}
                    className="h-8 px-2 rounded border border-slate-300 text-xs bg-white"
                  >
                    <option value="SEMUA">Semua Kategori</option>
                    <option value="makanan_pokok">Makanan Pokok</option>
                    <option value="lauk_hewani">Lauk Hewani</option>
                    <option value="lauk_nabati">Lauk Nabati</option>
                    <option value="sayuran">Sayuran</option>
                    <option value="buah">Buah</option>
                    <option value="bumbu_minyak">Bumbu &amp; Minyak</option>
                    <option value="khusus_enteral">Formula Enteral</option>
                  </select>
                  <select
                    value={filterStatusStok}
                    onChange={(e) => { setFilterStatusStok(e.target.value); setHalaman(1); }}
                    className="h-8 px-2 rounded border border-slate-300 text-xs bg-white"
                  >
                    <option value="SEMUA">Semua Status Stok</option>
                    <option value="aman">Stok Aman</option>
                    <option value="menipis">Mendekati Minimum</option>
                    <option value="habis">Stok Habis</option>
                  </select>
                  <select
                    value={filterSuhu}
                    onChange={(e) => { setFilterSuhu(e.target.value); setHalaman(1); }}
                    className="h-8 px-2 rounded border border-slate-300 text-xs bg-white"
                  >
                    <option value="SEMUA">Semua Suhu</option>
                    <option value="suhu_ruang">Suhu Ruang</option>
                    <option value="chiller_dingin">Chiller Dingin</option>
                    <option value="freezer_beku">Freezer Beku</option>
                  </select>
                </div>
              }
            />
          </div>
        )}

        {/* TAB 2: Penerimaan Lot & Uji Mutu (FEFO) */}
        {tabAktif === "penerimaan" && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-blue-700" />
                Daftar Lot Penerimaan Bahan &amp; Uji Mutu (FEFO)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Pemeriksaan organoleptik, suhu penerimaan, masa simpan/ED, serta status kelayakan bahan (AB-015).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {daftarLot.map((l) => (
                <div
                  key={l.id}
                  className={`bg-white rounded-xl border p-4 space-y-3 shadow-xs ${
                    l.statusMutu === "ditolak_rusak"
                      ? "border-rose-300 bg-rose-50/30"
                      : l.statusLot === "dibuang"
                      ? "border-slate-300 bg-slate-50 opacity-70"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-semibold">
                        {l.nomorLot}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 mt-1">{l.namaBahan}</h3>
                      <p className="text-xs text-slate-500">{l.namaPemasok}</p>
                    </div>
                    <StatusBadge
                      varian={
                        l.statusMutu === "layak_diterima"
                          ? l.statusLot === "aktif"
                            ? "sesuai"
                            : "netral"
                          : "ditahan"
                      }
                      label={
                        l.statusMutu === "layak_diterima"
                          ? l.statusLot === "aktif"
                            ? "Layak (Aktif)"
                            : `Lot ${l.statusLot}`
                          : l.statusMutu.replace(/_/g, " ")
                      }
                    />
                  </div>

                  <div className="text-xs space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200 font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">Sisa Stok:</span>
                      <span className="font-bold text-slate-900">{l.sisaStokLot} / {l.jumlahMasuk} {l.satuan}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">Tanggal Terima:</span>
                      <span>{l.tanggalPenerimaan}</span>
                    </div>
                    <div className="flex justify-between text-amber-700 font-bold">
                      <span className="text-slate-500 font-sans font-normal">Kedaluwarsa (ED):</span>
                      <span>{l.tanggalKedaluwarsa}</span>
                    </div>
                    {l.suhuTercatatCelsius !== null && (
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-sans">Suhu Tercatat:</span>
                        <span>{l.suhuTercatatCelsius} °C</span>
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-slate-600 bg-white p-2 rounded border border-slate-100">
                    <span className="font-semibold text-slate-700">Catatan Mutu:</span> {l.catatanPemeriksaan}
                  </div>

                  {l.statusLot !== "dibuang" && (
                    <div className="pt-1 flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-rose-300 text-rose-700 hover:bg-rose-50"
                        onClick={() => {
                          setLotDisposalTerpilih(l);
                          setAlasanDisposalInput("");
                          setModalDisposalBuka(true);
                        }}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Buang / Karantina
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: Permintaan Bahan Dapur */}
        {tabAktif === "permintaan" && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Utensils className="w-5 h-5 text-blue-700" />
                  Daftar Permintaan Bahan Baku dari Dapur Pengolahan
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Alur verifikasi stok: Pengajuan &rarr; Alokasi Stok Layak (AB-016) &rarr; Pengeluaran Fisik FEFO (AB-017, AB-018).
                </p>
              </div>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                onClick={() => setModalPermintaanBuka(true)}
              >
                <PackagePlus className="w-3.5 h-3.5 mr-1" />
                Buat Permintaan Baru
              </Button>
            </div>

            <div className="space-y-3">
              {daftarPermintaan.map((req) => (
                <div
                  key={req.id}
                  className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-slate-900">{req.nomorPermintaan}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-semibold">
                          {req.unitPeminta}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Tanggal Kebutuhan: <strong>{req.tanggalKebutuhan}</strong> • {req.keterangan}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <StatusBadge
                        varian={
                          req.status === "dikeluarkan"
                            ? "sesuai"
                            : req.status === "dialokasikan"
                            ? "menunggu"
                            : req.status === "menunggu"
                            ? "netral"
                            : "ditahan"
                        }
                        label={req.status.toUpperCase()}
                      />

                      {req.status === "menunggu" && (
                        <Button
                          size="sm"
                          className="h-8 bg-amber-600 hover:bg-amber-700 text-white text-xs"
                          onClick={() => void tanganiAlokasiPermintaan(req.id)}
                        >
                          <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                          Alokasikan Stok (AB-016)
                        </Button>
                      )}

                      {req.status === "dialokasikan" && (
                        <Button
                          size="sm"
                          className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                          onClick={() => void tanganiPengeluaranPermintaan(req.id)}
                        >
                          <PackageCheck className="w-3.5 h-3.5 mr-1" />
                          Keluarkan Bahan FEFO (AB-018)
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Rincian Bahan yang diminta */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 mb-2">Daftar Bahan Diminta:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {req.daftarItem.map((item) => (
                        <div
                          key={item.bahanId}
                          className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 text-xs space-y-1"
                        >
                          <div className="font-semibold text-slate-900">{item.namaBahan}</div>
                          <div className="text-slate-600">
                            Diminta: <strong className="text-slate-900">{item.jumlahDiminta} {item.satuan}</strong>
                          </div>
                          <div className="text-slate-600">
                            Dialokasikan: <span className="text-amber-700 font-semibold">{item.jumlahDialokasikan}</span> | Dikeluarkan: <span className="text-emerald-700 font-semibold">{item.jumlahDikeluarkan}</span>
                          </div>
                          {item.lotDialokasikan && item.lotDialokasikan.length > 0 && (
                            <div className="mt-1 pt-1 border-t border-slate-200 text-[11px] text-blue-800 font-mono">
                              Lot: {item.lotDialokasikan.map((l) => `${l.nomorLot} (${l.jumlah})`).join(", ")}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: Kartu Stok Mutasi Ledger & Stok Opname */}
        {tabAktif === "opname" && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <History className="w-5 h-5 text-blue-700" />
                  Buku Besar Kartu Stok Mutasi &amp; Jejak Audit (AB-030)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Setiap mutasi barang masuk, alokasi, pengeluaran fisik FEFO, stok opname, dan pembuangan tercatat permanen.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="p-3">Waktu &amp; Petugas</th>
                      <th className="p-3">Bahan Baku</th>
                      <th className="p-3">Jenis Mutasi</th>
                      <th className="p-3">Nomor Lot / Ref</th>
                      <th className="p-3 text-right">Masuk</th>
                      <th className="p-3 text-right">Keluar</th>
                      <th className="p-3 text-right">Saldo Akhir</th>
                      <th className="p-3">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {kartuStok.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 whitespace-nowrap">
                          <div className="font-mono text-slate-900">{new Date(m.waktuPencatatan).toLocaleString("id-ID")}</div>
                          <div className="text-[11px] text-slate-500">{m.petugasNama}</div>
                        </td>
                        <td className="p-3 font-semibold text-slate-900">{m.namaBahan}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              m.jenisMutasi === "penerimaan"
                                ? "bg-emerald-100 text-emerald-800"
                                : m.jenisMutasi === "pengeluaran"
                                ? "bg-blue-100 text-blue-800"
                                : m.jenisMutasi === "alokasi"
                                ? "bg-amber-100 text-amber-800"
                                : m.jenisMutasi === "pembuangan"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-purple-100 text-purple-800"
                            }`}
                          >
                            {m.jenisMutasi.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-slate-700">{m.nomorLot || m.referensiDokumen}</td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-700">
                          {m.jumlahMasuk > 0 ? `+${m.jumlahMasuk}` : "-"}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-rose-700">
                          {m.jumlahKeluar > 0 ? `-${m.jumlahKeluar}` : "-"}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900">{m.saldoAkhir}</td>
                        <td className="p-3 text-slate-600 max-w-xs">{m.keterangan}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 1: Penerimaan Lot Bahan Baku Baru + Cek Mutu (AB-015) */}
        {modalLotBuka && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <PackagePlus className="w-5 h-5 text-blue-700" />
                  <h3 className="text-base font-bold text-slate-900">
                    Penerimaan Lot Bahan &amp; Uji Mutu Organoleptik
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setModalLotBuka(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={tanganiSimpanLot} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Bahan Baku Master *
                  </label>
                  <select
                    value={bahanTerpilihLot}
                    onChange={(e) => setBahanTerpilihLot(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs bg-white"
                    required
                  >
                    {daftarBahan.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.namaBahan} ({b.kodeBahan}) — Satuan: {b.satuan} • Suhu: {b.suhuPenyimpanan}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-800 mb-1">
                      Nama Pemasok (Supplier) *
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: PT Pertani Sejahtera"
                      value={pemasokInput}
                      onChange={(e) => setPemasokInput(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-800 mb-1">
                      Jumlah Masuk *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.1"
                      placeholder="Contoh: 50"
                      value={jumlahMasukInput}
                      onChange={(e) => setJumlahMasukInput(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-800 mb-1">
                      Tanggal Penerimaan *
                    </label>
                    <input
                      type="date"
                      value={tanggalTerimaInput}
                      onChange={(e) => setTanggalTerimaInput(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-800 mb-1">
                      Tanggal Kedaluwarsa (ED) *
                    </label>
                    <input
                      type="date"
                      value={tanggalEdInput}
                      onChange={(e) => setTanggalEdInput(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-800 mb-1">
                      Hasil Pemeriksaan Mutu (AB-015) *
                    </label>
                    <select
                      value={statusMutuInput}
                      onChange={(e) => setStatusMutuInput(e.target.value as StatusMutuPenerimaan)}
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs bg-white font-semibold"
                      required
                    >
                      <option value="layak_diterima">Layak Diterima (Lolos Mutu)</option>
                      <option value="ditolak_rusak">Ditolak / Rusak (Tidak Boleh Produksi)</option>
                      <option value="ditahan_karantina">Ditahan / Karantina Uji Lab</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-800 mb-1">
                      Suhu Tercatat (°C)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="Contoh: -18.0 atau 4.5"
                      value={suhuCelsiusInput}
                      onChange={(e) => setSuhuCelsiusInput(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Catatan Pemeriksaan Fisik &amp; Organoleptik (Wajib &ge; 5 karakter) *
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Contoh: Kemasan karung utuh kedap air, aroma normal segar, tidak berhama..."
                    value={catatanMutuInput}
                    onChange={(e) => setCatatanMutuInput(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 text-xs"
                    required
                  />
                </div>

                {statusMutuInput !== "layak_diterima" && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <strong>Peringatan AB-015:</strong> Bahan berstatus ditolak atau karantina tidak akan dimasukkan ke stok layak dan tidak dapat dialokasikan ke dapur untuk produksi makanan pasien.
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setModalLotBuka(false)}
                    disabled={sedangSimpanLot}
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                    disabled={sedangSimpanLot}
                  >
                    {sedangSimpanLot ? "Menyimpan..." : "Simpan Penerimaan Lot"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: Stok Opname Fisik (BRD 7.6, AB-030) */}
        {modalOpnameBuka && bahanOpnameTerpilih && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <Scale className="w-5 h-5 text-amber-700" />
                  <h3 className="text-base font-bold text-slate-900">
                    Penyesuaian Fisik Stok Opname
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpnameBuka(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={tanganiSimpanOpname} className="space-y-4 text-xs">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                  <div className="font-bold text-slate-900">{bahanOpnameTerpilih.namaBahan}</div>
                  <div className="text-slate-600">
                    Stok Sistem Saat Ini: <strong>{bahanOpnameTerpilih.stokFisik} {bahanOpnameTerpilih.satuan}</strong>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Stok Fisik Aktual Hasil Hitung *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Masukkan hasil timbangan fisik"
                    value={stokFisikAktualInput}
                    onChange={(e) => setStokFisikAktualInput(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono font-bold"
                    required
                  />
                  {stokFisikAktualInput !== "" && (
                    <div className="mt-1 text-[11px] font-semibold">
                      Selisih:{" "}
                      <span
                        className={
                          Number(stokFisikAktualInput) - bahanOpnameTerpilih.stokFisik < 0
                            ? "text-rose-700"
                            : "text-emerald-700"
                        }
                      >
                        {Number((Number(stokFisikAktualInput) - bahanOpnameTerpilih.stokFisik).toFixed(2))}{" "}
                        {bahanOpnameTerpilih.satuan}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Alasan Wajib Penyesuaian (BRD 7.6, min 5 karakter) *
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Contoh: Penyusutan kelembaban selama masa penyimpanan gudang kering..."
                    value={alasanOpnameInput}
                    onChange={(e) => setAlasanOpnameInput(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 text-xs"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setModalOpnameBuka(false)}
                    disabled={sedangSimpanOpname}
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                    disabled={sedangSimpanOpname}
                  >
                    {sedangSimpanOpname ? "Menyimpan..." : "Simpan Rekonsiliasi Opname"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 3: Pembuangan Lot Bahan Rusak / ED */}
        {modalDisposalBuka && lotDisposalTerpilih && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-rose-700" />
                  <h3 className="text-base font-bold text-slate-900">
                    Pembuangan Bahan Kedaluwarsa / Rusak
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setModalDisposalBuka(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={tanganiDisposal} className="space-y-4 text-xs">
                <div className="bg-rose-50 p-3 rounded-lg border border-rose-200 space-y-1 text-rose-900">
                  <div className="font-bold">{lotDisposalTerpilih.namaBahan}</div>
                  <div>Nomor Lot: <strong>{lotDisposalTerpilih.nomorLot}</strong></div>
                  <div>Sisa yang dimusnahkan: <strong>{lotDisposalTerpilih.sisaStokLot} {lotDisposalTerpilih.satuan}</strong></div>
                  <div>Tanggal ED: {lotDisposalTerpilih.tanggalKedaluwarsa}</div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Alasan Pemusnahan / Pembuangan (min 5 karakter) *
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Contoh: Telah melewati tanggal kedaluwarsa dan berbau tengik, dimusnahkan sesuai SOP K3 RS..."
                    value={alasanDisposalInput}
                    onChange={(e) => setAlasanDisposalInput(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 text-xs"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setModalDisposalBuka(false)}
                    disabled={sedangProsesDisposal}
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
                    disabled={sedangProsesDisposal}
                  >
                    {sedangProsesDisposal ? "Memproses..." : "Konfirmasi Pemusnahan Bahan"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 4: Buat Permintaan Bahan Dapur */}
        {modalPermintaanBuka && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <Utensils className="w-5 h-5 text-emerald-700" />
                  <h3 className="text-base font-bold text-slate-900">
                    Pengajuan Permintaan Bahan Dapur
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setModalPermintaanBuka(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={tanganiBuatPermintaan} className="space-y-4 text-xs">
                <div>
                  <label htmlFor="tanggal-kebutuhan-bahan" className="block font-semibold text-slate-800 mb-1">Tanggal Kebutuhan *</label>
                  <input id="tanggal-kebutuhan-bahan" type="date" value={tanggalKebutuhanInput} onChange={(e) => setTanggalKebutuhanInput(e.target.value)} className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs" required />
                </div>
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Unit Peminta *
                  </label>
                  <input
                    type="text"
                    value={unitPemintaInput}
                    onChange={(e) => setUnitPemintaInput(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Pilih Bahan Baku *
                  </label>
                  <select
                    value={bahanReqTerpilih}
                    onChange={(e) => setBahanReqTerpilih(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs bg-white"
                    required
                  >
                    <option value="" disabled>Pilih bahan baku</option>
                    {daftarBahan.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.namaBahan} (Stok Bebas: {b.stokTersedia} {b.satuan})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Jumlah yang Diminta *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.1"
                    placeholder="Contoh: 10"
                    value={jumlahReqInput}
                    onChange={(e) => setJumlahReqInput(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Keterangan Kebutuhan
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Kebutuhan makan siang pasien Melati & Anggrek"
                    value={keteranganReqInput}
                    onChange={(e) => setKeteranganReqInput(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setModalPermintaanBuka(false)}
                    disabled={sedangSimpanReq}
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                    disabled={sedangSimpanReq}
                  >
                    {sedangSimpanReq ? "Menyimpan..." : "Kirim Permintaan Bahan"}
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
