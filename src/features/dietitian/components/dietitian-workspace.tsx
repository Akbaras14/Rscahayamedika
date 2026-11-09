/**
 * @fileoverview Workspace antarmuka pengguna untuk Peran Ahli Gizi / Dietisien.
 * Mengimplementasikan:
 * 1. Daftar Pasien Konsultasi Asuhan Gizi & Rujukan Skrining MST (BRD Bab V.5.3, AB-032).
 * 2. Asuhan Gizi Terstandar (ADIME) & Target Nutrisi Individual (dua pengenal AB-020, IMT live, AB-027).
 * 3. Rencana Menu Individual & Cek Kesesuaian Alergi/Tekstur (AB-007, AB-011, AB-014).
 * 4. Monitoring & Evaluasi Asuhan Gizi Berkala (BRD Bab XI, AB-026, AB-028).
 */

"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  Apple,
  BookOpen,
  CheckCircle2,
  ChefHat,
  Clock,
  FileText,
  Filter,
  Flame,
  HeartPulse,
  History,
  RefreshCw,
  Scale,
  TrendingDown,
  UserCheck,
  Users,
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
  ItemAsuhanGiziAdimeDto,
  ItemEvaluasiAsuhanGiziDto,
  ItemKatalogMenuResepDto,
  ItemPasienDietisienDto,
  ItemRencanaMenuIndividualDto,
  JadwalMakanMenu,
  KeputusanTindakLanjutGizi,
  ResponsApi,
} from "../../../../packages/shared-types/src/index.ts";

type TabDietisien = "antrean" | "adime" | "menu" | "evaluasi";

export function DietitianWorkspace() {
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

  const [tabAktif, setTabAktif] = useState<TabDietisien>("antrean");
  const [kataKunciCari, setKataKunciCari] = useState("");
  const [daftarPasien, setDaftarPasien] = useState<ItemPasienDietisienDto[]>([]);
  const [riwayatAdime, setRiwayatAdime] = useState<ItemAsuhanGiziAdimeDto[]>([]);
  const [katalogResep, setKatalogResep] = useState<ItemKatalogMenuResepDto[]>([]);
  const [daftarMenuIndividual, setDaftarMenuIndividual] = useState<ItemRencanaMenuIndividualDto[]>([]);
  const [riwayatEvaluasi, setRiwayatEvaluasi] = useState<ItemEvaluasiAsuhanGiziDto[]>([]);
  const [memuatData, setMemuatData] = useState(false);
  const [pesanGalat, setPesanGalat] = useState<string | null>(null);
  const [pesanSukses, setPesanSukses] = useState<string | null>(null);

  // Filter state
  const [filterBangsal, setFilterBangsal] = useState("SEMUA");
  const [filterRisiko, setFilterRisiko] = useState("SEMUA");

  // Modal State: Asuhan Gizi ADIME
  const [modalAdimeBuka, setModalAdimeBuka] = useState(false);
  const [pasienTerpilih, setPasienTerpilih] = useState<ItemPasienDietisienDto | null>(null);
  const [konfirmasiTglLahir, setKonfirmasiTglLahir] = useState("");
  const [bbKg, setBbKg] = useState<number | "">("");
  const [tbCm, setTbCm] = useState<number | "">("");
  const [biokimia, setBiokimia] = useState("");
  const [klinisFisik, setKlinisFisik] = useState("");
  const [riwayatDiet, setRiwayatDiet] = useState("");
  const [diagnosisPes, setDiagnosisPes] = useState("");
  const [targetKalori, setTargetKalori] = useState<number | "">("");
  const [targetProtein, setTargetProtein] = useState<number | "">("");
  const [targetLemak, setTargetLemak] = useState<number | "">("");
  const [targetKh, setTargetKh] = useState<number | "">("");
  const [targetCairan, setTargetCairan] = useState<number | "">("");
  const [targetSerat, setTargetSerat] = useState<number | "">("");
  const [targetNatrium, setTargetNatrium] = useState<number | "">("");
  const [tujuanIntervensi, setTujuanIntervensi] = useState("");
  const [rencanaIntervensi, setRencanaIntervensi] = useState("");
  const [rencanaMonev, setRencanaMonev] = useState("");
  const [tanggalEvaluasiUlang, setTanggalEvaluasiUlang] = useState("");
  const [sedangSimpanAdime, setSedangSimpanAdime] = useState(false);

  // Modal State: Susun Menu Individual
  const [modalMenuBuka, setModalMenuBuka] = useState(false);
  const [menuTerpilihId, setMenuTerpilihId] = useState("");
  const [jadwalMakanTerpilih, setJadwalMakanTerpilih] = useState<JadwalMakanMenu>("pagi");
  const [tanggalPelayananMenu, setTanggalPelayananMenu] = useState("2026-11-09");
  const [porsiMenu, setPorsiMenu] = useState<number>(1.0);
  const [catatanKhususMenu, setCatatanKhususMenu] = useState("");
  const [sedangSimpanMenu, setSedangSimpanMenu] = useState(false);

  // Modal State: Evaluasi Gizi
  const [modalEvaluasiBuka, setModalEvaluasiBuka] = useState(false);
  const [evaluasiAsupanTeks, setEvaluasiAsupanTeks] = useState("");
  const [persentaseAsupanInput, setPersentaseAsupanInput] = useState<number>(75);
  const [hambatanAsupanTeks, setHambatanAsupanTeks] = useState("");
  const [keputusanTindakLanjut, setKeputusanTindakLanjut] = useState<KeputusanTindakLanjutGizi>("lanjutkan_rencana");
  const [rekomendasiDokterTeks, setRekomendasiDokterTeks] = useState("");
  const [sedangSimpanEvaluasi, setSedangSimpanEvaluasi] = useState(false);

  // Kalkulasi IMT Live
  const hitungImtLive = (): { imt: number | null; klasifikasi: string } => {
    if (typeof bbKg === "number" && typeof tbCm === "number" && tbCm > 0) {
      const tbMeter = tbCm / 100;
      const imt = Number((bbKg / (tbMeter * tbMeter)).toFixed(2));
      let klasifikasi = "Normal";
      if (imt < 18.5) klasifikasi = "Underweight (Kurus)";
      else if (imt <= 22.9) klasifikasi = "Normal";
      else if (imt <= 24.9) klasifikasi = "Overweight (Kelebihan)";
      else klasifikasi = "Obesitas";
      return { imt, klasifikasi };
    }
    return { imt: null, klasifikasi: "-" };
  };

  const muatSemuaData = async () => {
    setMemuatData(true);
    setPesanGalat(null);
    try {
      // 1. Pasien Dietisien
      const resPasien = await fetch("/api/v1/dietitian/patients");
      const jsonPasien: ResponsApi<{ items: ItemPasienDietisienDto[] }> =
        await resPasien.json();
      if (jsonPasien.sukses) {
        setDaftarPasien(jsonPasien.data.items);
      }

      // 2. Riwayat Asuhan Gizi ADIME
      const resAdime = await fetch("/api/v1/dietitian/nutrition-care");
      const jsonAdime: ResponsApi<{ items: ItemAsuhanGiziAdimeDto[] }> =
        await resAdime.json();
      if (jsonAdime.sukses) {
        setRiwayatAdime(jsonAdime.data.items);
      }

      // 3. Katalog Resep Menu
      const resKatalog = await fetch("/api/v1/meal-planning/recipes");
      const jsonKatalog: ResponsApi<{ items: ItemKatalogMenuResepDto[] }> =
        await resKatalog.json();
      if (jsonKatalog.sukses) {
        setKatalogResep(jsonKatalog.data.items);
        if (jsonKatalog.data.items.length > 0 && !menuTerpilihId) {
          setMenuTerpilihId(jsonKatalog.data.items[0].id);
        }
      }

      // 4. Menu Individual
      const resMenu = await fetch("/api/v1/meal-planning/individual-menus");
      const jsonMenu: ResponsApi<{ items: ItemRencanaMenuIndividualDto[] }> =
        await resMenu.json();
      if (jsonMenu.sukses) {
        setDaftarMenuIndividual(jsonMenu.data.items);
      }

      // 5. Evaluasi Gizi
      const resEval = await fetch("/api/v1/dietitian/evaluations");
      const jsonEval: ResponsApi<{ items: ItemEvaluasiAsuhanGiziDto[] }> =
        await resEval.json();
      if (jsonEval.sukses) {
        setRiwayatEvaluasi(jsonEval.data.items);
      }
    } catch {
      setPesanGalat("Gagal memuat data dari server. Silakan muat ulang.");
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

  const tanganiSimpanAdime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pasienTerpilih) return;
    if ([targetKalori, targetProtein, targetLemak, targetKh].some((nilai) => nilai === "" || nilai <= 0)) {
      setPesanGalat("Tetapkan target gizi berdasarkan asesmen dan keputusan ahli gizi sebelum menyimpan.");
      return;
    }

    setSedangSimpanAdime(true);
    setPesanGalat(null);
    setPesanSukses(null);

    try {
      const payload = {
        episodeId: pasienTerpilih.episodeId,
        pasienId: pasienTerpilih.pasienId,
        konfirmasiTanggalLahir: konfirmasiTglLahir.trim(),
        antropometriBbKg: typeof bbKg === "number" ? bbKg : null,
        antropometriTbCm: typeof tbCm === "number" ? tbCm : null,
        biokimia: biokimia.trim() || null,
        klinisFisik: klinisFisik.trim() || null,
        riwayatDiet: riwayatDiet.trim() || null,
        diagnosisGiziPes: diagnosisPes.trim(),
        targetEnergiKkal: Number(targetKalori),
        targetProteinGram: Number(targetProtein),
        targetLemakGram: Number(targetLemak),
        targetKarbohidratGram: Number(targetKh),
        targetCairanMl: targetCairan === "" ? null : Number(targetCairan),
        targetSeratGram: targetSerat === "" ? null : Number(targetSerat),
        targetNatriumMg: targetNatrium === "" ? null : Number(targetNatrium),
        tujuanIntervensi: tujuanIntervensi.trim(),
        rencanaIntervensi: rencanaIntervensi.trim(),
        rencanaMonitoringEvaluasi: rencanaMonev.trim(),
        tanggalEvaluasiUlang,
      };

      const res = await fetch("/api/v1/dietitian/nutrition-care", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json: ResponsApi<ItemAsuhanGiziAdimeDto> = await res.json();
      if (!res.ok || !json.sukses) {
        setPesanGalat(
          json.sukses === false
            ? json.galat.pesan
            : "Gagal menyimpan asuhan gizi ADIME.",
        );
        return;
      }

      setPesanSukses(
        `Asuhan gizi ADIME (${json.data.nomorAsuhan}) untuk pasien ${json.data.namaPasien} berhasil disahkan!`,
      );
      setModalAdimeBuka(false);
      await muatSemuaData();
    } catch {
      setPesanGalat("Terjadi gangguan jaringan saat menyimpan asuhan gizi.");
    } finally {
      setSedangSimpanAdime(false);
    }
  };

  const tanganiSimpanMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pasienTerpilih) return;

    setSedangSimpanMenu(true);
    setPesanGalat(null);
    setPesanSukses(null);

    try {
      // Temukan asuhan gizi aktif untuk pasien ini
      const asuhanAktif = riwayatAdime.find(
        (a) => a.episodeId === pasienTerpilih.episodeId,
      );
      if (!asuhanAktif || !pasienTerpilih.instruksiDietAktifId) {
        setPesanGalat("Menu individual memerlukan asuhan gizi dan instruksi diet aktif yang sah.");
        return;
      }

      const payload = {
        episodeId: pasienTerpilih.episodeId,
        pasienId: pasienTerpilih.pasienId,
        asuhanGiziId: asuhanAktif.id,
        instruksiDietId: pasienTerpilih.instruksiDietAktifId,
        tanggalPelayanan: tanggalPelayananMenu,
        jadwalMakan: jadwalMakanTerpilih,
        menuId: menuTerpilihId,
        porsi: porsiMenu,
        catatanKhusus: catatanKhususMenu.trim() || null,
      };

      const res = await fetch("/api/v1/meal-planning/individual-menus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json: ResponsApi<ItemRencanaMenuIndividualDto> = await res.json();
      if (!res.ok || !json.sukses) {
        setPesanGalat(
          json.sukses === false
            ? json.galat.pesan
            : "Gagal menyusun menu individual.",
        );
        return;
      }

      if (json.data.statusKesesuaian === "tidak_sesuai_alergi") {
        setPesanGalat(
          `PERINGATAN KESELAMATAN: ${json.data.alasanTidakSesuai}. Rencana menu ditahan dan belum disahkan.`,
        );
      } else {
        setPesanSukses(
          `Rencana menu (${json.data.namaMenu}) berhasil disusun untuk ${json.data.namaPasien}.`,
        );
      }

      setModalMenuBuka(false);
      await muatSemuaData();
    } catch {
      setPesanGalat("Gangguan saat menyusun menu individual.");
    } finally {
      setSedangSimpanMenu(false);
    }
  };

  const tanganiSahkanMenu = async (rencanaId: string) => {
    setPesanGalat(null);
    setPesanSukses(null);
    try {
      const res = await fetch(
        `/api/v1/meal-planning/individual-menus/${rencanaId}/approve`,
        { method: "POST" },
      );
      const json: ResponsApi<ItemRencanaMenuIndividualDto> = await res.json();
      if (!res.ok || !json.sukses) {
        setPesanGalat(
          json.sukses === false
            ? json.galat.pesan
            : "Pengesahan rencana menu ditolak oleh sistem keselamatan.",
        );
        return;
      }
      setPesanSukses(
        `Rencana menu ${json.data.namaMenu} resmi disahkan untuk pelayanan!`,
      );
      await muatSemuaData();
    } catch {
      setPesanGalat("Gagal mengesahkan rencana menu.");
    }
  };

  const tanganiSimpanEvaluasi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pasienTerpilih) return;

    setSedangSimpanEvaluasi(true);
    setPesanGalat(null);
    setPesanSukses(null);

    try {
      const asuhanAktif = riwayatAdime.find(
        (a) => a.episodeId === pasienTerpilih.episodeId,
      );
      if (!asuhanAktif) {
        setPesanGalat("Evaluasi memerlukan asuhan gizi aktif yang tercatat untuk episode ini.");
        return;
      }

      const payload = {
        asuhanGiziId: asuhanAktif.id,
        episodeId: pasienTerpilih.episodeId,
        pasienId: pasienTerpilih.pasienId,
        tanggalEvaluasi: new Date().toISOString().split("T")[0],
        evaluasiAsupan: evaluasiAsupanTeks.trim(),
        persentasePemenuhanAsupan: persentaseAsupanInput,
        hambatanAsupan: hambatanAsupanTeks.trim() || null,
        keputusanTindakLanjut,
        rekomendasiKeDokter: rekomendasiDokterTeks.trim() || null,
      };

      const res = await fetch("/api/v1/dietitian/evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json: ResponsApi<ItemEvaluasiAsuhanGiziDto> = await res.json();
      if (!res.ok || !json.sukses) {
        setPesanGalat(
          json.sukses === false
            ? json.galat.pesan
            : "Gagal menyimpan evaluasi asuhan gizi.",
        );
        return;
      }

      setPesanSukses("Catatan evaluasi asuhan gizi berhasil direkam!");
      setModalEvaluasiBuka(false);
      await muatSemuaData();
    } catch {
      setPesanGalat("Gangguan koneksi saat menyimpan evaluasi gizi.");
    } finally {
      setSedangSimpanEvaluasi(false);
    }
  };

  // Metrik Ringkasan
  const totalPasien = daftarPasien.length;
  const rujukanBaru = daftarPasien.filter((p) => p.perluPenilaianLanjut).length;
  const menuDraf = daftarMenuIndividual.filter((m) => m.statusPengesahan === "draf").length;
  const asupanRendah = daftarPasien.filter((p) => p.peringatanAsupanRendah).length;

  // Filter Pasien
  const pasienTersaring = daftarPasien.filter((p) => {
    const cocokBangsal =
      filterBangsal === "SEMUA" || p.bangsalId === filterBangsal;
    const cocokRisiko =
      filterRisiko === "SEMUA" || p.statusSkrining === filterRisiko;
    const q = kataKunciCari.toLowerCase();
    const cocokCari =
      !q ||
      p.namaPasien.toLowerCase().includes(q) ||
      p.nomorRekamMedis.toLowerCase().includes(q) ||
      p.diagnosisUtama.toLowerCase().includes(q);
    return cocokBangsal && cocokRisiko && cocokCari;
  });

  const bukaModalAdime = (pasien: ItemPasienDietisienDto) => {
    setPasienTerpilih(pasien);
    setKonfirmasiTglLahir("");
    setDiagnosisPes("");
    setTujuanIntervensi("");
    setRencanaIntervensi("");
    setRencanaMonev("");
    setTargetKalori("");
    setTargetProtein("");
    setTargetLemak("");
    setTargetKh("");
    setTargetCairan("");
    setTargetSerat("");
    setTargetNatrium("");
    setTanggalEvaluasiUlang("");
    setModalAdimeBuka(true);
  };

  const bukaModalMenu = (pasien: ItemPasienDietisienDto) => {
    setPasienTerpilih(pasien);
    setModalMenuBuka(true);
  };

  const bukaModalEvaluasi = (pasien: ItemPasienDietisienDto) => {
    setPasienTerpilih(pasien);
    setModalEvaluasiBuka(true);
  };

  if (sedangMemuatSesi) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoadingState
          judul="Memuat Workspace Dietisien..."
          deskripsi="Memverifikasi izin akses asuhan gizi dan perencanaan menu..."
        />
      </div>
    );
  }

  if (
    !profil ||
    (profil.peran !== "ahli_gizi" &&
      !profil.daftarIzin.includes("ahli_gizi:penilaian:kelola"))
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white p-6 rounded-lg shadow-sm border border-slate-200 text-center space-y-4">
          <PermissionDeniedState
            pesan="Akses Terbatas: Khusus Ahli Gizi / Dietisien Klinis."
            detailKonteks="Sesuai Aturan Keselamatan AB-032, penetapan asuhan gizi ADIME dan pengesahan menu individual memerlukan wewenang Ahli Gizi Klinis."
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

  // Kolom Tabel Pasien Konsultasi Gizi
  const kolomPasien: readonly DefinisiKolomTabel<ItemPasienDietisienDto>[] = [
    {
      id: "identitas",
      header: "Pasien & Rekam Medis",
      renderSel: (item: ItemPasienDietisienDto) => (
        <div>
          <div className="font-semibold text-slate-900">{item.namaPasien}</div>
          <div className="text-xs text-slate-500 font-mono">
            {item.nomorRekamMedis} • {item.jenisKelamin} • {item.tanggalLahir}
          </div>
        </div>
      ),
    },
    {
      id: "lokasi",
      header: "Bangsal & Bed",
      renderSel: (item: ItemPasienDietisienDto) => (
        <div>
          <div className="font-medium text-slate-800">{item.namaBangsal}</div>
          <div className="text-xs text-slate-500">
            Kamar {item.nomorKamar} • Bed {item.nomorTempatTidur}
          </div>
        </div>
      ),
    },
    {
      id: "klinis",
      header: "Diagnosis & Alergi",
      renderSel: (item: ItemPasienDietisienDto) => (
        <div className="max-w-xs">
          <div className="text-sm text-slate-800 line-clamp-1">
            {item.diagnosisUtama}
          </div>
          {item.daftarAlergi.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {item.daftarAlergi.map((alg: string) => (
                <span
                  key={alg}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300"
                >
                  <AlertTriangle className="w-2.5 h-2.5" />
                  {alg}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-xs text-slate-400">Tidak ada alergi</span>
          )}
        </div>
      ),
    },
    {
      id: "dietDokter",
      header: "Diet Dokter",
      renderSel: (item: ItemPasienDietisienDto) => (
        <div>
          <div className="font-medium text-slate-800 capitalize">
            {item.instruksiDietAktif?.replace(/_/g, " ") ?? "Belum ada"}
          </div>
          <div className="text-xs text-slate-500 capitalize">
            Bentuk: {item.teksturMakanan ?? "Biasa"}
          </div>
        </div>
      ),
    },
    {
      id: "skrining",
      header: "Risiko MST",
      renderSel: (item: ItemPasienDietisienDto) => {
        if (item.statusSkrining === "risiko_tinggi") {
          return (
            <div className="flex flex-col gap-1 items-start">
              <StatusBadge varian="ditahan" label={`Risiko Tinggi (Skor ${item.skorMst})`} />
              {item.perluPenilaianLanjut && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                  <Flame className="w-2.5 h-2.5" /> Perlu ADIME Segera
                </span>
              )}
            </div>
          );
        }
        if (item.statusSkrining === "risiko_rendah") {
          return <StatusBadge varian="sesuai" label={`Risiko Rendah (Skor ${item.skorMst})`} />;
        }
        return <StatusBadge varian="belum_dicatat" label="Belum Skrining" />;
      },
    },
    {
      id: "asupan",
      header: "Asupan Terakhir",
      renderSel: (item: ItemPasienDietisienDto) => {
        if (item.observasiAsupanTerakhir === null) {
          return <span className="text-xs text-slate-400">Belum dicatat</span>;
        }
        return (
          <div className="flex items-center gap-1.5">
            <span
              className={`font-semibold text-xs px-2 py-0.5 rounded-full ${
                item.observasiAsupanTerakhir <= 25
                  ? "bg-rose-100 text-rose-800 font-bold border border-rose-300"
                  : item.observasiAsupanTerakhir <= 50
                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                  : "bg-emerald-100 text-emerald-800 border border-emerald-300"
              }`}
            >
              {item.observasiAsupanTerakhir}%
            </span>
            {item.peringatanAsupanRendah && (
              <span title="Peringatan Asupan Rendah (Comstock <= 25%)">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "statusAsuhan",
      header: "Status ADIME",
      renderSel: (item: ItemPasienDietisienDto) => {
        if (item.statusAsuhanGizi === "aktif") {
          return <StatusBadge varian="sesuai" label="ADIME Aktif" />;
        }
        return <StatusBadge varian="menunggu" label="Belum Ada Asuhan" />;
      },
    },
    {
      id: "aksi",
      header: "Tindakan Klinis",
      renderSel: (item: ItemPasienDietisienDto) => (
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="default"
            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => bukaModalAdime(item)}
          >
            <FileText className="w-3 h-3 mr-1" />
            Asuhan ADIME
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs border-slate-300 hover:bg-slate-100 text-slate-700"
            onClick={() => bukaModalMenu(item)}
          >
            <Utensils className="w-3 h-3 mr-1" />
            Susun Menu
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs border-amber-300 hover:bg-amber-50 text-amber-800"
            onClick={() => bukaModalEvaluasi(item)}
          >
            <TrendingDown className="w-3 h-3 mr-1" />
            Monev
          </Button>
        </div>
      ),
    },
  ];

  const imtHasil = hitungImtLive();

  return (
    <AppShellTemplate
      judulDiKonten
      judulHalaman="Asuhan Gizi & Perencanaan Menu"
      subjudulHalaman="Asuhan gizi terstandar (ADIME), kalkulasi target nutrisi individual, penyusunan menu aman alergen (AB-007), dan monitoring berkala (AB-026)."
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
            judul="Peringatan Keselamatan Asuhan Gizi"
            alasanPenahanan={pesanGalat}
            tindakLanjutWajib="Periksa kembali instruksi klinis dokter, data antropometri, dan pastikan tidak ada bahan alergen yang tabrakan."
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
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 mb-2">
                <Apple className="w-3.5 h-3.5" />
                Dietisien / Ahli Gizi Klinis
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Ruang Kerja Asuhan Gizi & Perencanaan Menu Individual
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Menilai kondisi gizi pasien (ADIME), menetapkan target nutrisi, mengevaluasi diet dokter, dan menyusun rencana menu individual aman.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={muatSemuaData}
                disabled={memuatData}
                className="gap-2 border-slate-300 hover:bg-slate-50"
              >
                <RefreshCw className={`w-4 h-4 ${memuatData ? "animate-spin" : ""}`} />
                Segarkan Data
              </Button>
              <Link href="/portal">
                <Button variant="ghost" size="sm" className="text-slate-600">
                  Ke Portal
                </Button>
              </Link>
            </div>
          </div>

          {/* Clinical Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Pasien Asuhan</span>
                <Users className="w-4 h-4 text-slate-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2">{totalPasien}</div>
              <div className="text-xs text-slate-500 mt-1">Pasien rawat inap aktif</div>
            </div>

            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-amber-800">Rujukan MST Baru</span>
                <Flame className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-bold text-amber-900 mt-2">{rujukanBaru}</div>
              <div className="text-xs text-amber-700 mt-1">Skrining MST ≥ 2 (Perlu ADIME)</div>
            </div>

            <div className="rounded-lg bg-sky-50 border border-sky-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-sky-800">Menu Perlu Sah</span>
                <Utensils className="w-4 h-4 text-sky-600" />
              </div>
              <div className="text-2xl font-bold text-sky-900 mt-2">{menuDraf}</div>
              <div className="text-xs text-sky-700 mt-1">Rencana menu draf/pending</div>
            </div>

            <div className="rounded-lg bg-rose-50 border border-rose-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-rose-800">Peringatan Asupan</span>
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-2xl font-bold text-rose-900 mt-2">{asupanRendah}</div>
              <div className="text-xs text-rose-700 mt-1">Asupan Comstock ≤ 25%</div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-white px-4 rounded-t-xl max-w-full overflow-x-auto [&>button]:shrink-0 [&>button]:whitespace-nowrap">
          <button
            onClick={() => setTabAktif("antrean")}
            className={`flex items-center gap-2 py-3 px-4 font-semibold text-sm border-b-2 transition-colors ${
              tabAktif === "antrean"
                ? "border-emerald-600 text-emerald-800"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Users className="w-4 h-4" />
            Antrean Pasien & Rujukan Skrining
            {rujukanBaru > 0 && (
              <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-900 font-bold">
                {rujukanBaru}
              </span>
            )}
          </button>
          <button
            onClick={() => setTabAktif("adime")}
            className={`flex items-center gap-2 py-3 px-4 font-semibold text-sm border-b-2 transition-colors ${
              tabAktif === "adime"
                ? "border-emerald-600 text-emerald-800"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <FileText className="w-4 h-4" />
            Riwayat Asuhan ADIME
            <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700">
              {riwayatAdime.length}
            </span>
          </button>
          <button
            onClick={() => setTabAktif("menu")}
            className={`flex items-center gap-2 py-3 px-4 font-semibold text-sm border-b-2 transition-colors ${
              tabAktif === "menu"
                ? "border-emerald-600 text-emerald-800"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <ChefHat className="w-4 h-4" />
            Rencana Menu & Resep
            {menuDraf > 0 && (
              <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-sky-100 text-sky-900 font-bold">
                {menuDraf} Draf
              </span>
            )}
          </button>
          <button
            onClick={() => setTabAktif("evaluasi")}
            className={`flex items-center gap-2 py-3 px-4 font-semibold text-sm border-b-2 transition-colors ${
              tabAktif === "evaluasi"
                ? "border-emerald-600 text-emerald-800"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <History className="w-4 h-4" />
            Monitoring & Evaluasi
            <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700">
              {riwayatEvaluasi.length}
            </span>
          </button>
        </div>

        {/* TAB 1: Antrean Pasien & Rujukan Skrining */}
        {tabAktif === "antrean" && (
          <div className="space-y-4">
            {/* Table Pasien */}
            <DataTableFoundation<ItemPasienDietisienDto>
              judulTabel="Daftar Pasien Konsultasi Gizi"
              deskripsiTabel="Daftar pasien rawat inap yang membutuhkan konsultasi, asuhan ADIME, atau penyesuaian menu individual"
              kolom={kolomPasien}
              data={pasienTersaring}
              ambilKunciBaris={(item: ItemPasienDietisienDto) => item.episodeId}
              kataKunciCari={kataKunciCari}
              onUbahKataKunciCari={setKataKunciCari}
              placeholderCari="Cari nama pasien, No RM, Bed, atau Diagnosis..."
              halamanSaatIni={1}
              totalHalaman={1}
              totalData={pasienTersaring.length}
              onUbahHalaman={() => {}}
              sedangMemuat={memuatData}
              judulKosong="Tidak Ada Pasien"
              deskripsiKosong="Tidak ada pasien rawat inap yang cocok dengan filter pencarian."
              slotFilterTambahan={
                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-slate-500" />
                  <select
                    value={filterBangsal}
                    onChange={(e) => setFilterBangsal(e.target.value)}
                    className="h-8 px-2 rounded border border-slate-300 text-xs bg-white"
                  >
                    <option value="SEMUA">Semua Bangsal</option>
                    <option value="BANGSAL-MELATI">Bangsal Melati</option>
                    <option value="BANGSAL-ANGGREK">Bangsal Anggrek</option>
                    <option value="BANGSAL-MAWAR">Bangsal Mawar</option>
                  </select>
                  <select
                    value={filterRisiko}
                    onChange={(e) => setFilterRisiko(e.target.value)}
                    className="h-8 px-2 rounded border border-slate-300 text-xs bg-white"
                  >
                    <option value="SEMUA">Semua Risiko MST</option>
                    <option value="risiko_tinggi">Risiko Tinggi (MST ≥ 2)</option>
                    <option value="risiko_rendah">Risiko Rendah</option>
                    <option value="belum_skrining">Belum Skrining</option>
                  </select>
                </div>
              }
            />
          </div>
        )}

        {/* TAB 2: Riwayat Asuhan Gizi ADIME */}
        {tabAktif === "adime" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Daftar Asuhan Gizi Terstandar (ADIME) Pasien
                </h2>
                <p className="text-xs text-slate-500">
                  Riwayat penetapan target nutrisi, diagnosis gizi terstandar (PES), dan rencana intervensi.
                </p>
              </div>
            </div>

            {riwayatAdime.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500">
                Belum ada asuhan gizi ADIME yang direkam. Pilih pasien pada tab Antrean untuk memulai asuhan gizi.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {riwayatAdime.map((a) => (
                  <div
                    key={a.id}
                    className="p-5 rounded-xl border border-slate-200 bg-white space-y-4 shadow-sm"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800 font-bold">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-base">
                            {a.namaPasien} ({a.nomorRekamMedis})
                          </div>
                          <div className="text-xs text-slate-500 font-mono">
                            No: {a.nomorAsuhan} • Ahli Gizi: {a.ahliGiziNama}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge varian="sesuai" label={a.statusAsuhan.toUpperCase()} />
                        <span className="text-xs text-slate-500">
                          Evaluasi: {a.tanggalEvaluasiUlang}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                      {/* A - Antropometri */}
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <div className="font-bold text-slate-800 mb-1 flex items-center gap-1">
                          <Scale className="w-3.5 h-3.5 text-emerald-700" />
                          A - Antropometri & Klinis
                        </div>
                        <div>BB: {a.antropometriBbKg ?? "-"} kg • TB: {a.antropometriTbCm ?? "-"} cm</div>
                        <div className="font-semibold text-emerald-800">
                          IMT: {a.antropometriImt ?? "-"} ({a.klasifikasiImt ?? "-"})
                        </div>
                        {a.biokimia && <div className="mt-1 text-slate-600">Lab: {a.biokimia}</div>}
                      </div>

                      {/* D - Diagnosis PES */}
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 md:col-span-2">
                        <div className="font-bold text-slate-800 mb-1 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                          D - Diagnosis Gizi (PES)
                        </div>
                        <div className="text-slate-700 leading-relaxed font-mono text-[11px]">
                          {a.diagnosisGiziPes}
                        </div>
                      </div>

                      {/* Target Nutrisi */}
                      <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                        <div className="font-bold text-emerald-900 mb-1 flex items-center gap-1">
                          <Flame className="w-3.5 h-3.5 text-emerald-700" />
                          Target Nutrisi
                        </div>
                        <div className="font-bold text-sm text-emerald-800">
                          {a.targetEnergiKkal} kkal
                        </div>
                        <div className="text-slate-600 mt-1">
                          Protein: {a.targetProteinGram}g • Lemak: {a.targetLemakGram}g
                        </div>
                        <div className="text-slate-600">
                          Karbohidrat: {a.targetKarbohidratGram}g
                        </div>
                      </div>
                    </div>

                    {/* I & ME */}
                    <div className="bg-slate-50/60 p-3 rounded-lg border border-slate-200 text-xs space-y-1">
                      <div>
                        <span className="font-semibold text-slate-800">Tujuan & Rencana Intervensi: </span>
                        <span className="text-slate-600">{a.tujuanIntervensi} — {a.rencanaIntervensi}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-800">Rencana Monitoring-Evaluasi: </span>
                        <span className="text-slate-600">{a.rencanaMonitoringEvaluasi}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Perencanaan Menu Individual & Katalog Resep */}
        {tabAktif === "menu" && (
          <div className="space-y-6">
            {/* Rencana Menu Individual */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Rencana Menu Individual Pasien
                  </h2>
                  <p className="text-xs text-slate-500">
                    Menu individual yang disahkan ahli gizi mengacu pada target nutrisi pasien (AB-011) dan bebas alergen (AB-007).
                  </p>
                </div>
              </div>

              {daftarMenuIndividual.length === 0 ? (
                <div className="p-6 text-center text-slate-500 border border-dashed rounded-lg">
                  Belum ada rencana menu individual yang disusun.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                        <th className="p-2.5">Tanggal & Jadwal</th>
                        <th className="p-2.5">Pasien</th>
                        <th className="p-2.5">Menu Terpilih</th>
                        <th className="p-2.5">Bentuk & Porsi</th>
                        <th className="p-2.5">Nutrisi (Kkal / P)</th>
                        <th className="p-2.5">Kesesuaian Alergi</th>
                        <th className="p-2.5">Status Pengesahan</th>
                        <th className="p-2.5 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {daftarMenuIndividual.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50">
                          <td className="p-2.5 font-medium">
                            <div>{m.tanggalPelayanan}</div>
                            <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-200 text-slate-800">
                              {m.jadwalMakan}
                            </span>
                          </td>
                          <td className="p-2.5">
                            <div className="font-semibold text-slate-900">{m.namaPasien}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{m.nomorRekamMedis}</div>
                          </td>
                          <td className="p-2.5 font-medium text-slate-800">
                            {m.namaMenu}
                            {m.catatanKhusus && (
                              <div className="text-[10px] text-slate-500 italic mt-0.5">
                                Catatan: {m.catatanKhusus}
                              </div>
                            )}
                          </td>
                          <td className="p-2.5 capitalize">
                            {m.bentukMakanan} ({m.porsi}x)
                          </td>
                          <td className="p-2.5">
                            <span className="font-semibold text-emerald-800">{m.energiKkal} kkal</span> • {m.proteinGram}g P
                          </td>
                          <td className="p-2.5">
                            {m.statusKesesuaian === "sesuai" ? (
                              <StatusBadge varian="sesuai" label="Aman / Bebas Alergen" />
                            ) : (
                              <div className="space-y-1">
                                <StatusBadge varian="ditahan" label="Tabrakan Alergi" />
                                <div className="text-[10px] text-rose-700 font-bold max-w-xs">
                                  {m.alasanTidakSesuai}
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="p-2.5">
                            {m.statusPengesahan === "disahkan" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                                <CheckCircle2 className="w-3 h-3" /> Sah
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                                <Clock className="w-3 h-3" /> Draf
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-right">
                            {m.statusPengesahan === "draf" && (
                              <Button
                                size="sm"
                                variant="default"
                                className={`h-7 text-xs ${
                                  m.statusKesesuaian === "tidak_sesuai_alergi"
                                    ? "bg-slate-400 cursor-not-allowed text-white"
                                    : "bg-emerald-600 hover:bg-emerald-700 text-white"
                                }`}
                                onClick={() => tanganiSahkanMenu(m.id)}
                                disabled={m.statusKesesuaian === "tidak_sesuai_alergi"}
                                title={
                                  m.statusKesesuaian === "tidak_sesuai_alergi"
                                    ? "Menu ini tidak boleh disahkan karena mengandung alergen pasien!"
                                    : "Sahkan menu individual ini"
                                }
                              >
                                Sahkan
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Master Katalog Menu & Resep Standar */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-emerald-700" />
                    Katalog Master Resep & Standar Makanan Rumah Sakit (Data Gudang & Dapur)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Standar porsi, komposisi bahan baku (untuk gudang), dan data gizi per resep (untuk dapur).
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {katalogResep.map((r) => (
                  <div
                    key={r.id}
                    className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2 text-xs"
                  >
                    <div className="flex items-start justify-between">
                      <div className="font-bold text-slate-900 text-sm">{r.namaMenu}</div>
                      <span className="font-mono text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                        {r.kodeMenu}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 text-[10px]">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 capitalize font-medium">
                        {r.kategoriMakanan.replace(/_/g, " ")}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 capitalize">
                        Tekstur: {r.bentukMakanan}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 capitalize">
                        {r.jenisDietTerkait.replace(/_/g, " ")}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-200 flex justify-between font-semibold text-slate-800">
                      <span>{r.energiKkal} kkal</span>
                      <span>P: {r.proteinGram}g</span>
                      <span>L: {r.lemakGram}g</span>
                      <span>KH: {r.karbohidratGram}g</span>
                    </div>

                    {/* Alergen */}
                    {r.alergen.length > 0 && (
                      <div className="flex items-center gap-1 text-[10px] text-rose-700">
                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                        Alergen: {r.alergen.join(", ")}
                      </div>
                    )}

                    {/* Komposisi Bahan Singkat */}
                    <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                      <span className="font-semibold text-slate-600">Bahan: </span>
                      {r.komposisiBahan.map((b) => `${b.namaBahan} (${b.jumlah}${b.satuan})`).join(", ")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Monitoring & Evaluasi Gizi */}
        {tabAktif === "evaluasi" && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">
                Riwayat Monitoring & Evaluasi Asuhan Gizi
              </h2>
              <p className="text-xs text-slate-500">
                Pencatatan perkembangan asupan, respon diet, dan rekomendasi tindak lanjut kepada dokter DPJP (AB-026, AB-028).
              </p>
            </div>

            {riwayatEvaluasi.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500">
                Belum ada evaluasi gizi yang dicatat. Buka antrean pasien dan klik tombol Monev untuk mencatat evaluasi berkala.
              </div>
            ) : (
              <div className="space-y-3">
                {riwayatEvaluasi.map((ev) => (
                  <div
                    key={ev.id}
                    className="bg-white p-4 rounded-xl border border-slate-200 text-xs space-y-2"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-2">
                      <div className="font-semibold text-slate-900 text-sm">
                        Evaluasi Tanggal: {ev.tanggalEvaluasi} • Oleh: {ev.ahliGiziNama}
                      </div>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] bg-slate-100 text-slate-800">
                        {ev.keputusanTindakLanjut.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-700">Catatan Asupan: </span>
                      <span className="text-slate-800">{ev.evaluasiAsupan}</span>
                      {ev.persentasePemenuhanAsupan !== null && (
                        <span className="ml-2 font-bold text-emerald-700">
                          ({ev.persentasePemenuhanAsupan}%)
                        </span>
                      )}
                    </div>
                    {ev.hambatanAsupan && (
                      <div>
                        <span className="font-bold text-amber-700">Hambatan Makan: </span>
                        <span className="text-slate-600">{ev.hambatanAsupan}</span>
                      </div>
                    )}
                    {ev.rekomendasiKeDokter && (
                      <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-amber-900">
                        <span className="font-bold flex items-center gap-1 mb-0.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Rekomendasi Terkirim ke Dokter DPJP:
                        </span>
                        {ev.rekomendasiKeDokter}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MODAL 1: Form Asuhan Gizi ADIME */}
        {modalAdimeBuka && pasienTerpilih && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
            <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in-50">
              <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center gap-2">
                  <Apple className="w-5 h-5 text-emerald-700" />
                  <h3 className="font-bold text-slate-900 text-base">
                    Formulir Asuhan Gizi Terstandar (ADIME)
                  </h3>
                </div>
                <button
                  onClick={() => setModalAdimeBuka(false)}
                  className="p-1 rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={tanganiSimpanAdime} className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Header Identitas & Verifikasi 2 Pengenal AB-020 */}
                <div className="p-3.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-950 text-sm">
                      {pasienTerpilih.namaPasien} ({pasienTerpilih.nomorRekamMedis})
                    </span>
                    <span className="font-semibold text-slate-700">
                      {pasienTerpilih.namaBangsal} • Bed {pasienTerpilih.nomorTempatTidur}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-700">
                    <div>Diagnosis DPJP: <span className="font-semibold">{pasienTerpilih.diagnosisUtama}</span></div>
                    <div>Diet Dokter: <span className="font-semibold capitalize">{pasienTerpilih.instruksiDietAktif ?? "Belum ada"}</span></div>
                  </div>
                  {pasienTerpilih.daftarAlergi.length > 0 && (
                    <div className="text-rose-700 font-bold">
                      Alergi Pasien: {pasienTerpilih.daftarAlergi.join(", ")}
                    </div>
                  )}

                  {/* Dua Pengenal Wajib */}
                  <div className="pt-2 border-t border-emerald-200 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-800" />
                    <label className="font-bold text-slate-900 text-xs">
                      Konfirmasi Tanggal Lahir Pasien (AB-020):
                    </label>
                    <input
                      type="date"
                      value={konfirmasiTglLahir}
                      onChange={(e) => setKonfirmasiTglLahir(e.target.value)}
                      required
                      className="h-8 px-2.5 rounded border border-emerald-300 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                    />
                  </div>
                </div>

                {/* Section A - Asesmen Gizi & Kalkulator IMT */}
                <div className="space-y-3">
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5 border-b pb-1">
                    <Scale className="w-4 h-4 text-emerald-700" />
                    A — Asesmen Gizi & Antropometri
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="font-semibold text-slate-700">Berat Badan (kg)</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Contoh: 58.5"
                        value={bbKg}
                        onChange={(e) => setBbKg(e.target.value ? Number(e.target.value) : "")}
                        className="w-full h-8 mt-1 px-2 rounded border border-slate-300 text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700">Tinggi Badan (cm)</label>
                      <input
                        type="number"
                        step="0.5"
                        placeholder="Contoh: 156"
                        value={tbCm}
                        onChange={(e) => setTbCm(e.target.value ? Number(e.target.value) : "")}
                        className="w-full h-8 mt-1 px-2 rounded border border-slate-300 text-xs"
                      />
                    </div>
                    <div className="md:col-span-2 bg-slate-50 p-2 rounded border border-slate-200 flex items-center justify-between">
                      <div>
                        <div className="text-[11px] text-slate-500">Kalkulasi IMT Otomatis:</div>
                        <div className="font-bold text-emerald-800 text-sm">
                          {imtHasil.imt !== null ? `${imtHasil.imt} kg/m²` : "Menunggu input BB & TB"}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-white border text-slate-700">
                        {imtHasil.klasifikasi}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="font-semibold text-slate-700">Data Biokimia / Lab</label>
                      <input
                        type="text"
                        placeholder="Hb, GDS, Albumin, Ureum, dll."
                        value={biokimia}
                        onChange={(e) => setBiokimia(e.target.value)}
                        className="w-full h-8 mt-1 px-2 rounded border border-slate-300 text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700">Pemeriksaan Fisik/Klinis</label>
                      <input
                        type="text"
                        placeholder="Tensi, edema, ascites, bising usus"
                        value={klinisFisik}
                        onChange={(e) => setKlinisFisik(e.target.value)}
                        className="w-full h-8 mt-1 px-2 rounded border border-slate-300 text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700">Riwayat Diet / Asupan</label>
                      <input
                        type="text"
                        placeholder="Pola makan, nafsu makan, pantangan"
                        value={riwayatDiet}
                        onChange={(e) => setRiwayatDiet(e.target.value)}
                        className="w-full h-8 mt-1 px-2 rounded border border-slate-300 text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Section D - Diagnosis Gizi PES */}
                <div className="space-y-2">
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5 border-b pb-1">
                    <AlertTriangle className="w-4 h-4 text-amber-700" />
                    D — Diagnosis Gizi Terstandar (PES: Problem, Etiology, Signs & Symptoms)
                  </h4>
                  <textarea
                    rows={2}
                    value={diagnosisPes}
                    onChange={(e) => setDiagnosisPes(e.target.value)}
                    required
                    placeholder="Contoh: NI-5.1 Peningkatan kebutuhan protein berkaitan dengan kondisi pemulihan pasca bedah dibuktikan dengan estimasi asupan < 60% dan albumin 3.0"
                    className="w-full p-2.5 rounded-lg border border-slate-300 text-xs focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                </div>

                {/* Section Target Nutrisi Individual */}
                <div className="space-y-3">
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5 border-b pb-1">
                    <Flame className="w-4 h-4 text-emerald-700" />
                    Target Kebutuhan Nutrisi Pasien (AB-027)
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="font-semibold text-slate-700">Energi (Kkal) *</label>
                      <input
                        type="number"
                        value={targetKalori}
                        onChange={(e) => setTargetKalori(e.target.value === "" ? "" : Number(e.target.value))}
                        required
                        className="w-full h-8 mt-1 px-2 rounded border border-slate-300 text-xs font-bold text-emerald-800"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700">Protein (g) *</label>
                      <input
                        type="number"
                        step="0.5"
                        value={targetProtein}
                        onChange={(e) => setTargetProtein(e.target.value === "" ? "" : Number(e.target.value))}
                        required
                        className="w-full h-8 mt-1 px-2 rounded border border-slate-300 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700">Lemak (g) *</label>
                      <input
                        type="number"
                        step="0.5"
                        value={targetLemak}
                        onChange={(e) => setTargetLemak(e.target.value === "" ? "" : Number(e.target.value))}
                        required
                        className="w-full h-8 mt-1 px-2 rounded border border-slate-300 text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700">Karbohidrat (g) *</label>
                      <input
                        type="number"
                        step="0.5"
                        value={targetKh}
                        onChange={(e) => setTargetKh(e.target.value === "" ? "" : Number(e.target.value))}
                        required
                        className="w-full h-8 mt-1 px-2 rounded border border-slate-300 text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700">Cairan (ml)</label>
                      <input
                        type="number"
                        value={targetCairan}
                        onChange={(e) => setTargetCairan(e.target.value === "" ? "" : Number(e.target.value))}
                        className="w-full h-8 mt-1 px-2 rounded border border-slate-300 text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700">Serat (g)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={targetSerat}
                        onChange={(e) => setTargetSerat(e.target.value === "" ? "" : Number(e.target.value))}
                        className="w-full h-8 mt-1 px-2 rounded border border-slate-300 text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700">Natrium (mg)</label>
                      <input
                        type="number"
                        value={targetNatrium}
                        onChange={(e) => setTargetNatrium(e.target.value === "" ? "" : Number(e.target.value))}
                        className="w-full h-8 mt-1 px-2 rounded border border-slate-300 text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700">Tanggal Evaluasi Ulang</label>
                      <input
                        type="date"
                        value={tanggalEvaluasiUlang}
                        onChange={(e) => setTanggalEvaluasiUlang(e.target.value)}
                        required
                        className="w-full h-8 mt-1 px-2 rounded border border-slate-300 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Section I & ME */}
                <div className="space-y-3">
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5 border-b pb-1">
                    <HeartPulse className="w-4 h-4 text-emerald-700" />
                    I & ME — Intervensi, Monitoring & Evaluasi Gizi
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="font-semibold text-slate-700">Tujuan Intervensi Gizi *</label>
                      <textarea
                        rows={2}
                        value={tujuanIntervensi}
                        onChange={(e) => setTujuanIntervensi(e.target.value)}
                        required
                        className="w-full mt-1 p-2 rounded border border-slate-300 text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700">Rencana Intervensi (Diet & Edukasi) *</label>
                      <textarea
                        rows={2}
                        value={rencanaIntervensi}
                        onChange={(e) => setRencanaIntervensi(e.target.value)}
                        required
                        className="w-full mt-1 p-2 rounded border border-slate-300 text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 text-xs">Rencana Monitoring & Evaluasi *</label>
                    <input
                      type="text"
                      value={rencanaMonev}
                      onChange={(e) => setRencanaMonev(e.target.value)}
                      required
                      placeholder="Parameter yang dipantau (toleransi asupan, keluhan cerna, gula darah, dll.)"
                      className="w-full h-8 mt-1 px-2 rounded border border-slate-300 text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setModalAdimeBuka(false)}
                    disabled={sedangSimpanAdime}
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                    disabled={sedangSimpanAdime}
                  >
                    {sedangSimpanAdime ? "Mengesahkan..." : "Sahkan Asuhan Gizi (ADIME)"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: Susun Menu Individual */}
        {modalMenuBuka && pasienTerpilih && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
            <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full flex flex-col overflow-hidden animate-in fade-in-50">
              <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center gap-2">
                  <Utensils className="w-5 h-5 text-emerald-700" />
                  <h3 className="font-bold text-slate-900 text-base">
                    Susun Rencana Menu Individual Pasien
                  </h3>
                </div>
                <button
                  onClick={() => setModalMenuBuka(false)}
                  className="p-1 rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={tanganiSimpanMenu} className="p-5 space-y-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="font-bold text-slate-900 text-sm">{pasienTerpilih.namaPasien}</div>
                  <div className="text-slate-500 font-mono mt-0.5">
                    {pasienTerpilih.nomorRekamMedis} • Bangsal: {pasienTerpilih.namaBangsal}
                  </div>
                  {pasienTerpilih.daftarAlergi.length > 0 && (
                    <div className="mt-1 text-rose-700 font-bold">
                      Alergi: {pasienTerpilih.daftarAlergi.join(", ")}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700">Tanggal Pelayanan</label>
                    <input
                      type="date"
                      value={tanggalPelayananMenu}
                      onChange={(e) => setTanggalPelayananMenu(e.target.value)}
                      required
                      className="w-full h-8 mt-1 px-2 rounded border border-slate-300 font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700">Jadwal Makan</label>
                    <select
                      value={jadwalMakanTerpilih}
                      onChange={(e) => setJadwalMakanTerpilih(e.target.value as JadwalMakanMenu)}
                      className="w-full h-8 mt-1 px-2 rounded border border-slate-300 bg-white"
                    >
                      <option value="pagi">Makan Pagi</option>
                      <option value="snack_pagi">Selingan Pagi</option>
                      <option value="siang">Makan Siang</option>
                      <option value="snack_sore">Selingan Sore</option>
                      <option value="malam">Makan Malam</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Pilih Menu dari Katalog Resep Standar</label>
                  <select
                    value={menuTerpilihId}
                    onChange={(e) => setMenuTerpilihId(e.target.value)}
                    required
                    className="w-full h-9 mt-1 px-2 rounded border border-slate-300 bg-white text-xs font-medium"
                  >
                    {katalogResep.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.namaMenu} ({k.energiKkal} kkal, {k.proteinGram}g P) — {k.bentukMakanan}
                        {k.alergen.length > 0 ? ` [Alergen: ${k.alergen.join(", ")}]` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Preview Alergen Menu Terpilih */}
                {(() => {
                  const menuObj = katalogResep.find((k) => k.id === menuTerpilihId);
                  if (!menuObj) return null;
                  const alergenTabrakan = menuObj.alergen.filter((alg) =>
                    pasienTerpilih.daftarAlergi.some((pa) =>
                      pa.toLowerCase().includes(alg.toLowerCase()) || alg.toLowerCase().includes(pa.toLowerCase())
                    )
                  );
                  if (alergenTabrakan.length > 0) {
                    return (
                      <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-800 space-y-1">
                        <div className="font-bold flex items-center gap-1">
                          <AlertTriangle className="w-4 h-4 text-rose-600" />
                          PERINGATAN BAHAYA ALERGI PASIEN!
                        </div>
                        <div>
                          Menu ini mengandung <strong>{alergenTabrakan.join(", ")}</strong> yang tercatat sebagai alergen pasien. Jika disimpan, menu akan berstatus <em>tidak_sesuai_alergi</em> dan ditolak pengesahannya.
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700">Porsi</label>
                    <input
                      type="number"
                      step="0.25"
                      min="0.25"
                      max="3.0"
                      value={porsiMenu}
                      onChange={(e) => setPorsiMenu(Number(e.target.value))}
                      className="w-full h-8 mt-1 px-2 rounded border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700">Catatan Khusus</label>
                    <input
                      type="text"
                      placeholder="Contoh: Tanpa garam, kuah dipisah"
                      value={catatanKhususMenu}
                      onChange={(e) => setCatatanKhususMenu(e.target.value)}
                      className="w-full h-8 mt-1 px-2 rounded border border-slate-300"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setModalMenuBuka(false)}
                    disabled={sedangSimpanMenu}
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                    disabled={sedangSimpanMenu}
                  >
                    {sedangSimpanMenu ? "Menyimpan..." : "Simpan Rencana Menu"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 3: Form Evaluasi Gizi Berkala */}
        {modalEvaluasiBuka && pasienTerpilih && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full flex flex-col overflow-hidden animate-in fade-in-50">
              <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-amber-700" />
                  <h3 className="font-bold text-slate-900 text-base">
                    Monitoring & Evaluasi Asuhan Gizi Berkala
                  </h3>
                </div>
                <button
                  onClick={() => setModalEvaluasiBuka(false)}
                  className="p-1 rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={tanganiSimpanEvaluasi} className="p-5 space-y-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="font-bold text-slate-900">{pasienTerpilih.namaPasien} ({pasienTerpilih.nomorRekamMedis})</div>
                  <div className="text-slate-500 mt-0.5">Bangsal: {pasienTerpilih.namaBangsal} • Bed {pasienTerpilih.nomorTempatTidur}</div>
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Catatan Evaluasi Asupan Makan *</label>
                  <textarea
                    rows={2}
                    value={evaluasiAsupanTeks}
                    onChange={(e) => setEvaluasiAsupanTeks(e.target.value)}
                    required
                    placeholder="Contoh: Asupan makan 50% porsi karena keluhan mual dan nafsu makan berkurang."
                    className="w-full mt-1 p-2 rounded border border-slate-300"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700">Estimasi Pemenuhan (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={persentaseAsupanInput}
                      onChange={(e) => setPersentaseAsupanInput(Number(e.target.value))}
                      className="w-full h-8 mt-1 px-2 rounded border border-slate-300 font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700">Hambatan Makan</label>
                    <input
                      type="text"
                      placeholder="Mual, kembung, nyeri menelan"
                      value={hambatanAsupanTeks}
                      onChange={(e) => setHambatanAsupanTeks(e.target.value)}
                      className="w-full h-8 mt-1 px-2 rounded border border-slate-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Keputusan Tindak Lanjut *</label>
                  <select
                    value={keputusanTindakLanjut}
                    onChange={(e) => setKeputusanTindakLanjut(e.target.value as KeputusanTindakLanjutGizi)}
                    className="w-full h-8 mt-1 px-2 rounded border border-slate-300 bg-white"
                  >
                    <option value="lanjutkan_rencana">Lanjutkan Rencana Asuhan</option>
                    <option value="modifikasi_diet">Modifikasi Bentuk / Komposisi Diet</option>
                    <option value="rujuk_dpjp">Rujuk ke Dokter DPJP (Kirim Rekomendasi)</option>
                    <option value="selesai_asuhan">Selesai Asuhan Gizi</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700">
                    Rekomendasi ke Dokter DPJP (Otomatis Dikirim via Notifikasi)
                  </label>
                  <textarea
                    rows={2}
                    value={rekomendasiDokterTeks}
                    onChange={(e) => setRekomendasiDokterTeks(e.target.value)}
                    placeholder="Contoh: Mohon pertimbangan antiemetik oral atau penyesuaian rute nutrisi bila asupan tetap < 50%."
                    className="w-full mt-1 p-2 rounded border border-slate-300 font-mono text-[11px]"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setModalEvaluasiBuka(false)}
                    disabled={sedangSimpanEvaluasi}
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                    disabled={sedangSimpanEvaluasi}
                  >
                    {sedangSimpanEvaluasi ? "Menyimpan..." : "Simpan Evaluasi Gizi"}
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
