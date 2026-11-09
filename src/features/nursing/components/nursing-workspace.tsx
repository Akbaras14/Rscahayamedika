/**
 * @fileoverview Workspace antarmuka pengguna untuk Peran Perawat.
 * Mengimplementasikan:
 * 1. Daftar Pasien Bangsal Rawat Inap (isolasi wilayah bangsal AB-032).
 * 2. Verifikasi Keamanan Makanan Awal (dua pengenal AB-020, disfagia, NPO AB-008, safety hold).
 * 3. Skrining Risiko Gangguan Gizi (MST) & Pemicu Rujukan Ahli Gizi (BRD Bab V.5.2).
 * 4. Observasi Asupan Klinis Skala Comstock (BRD Bab X.10.1, 10.2).
 */

"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  HeartPulse,
  History,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
  Utensils,
  X,
} from "lucide-react";
import { StatusBadge, type VarianStatusBadge } from "@/components/atoms/status-badge";
import { FormFieldMolecule } from "@/components/molecules/form-field";
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
  ItemObservasiAsupanDto,
  ItemPasienBangsalPerawatDto,
  ItemSkriningGiziDto,
  ItemVerifikasiKeamananMakananDto,
  JadwalMakan,
  KategoriPenurunanBb,
  KemampuanMenelan,
  KondisiPemberianMakanan,
  ResponsApi,
  SkalaComstock,
  StatusKesadaran,
  StatusPuasaNpo,
} from "../../../../packages/shared-types/src/index.ts";

type TabPerawat = "pasien" | "asupan";

export function NursingWorkspace() {
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

  const [tabAktif, setTabAktif] = useState<TabPerawat>("pasien");
  const [kataKunciCari, setKataKunciCari] = useState("");
  const [daftarPasien, setDaftarPasien] = useState<ItemPasienBangsalPerawatDto[]>([]);
  const [riwayatObservasi, setRiwayatObservasi] = useState<ItemObservasiAsupanDto[]>([]);
  const [memuatData, setMemuatData] = useState(false);
  const [pesanGalat, setPesanGalat] = useState<string | null>(null);
  const [pesanSukses, setPesanSukses] = useState<string | null>(null);

  // Pasien terpilih untuk aksi modal
  const [pasienTerpilih, setPasienTerpilih] = useState<ItemPasienBangsalPerawatDto | null>(null);

  // State Modal Verifikasi Makanan (AB-020)
  const [modalVerifikasiTerbuka, setModalVerifikasiTerbuka] = useState(false);
  const [inputDobKonfirmasi, setInputDobKonfirmasi] = useState("");
  const [apakahIdentitasSesuai, setApakahIdentitasSesuai] = useState(false);
  const [apakahDietSesuai, setApakahDietSesuai] = useState(false);
  const [apakahAlergiTerkonfirmasi, setApakahAlergiTerkonfirmasi] = useState(false);
  const [kemampuanMenelan, setKemampuanMenelan] = useState<KemampuanMenelan | "">("");
  const [statusKesadaran, setStatusKesadaran] = useState<StatusKesadaran | "">("");
  const [statusPuasaNpo, setStatusPuasaNpo] = useState<StatusPuasaNpo | "">("");
  const [keputusanVerifikasi, setKeputusanVerifikasi] = useState<"aman_lolos" | "ditahan_safety_hold">("ditahan_safety_hold");
  const [alasanPenahanan, setAlasanPenahanan] = useState("");
  const [tindakanEskalasi, setTindakanEskalasi] = useState("");
  const [sedangMemverifikasi, setSedangMemverifikasi] = useState(false);

  // State Modal Skrining Gizi MST (BRD Bab V.5.2)
  const [modalMstTerbuka, setModalMstTerbuka] = useState(false);
  const [penurunanBb, setPenurunanBb] = useState<KategoriPenurunanBb>("tidak_ada");
  const [asupanBerkurang, setAsupanBerkurang] = useState(false);
  const [catatanMst, setCatatanMst] = useState("");
  const [sedangSkrining, setSedangSkrining] = useState(false);

  // State Modal Observasi Asupan Comstock (BRD Bab X.10.1)
  const [modalComstockTerbuka, setModalComstockTerbuka] = useState(false);
  const [jadwalMakan, setJadwalMakan] = useState<JadwalMakan>("siang");
  const [skalaComstock, setSkalaComstock] = useState<SkalaComstock>("skala_100");
  const [kondisiPemberian, setKondisiPemberian] = useState<KondisiPemberianMakanan>("belum_diobservasi");
  const [alasanTidakHabis, setAlasanTidakHabis] = useState<string>("");
  const [catatanComstock, setCatatanComstock] = useState("");
  const [sedangObservasi, setSedangObservasi] = useState(false);

  // Hitung Skor MST di UI
  const hitungSkorPenurunanBb = (kat: KategoriPenurunanBb): number => {
    switch (kat) {
      case "1_sampai_5_kg":
        return 1;
      case "ragu_pakaian_longgar":
      case "6_sampai_10_kg":
        return 2;
      case "11_sampai_15_kg":
        return 3;
      case "lebih_15_kg":
        return 4;
      default:
        return 0;
    }
  };
  const skorMstKalkulasi = hitungSkorPenurunanBb(penurunanBb) + (asupanBerkurang ? 1 : 0);

  // Muat data pasien & observasi bangsal
  const muatDataBangsal = async () => {
    if (!profil || profil.peran !== "perawat") return;
    setMemuatData(true);
    setPesanGalat(null);

    const bangsalAktif = profil.daftarBangsalId?.[0] || "BANGSAL-ANGGREK";

    try {
      const [resPasien, resObs] = await Promise.all([
        fetch(`/api/v1/nursing/patients?bangsalId=${encodeURIComponent(bangsalAktif)}`),
        fetch(`/api/v1/nursing/intake-observations?bangsalId=${encodeURIComponent(bangsalAktif)}`),
      ]);

      if (resPasien.ok) {
        const json = (await resPasien.json()) as ResponsApi<{ items: ItemPasienBangsalPerawatDto[] }>;
        if (json.sukses) {
          setDaftarPasien(json.data.items);
        }
      } else {
        const errJson = (await resPasien.json()) as ResponsApi<never>;
        if (!errJson.sukses) {
          setPesanGalat(errJson.galat.pesan);
        }
      }

      if (resObs.ok) {
        const jsonObs = (await resObs.json()) as ResponsApi<{ items: ItemObservasiAsupanDto[] }>;
        if (jsonObs.sukses) {
          setRiwayatObservasi(jsonObs.data.items);
        }
      }
    } catch (err) {
      setPesanGalat(
        err instanceof Error ? err.message : "Gagal memuat data pasien bangsal keperawatan.",
      );
    } finally {
      setMemuatData(false);
    }
  };

  useEffect(() => {
    if (profil && profil.peran === "perawat") {
      const timer = setTimeout(() => {
        void muatDataBangsal();
      }, 0);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profil]);

  // Handle Submit Verifikasi Keamanan Makanan (AB-020, AB-008)
  const handleKirimVerifikasi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pasienTerpilih) return;
    if (!inputDobKonfirmasi || !kemampuanMenelan || !statusKesadaran || !statusPuasaNpo) {
      setPesanGalat("Konfirmasi tanggal lahir, kemampuan menelan, kesadaran, dan status puasa wajib diperiksa.");
      return;
    }
    if (keputusanVerifikasi === "aman_lolos" && (!apakahIdentitasSesuai || !apakahDietSesuai || !apakahAlergiTerkonfirmasi)) {
      setPesanGalat("Verifikasi hanya dapat diloloskan setelah identitas, diet, dan alergi dikonfirmasi sesuai.");
      return;
    }
    setSedangMemverifikasi(true);
    setPesanGalat(null);

    try {
      const res = await fetch("/api/v1/nursing/food-safety-verifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          episodeId: pasienTerpilih.episodeId,
          konfirmasiTanggalLahir: inputDobKonfirmasi,
          apakahIdentitasSesuai,
          apakahDietSesuai,
          apakahAlergiTerkonfirmasi,
          kemampuanMenelan,
          statusKesadaran,
          statusPuasaNpo,
          keputusan: keputusanVerifikasi,
          alasanPenahanan: keputusanVerifikasi === "ditahan_safety_hold" ? alasanPenahanan : null,
          tindakanEskalasi: keputusanVerifikasi === "ditahan_safety_hold" ? tindakanEskalasi : null,
        }),
      });

      const json = (await res.json()) as ResponsApi<ItemVerifikasiKeamananMakananDto>;
      if (!res.ok || !json.sukses) {
        throw new Error(
          !json.sukses
            ? json.galat.pesan
            : "Verifikasi makanan gagal disimpan.",
        );
      }

      setPesanSukses(
        keputusanVerifikasi === "aman_lolos"
          ? `Verifikasi ${json.data.nomorVerifikasi} lolos aman. Makanan siap disajikan ke pasien ${pasienTerpilih.namaPasien}.`
          : `Penahanan keselamatan ${json.data.nomorVerifikasi} diaktifkan! Notifikasi darurat dikirim ke Dokter DPJP.`,
      );
      setModalVerifikasiTerbuka(false);
      await muatDataBangsal();
    } catch (err) {
      setPesanGalat(err instanceof Error ? err.message : "Terjadi kesalahan saat memverifikasi.");
    } finally {
      setSedangMemverifikasi(false);
    }
  };

  // Handle Submit Skrining Gizi MST (BRD Bab V.5.2)
  const handleKirimSkriningMst = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pasienTerpilih) return;
    setSedangSkrining(true);
    setPesanGalat(null);

    try {
      const res = await fetch("/api/v1/nursing/nutrition-screenings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          episodeId: pasienTerpilih.episodeId,
          penurunanBeratBadan: penurunanBb,
          asupanMakanBerkurang: asupanBerkurang,
          catatanSkrining: catatanMst || null,
        }),
      });

      const json = (await res.json()) as ResponsApi<ItemSkriningGiziDto>;
      if (!res.ok || !json.sukses) {
        throw new Error(
          !json.sukses
            ? json.galat.pesan
            : "Perekaman skrining MST gagal.",
        );
      }

      setPesanSukses(
        `Skrining MST berhasil direkam (${json.data.nomorSkrining}). Skor: ${json.data.totalSkor} (${json.data.kategoriRisiko.replace("_", " ")}). ${
          json.data.perluPenilaianLanjut
            ? "Otomatis memicu rujukan ke Ahli Gizi Klinis."
            : "Pasien dalam status gizi aman."
        }`,
      );
      setModalMstTerbuka(false);
      await muatDataBangsal();
    } catch (err) {
      setPesanGalat(err instanceof Error ? err.message : "Terjadi kesalahan saat skrining.");
    } finally {
      setSedangSkrining(false);
    }
  };

  // Handle Submit Observasi Asupan Comstock (BRD Bab X.10.1)
  const handleKirimObservasiComstock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pasienTerpilih) return;
    setSedangObservasi(true);
    setPesanGalat(null);

    const hariIni = new Date().toISOString().split("T")[0];

    try {
      const res = await fetch("/api/v1/nursing/intake-observations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          episodeId: pasienTerpilih.episodeId,
          tanggalMakan: hariIni,
          jadwalMakan,
          skalaComstock,
          kondisiPemberian,
          alasanTidakHabis: skalaComstock !== "skala_100" ? alasanTidakHabis || "tidak_nafsu_makan" : null,
          catatanObservasi: catatanComstock || null,
        }),
      });

      const json = (await res.json()) as ResponsApi<ItemObservasiAsupanDto>;
      if (!res.ok || !json.sukses) {
        throw new Error(
          !json.sukses
            ? json.galat.pesan
            : "Pencatatan asupan Comstock gagal.",
        );
      }

      setPesanSukses(
        `Observasi asupan ${json.data.jadwalMakan} berhasil dicatat (${json.data.persentaseKonsumsi}%). ${
          json.data.peringatanAsupanRendah
            ? "⚠️ Peringatan asupan rendah (<=25%) diteruskan ke Dokter DPJP."
            : ""
        }`,
      );
      setModalComstockTerbuka(false);
      await muatDataBangsal();
    } catch (err) {
      setPesanGalat(err instanceof Error ? err.message : "Terjadi kesalahan saat mencatat asupan.");
    } finally {
      setSedangObservasi(false);
    }
  };

  if (sedangMemuatSesi) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoadingState
          judul="Memuat Workspace Perawat..."
          deskripsi="Memverifikasi izin akses dan penugasan bangsal binaan..."
        />
      </div>
    );
  }

  if (!profil || profil.peran !== "perawat") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white p-6 rounded-lg shadow-sm border border-slate-200 text-center space-y-4">
          <PermissionDeniedState
            pesan="Akses Terbatas: Khusus Perawat Bangsal."
            detailKonteks="Sesuai Aturan Keselamatan AB-032, verifikasi makanan dan asuhan keperawatan memerlukan wewenang Perawat yang ditugaskan pada bangsal terkait."
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

  const bangsalAktifNama = profil.daftarBangsalId?.[0] || "BANGSAL-ANGGREK";

  // Filter daftar pasien
  const daftarPasienTersaring = daftarPasien.filter((p) => {
    const k = kataKunciCari.toLowerCase();
    return (
      p.namaPasien.toLowerCase().includes(k) ||
      p.nomorRekamMedis.toLowerCase().includes(k) ||
      p.nomorTempatTidur.toLowerCase().includes(k) ||
      p.jenisDiet.toLowerCase().includes(k)
    );
  });

  const kolomPasien: readonly DefinisiKolomTabel<ItemPasienBangsalPerawatDto>[] = [
    {
      id: "identitas",
      header: "Pasien / Bed",
      renderSel: (p: ItemPasienBangsalPerawatDto) => (
        <div>
          <div className="font-semibold text-slate-900">{p.namaPasien}</div>
          <div className="text-xs text-slate-500 font-mono">
            {p.nomorRekamMedis} • {p.usiaTahun} thn • {p.jenisKelamin === "laki_laki" ? "L" : "P"}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
            <Building2 className="w-3.5 h-3.5" />
            <span>Kamar {p.nomorKamar} • Bed {p.nomorTempatTidur}</span>
          </div>
        </div>
      ),
    },
    {
      id: "diet",
      header: "Diet DPJP & Alergi",
      renderSel: (p: ItemPasienBangsalPerawatDto) => (
        <div>
          <div className="font-medium text-slate-800">{p.jenisDiet}</div>
          <div className="text-xs text-slate-500">Tekstur: {p.bentukMakanan}</div>
          {p.statusPuasaNpo && (
            <span className="inline-block mt-1 px-2 py-0.5 text-xs font-semibold rounded bg-red-100 text-red-800">
              ⛔ NPO / Puasa Medis
            </span>
          )}
          {p.daftarAlergenAktif.length > 0 && (
            <div className="mt-1 text-xs text-amber-700 font-medium">
              ⚠️ Alergi: {p.daftarAlergenAktif.join(", ")}
            </div>
          )}
        </div>
      ),
    },
    {
      id: "keamanan",
      header: "Verifikasi Makanan",
      renderSel: (p: ItemPasienBangsalPerawatDto) => {
        let varian: VarianStatusBadge = "netral";
        let label = "Belum Diverifikasi";
        if (p.statusVerifikasiKeamanan === "aman_lolos") {
          varian = "sesuai";
          label = "Aman & Lolos";
        } else if (p.statusVerifikasiKeamanan === "ditahan_safety_hold") {
          varian = "ditahan";
          label = "Ditahan (Safety Hold)";
        }
        return (
          <div>
            <StatusBadge varian={varian} label={label} />
            {p.terakhirDiverifikasiPada && (
              <div className="text-[11px] text-slate-400 mt-1">
                {new Date(p.terakhirDiverifikasiPada).toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: "skrining",
      header: "Skrining Gizi (MST)",
      renderSel: (p: ItemPasienBangsalPerawatDto) => {
        if (p.statusSkriningGizi === "belum_diskrining") {
          return <span className="text-xs text-slate-400 italic">Belum diskrining</span>;
        }
        const risikoTinggi = p.skorMstTerakhir !== null && p.skorMstTerakhir >= 2;
        return (
          <div>
            <StatusBadge
              varian={risikoTinggi ? "ditahan" : "sesuai"}
              label={`Skor ${p.skorMstTerakhir ?? 0} — ${p.kategoriRisikoGizi?.replace("_", " ")}`}
            />
            {p.perluPenilaianLanjut && (
              <div className="text-xs text-rose-700 font-medium mt-1">
                📋 Rujukan ADIME
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: "aksi",
      header: "Tindakan Keperawatan",
      renderSel: (p: ItemPasienBangsalPerawatDto) => (
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="default"
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-2"
            onClick={() => {
              setPasienTerpilih(p);
              setInputDobKonfirmasi("");
              setApakahIdentitasSesuai(false);
              setApakahDietSesuai(false);
              setApakahAlergiTerkonfirmasi(false);
              setKemampuanMenelan("");
              setStatusKesadaran("");
              setStatusPuasaNpo("");
              setKeputusanVerifikasi("ditahan_safety_hold");
              setAlasanPenahanan("");
              setTindakanEskalasi("");
              setModalVerifikasiTerbuka(true);
            }}
          >
            <ShieldCheck className="w-3.5 h-3.5 mr-1" />
            Verifikasi
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 px-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            onClick={() => {
              setPasienTerpilih(p);
              setPenurunanBb("tidak_ada");
              setAsupanBerkurang(false);
              setCatatanMst("");
              setModalMstTerbuka(true);
            }}
          >
            <HeartPulse className="w-3.5 h-3.5 mr-1" />
            MST
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 px-2 border-amber-200 text-amber-700 hover:bg-amber-50"
            onClick={() => {
              setPasienTerpilih(p);
              setJadwalMakan("siang");
              setSkalaComstock("skala_100");
              setKondisiPemberian("dikonsumsi_seluruhnya");
              setAlasanTidakHabis("");
              setCatatanComstock("");
              setModalComstockTerbuka(true);
            }}
          >
            <Utensils className="w-3.5 h-3.5 mr-1" />
            Asupan
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AppShellTemplate
      judulDiKonten
      judulHalaman="Asuhan Keperawatan & Verifikasi Makanan"
      subjudulHalaman="Verifikasi dua pengenal (AB-020), pencegahan bahaya disfagia/NPO, skrining risiko gizi MST (V.5.2), dan observasi asupan Comstock (X.10.1)."
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
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header Ruang Kerja */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                Perawat
              </span>
              <span className="text-xs font-mono text-slate-500">
                Bangsal: <strong className="text-slate-800">{bangsalAktifNama}</strong>
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">
              Asuhan Keperawatan & Keamanan Makanan Bangsal
            </h1>
            <p className="text-sm text-slate-600">
              Verifikasi dua pengenal (AB-020), pencegahan bahaya disfagia/NPO, skrining gizi MST (V.5.2), dan observasi asupan Comstock (X.10.1).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={muatDataBangsal}
              disabled={memuatData}
              className="text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${memuatData ? "animate-spin" : ""}`} />
              Segarkan Data
            </Button>
            <Link href="/portal">
              <Button variant="ghost" size="sm" className="text-xs">
                Portal Utama
              </Button>
            </Link>
          </div>
        </div>

        {/* Feedback Banners */}
        {pesanSukses && (
          <MinimalToastBanner
            jenis="berhasil"
            pesan={pesanSukses}
            onTutup={() => setPesanSukses(null)}
          />
        )}
        {pesanGalat && (
          <SafetyHoldBanner
            judul="Peringatan Keselamatan Keperawatan"
            alasanPenahanan={pesanGalat}
            tindakLanjutWajib="Periksa kembali kecocokan identitas pasien, instruksi diet DPJP, atau laporkan ke kepala ruangan."
          />
        )}

        {/* Metrik Singkat Bangsal */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-700 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">{daftarPasien.length}</div>
              <div className="text-xs text-slate-500 font-medium">Pasien Aktif Bangsal</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">
                {daftarPasien.filter((p) => p.statusVerifikasiKeamanan === "aman_lolos").length}
              </div>
              <div className="text-xs text-slate-500 font-medium">Makanan Diverifikasi Aman</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 text-amber-700 rounded-lg">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">
                {daftarPasien.filter((p) => p.perluPenilaianLanjut).length}
              </div>
              <div className="text-xs text-slate-500 font-medium">Rujukan Gizi (MST &ge; 2)</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="p-2.5 bg-rose-50 text-rose-700 rounded-lg">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">
                {daftarPasien.filter((p) => p.statusVerifikasiKeamanan === "ditahan_safety_hold").length}
              </div>
              <div className="text-xs text-slate-500 font-medium">Makanan Ditahan (Safety Hold)</div>
            </div>
          </div>
        </div>

        {/* Tab Navigasi */}
        <div className="flex border-b border-slate-200 gap-2">
          <button
            type="button"
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              tabAktif === "pasien"
                ? "border-emerald-600 text-emerald-700 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
            onClick={() => setTabAktif("pasien")}
          >
            <Users className="w-4 h-4" />
            Pasien Bangsal Binaan ({daftarPasien.length})
          </button>

          <button
            type="button"
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              tabAktif === "asupan"
                ? "border-emerald-600 text-emerald-700 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
            onClick={() => setTabAktif("asupan")}
          >
            <History className="w-4 h-4" />
            Riwayat Observasi Comstock ({riwayatObservasi.length})
          </button>
        </div>

        {/* Isi Tab Pasien Bangsal */}
        {tabAktif === "pasien" && (
          <div className="space-y-4">
            <DataTableFoundation<ItemPasienBangsalPerawatDto>
              judulTabel="Daftar Pasien Bangsal Binaan"
              deskripsiTabel={`Menampilkan seluruh pasien rawat inap aktif di ${bangsalAktifNama}`}
              kolom={kolomPasien}
              data={daftarPasienTersaring}
              ambilKunciBaris={(p) => p.episodeId}
              kataKunciCari={kataKunciCari}
              onUbahKataKunciCari={setKataKunciCari}
              placeholderCari="Cari nama pasien, No RM, Bed, Diet..."
              halamanSaatIni={1}
              totalHalaman={1}
              totalData={daftarPasienTersaring.length}
              onUbahHalaman={() => {}}
              sedangMemuat={memuatData}
              judulKosong="Tidak ada pasien aktif"
              deskripsiKosong="Belum ada pasien yang dialokasikan di bangsal ini atau filter pencarian tidak cocok."
            />
          </div>
        )}

        {/* Isi Tab Riwayat Observasi Asupan */}
        {tabAktif === "asupan" && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Jejak Telusur Observasi Piring Comstock (X.10.1)</h3>
                  <p className="text-xs text-slate-500">
                    Prinsip Keselamatan: &quot;Belum dicatat tidak sama dengan konsumsi nol&quot;. Asupan &le; 25% memicu evaluasi gizi.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-100 text-xs text-slate-700 uppercase font-semibold">
                    <tr>
                      <th className="px-4 py-3">Pasien / Bed</th>
                      <th className="px-4 py-3">Waktu & Jadwal</th>
                      <th className="px-4 py-3">Skala Comstock</th>
                      <th className="px-4 py-3">Kondisi / Alasan</th>
                      <th className="px-4 py-3">Perawat Pemeriksa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {riwayatObservasi.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">
                          Belum ada catatan observasi asupan di bangsal ini.
                        </td>
                      </tr>
                    ) : (
                      riwayatObservasi.map((obs) => (
                        <tr key={obs.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-900">
                            <div>{obs.namaPasien}</div>
                            <div className="text-xs text-slate-400 font-mono">
                              {obs.nomorRekamMedis} • Bed {obs.nomorTempatTidur}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-800 capitalize">{obs.jadwalMakan}</div>
                            <div className="text-xs text-slate-400">{obs.tanggalMakan}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                                obs.persentaseKonsumsi >= 75
                                  ? "bg-emerald-100 text-emerald-800"
                                  : obs.persentaseKonsumsi >= 50
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {obs.persentaseKonsumsi}% ({obs.skalaComstock.replace("_", " ")})
                            </span>
                            {obs.peringatanAsupanRendah && (
                              <div className="text-[11px] text-red-600 font-bold mt-1">
                                ⚠️ Asupan Rendah
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <div className="font-medium text-slate-700 capitalize">
                              {obs.kondisiPemberian.replace("_", " ")}
                            </div>
                            {obs.alasanTidakHabis && (
                              <div className="text-amber-700 italic">
                                Alasan: {obs.alasanTidakHabis.replace("_", " ")}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">
                            {obs.perawatNama}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 1: Verifikasi Keamanan Makanan Pasien (AB-020, AB-003, AB-008) */}
        {modalVerifikasiTerbuka && pasienTerpilih && (
          <div className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-lg w-full p-5 shadow-lg border border-slate-200 max-h-[90vh] overflow-y-auto space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-slate-900 text-base">Verifikasi Keamanan Makanan (AB-020)</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setModalVerifikasiTerbuka(false)}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleKirimVerifikasi} className="space-y-4 text-xs text-slate-700">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="font-bold text-blue-900 text-sm">{pasienTerpilih.namaPasien} ({pasienTerpilih.nomorRekamMedis})</div>
                  <div className="text-xs text-blue-700 mt-0.5">
                    Bed: <strong>{pasienTerpilih.nomorTempatTidur}</strong> • Diet DPJP: <strong>{pasienTerpilih.jenisDiet}</strong> ({pasienTerpilih.bentukMakanan})
                  </div>
                  {pasienTerpilih.statusPuasaNpo && (
                    <div className="mt-1 text-xs font-bold text-red-700">
                      ⛔ PERHATIAN: Pasien berstatus NPO (Puasa Medis) oleh DPJP!
                    </div>
                  )}
                </div>

                {/* TWO-IDENTIFIER CHECK: Tanggal Lahir (AB-020 fail-closed 422 jika tidak cocok) */}
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                    <UserCheck className="w-4 h-4 text-amber-700" />
                    Verifikasi Dua Pengenal (AB-020): Cocokkan Tanggal Lahir Gelang Pasien
                  </div>
                  <FormFieldMolecule
                    id="inputDobKonfirmasi"
                    label="Konfirmasi Tanggal Lahir Pasien (YYYY-MM-DD)"
                    wajib
                  >
                    <input
                      type="date"
                      required
                      id="inputDobKonfirmasi"
                      value={inputDobKonfirmasi}
                      onChange={(e) => setInputDobKonfirmasi(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  </FormFieldMolecule>
                  <span className="text-[11px] text-amber-800 block">
                    Pencegahan salah pasien: Cocokkan tanggal lahir gelang pasien dengan rekam medis.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label className="flex items-center gap-2 p-2 border rounded-lg bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={apakahIdentitasSesuai}
                      onChange={(e) => setApakahIdentitasSesuai(e.target.checked)}
                      className="rounded text-emerald-600"
                    />
                    <span className="text-xs font-medium">Gelang Sesuai</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 border rounded-lg bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={apakahDietSesuai}
                      onChange={(e) => setApakahDietSesuai(e.target.checked)}
                      className="rounded text-emerald-600"
                    />
                    <span className="text-xs font-medium">Diet DPJP Sesuai</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 border rounded-lg bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={apakahAlergiTerkonfirmasi}
                      onChange={(e) => setApakahAlergiTerkonfirmasi(e.target.checked)}
                      className="rounded text-emerald-600"
                    />
                    <span className="text-xs font-medium">Bebas Alergen</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <FormFieldMolecule id="kemampuanMenelan" label="Kemampuan Menelan" wajib>
                    <select
                      id="kemampuanMenelan"
                      value={kemampuanMenelan}
                      onChange={(e) => setKemampuanMenelan(e.target.value as KemampuanMenelan)}
                      required
                      className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded"
                    >
                      <option value="" disabled>Pilih hasil pemeriksaan</option>
                      <option value="normal">Normal</option>
                      <option value="disfagia_ringan">Disfagia Ringan</option>
                      <option value="disfagia_berat_tersedak">Disfagia Berat (Tersedak)</option>
                      <option value="menggunakan_ngt">Selang NGT</option>
                    </select>
                  </FormFieldMolecule>

                  <FormFieldMolecule id="statusKesadaran" label="Tingkat Kesadaran" wajib>
                    <select
                      id="statusKesadaran"
                      value={statusKesadaran}
                      onChange={(e) => setStatusKesadaran(e.target.value as StatusKesadaran)}
                      required
                      className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded"
                    >
                      <option value="" disabled>Pilih hasil pemeriksaan</option>
                      <option value="kompos_mentis">Kompos Mentis</option>
                      <option value="apatis">Apatis</option>
                      <option value="somnolen">Somnolen</option>
                      <option value="sopor">Sopor</option>
                      <option value="koma">Koma</option>
                    </select>
                  </FormFieldMolecule>

                  <FormFieldMolecule id="statusPuasaNpo" label="Status Puasa NPO" wajib>
                    <select
                      id="statusPuasaNpo"
                      value={statusPuasaNpo}
                      onChange={(e) => setStatusPuasaNpo(e.target.value as StatusPuasaNpo)}
                      required
                      className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded"
                    >
                      <option value="" disabled>Pilih instruksi terbaru</option>
                      <option value="tidak_puasa">Tidak Puasa</option>
                      <option value="puasa_terjadwal">Puasa Terjadwal</option>
                      <option value="puasa_npo_klinis">NPO Medis</option>
                    </select>
                  </FormFieldMolecule>
                </div>

                {/* Pilihan Keputusan: Lolos Aman vs Safety Hold */}
                <div className="pt-2 border-t border-slate-200">
                  <div className="font-semibold text-slate-800 mb-1">Keputusan Verifikasi:</div>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-emerald-800">
                      <input
                        type="radio"
                        name="keputusan"
                        value="aman_lolos"
                        checked={keputusanVerifikasi === "aman_lolos"}
                        onChange={() => setKeputusanVerifikasi("aman_lolos")}
                      />
                      <span>Aman &amp; Lolos (Disajikan)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-bold text-rose-800">
                      <input
                        type="radio"
                        name="keputusan"
                        value="ditahan_safety_hold"
                        checked={keputusanVerifikasi === "ditahan_safety_hold"}
                        onChange={() => setKeputusanVerifikasi("ditahan_safety_hold")}
                      />
                      <span>Ditahan (Safety Hold)</span>
                    </label>
                  </div>
                </div>

                {keputusanVerifikasi === "ditahan_safety_hold" && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg space-y-3">
                    <FormFieldMolecule
                      id="alasanPenahanan"
                      label="Alasan Penahanan Keselamatan (Minimal 5 karakter)"
                      wajib
                    >
                      <textarea
                        id="alasanPenahanan"
                        rows={2}
                        value={alasanPenahanan}
                        onChange={(e) => setAlasanPenahanan(e.target.value)}
                        placeholder="Contoh: Pasien tampak somnolen dan batuk tersedak saat minum."
                        className="w-full px-3 py-1.5 text-xs border border-rose-300 rounded focus:ring-2 focus:ring-rose-500"
                      />
                    </FormFieldMolecule>

                    <FormFieldMolecule
                      id="tindakanEskalasi"
                      label="Rencana Tindakan Eskalasi ke DPJP / Ahli Gizi"
                    >
                      <input
                        type="text"
                        id="tindakanEskalasi"
                        value={tindakanEskalasi}
                        onChange={(e) => setTindakanEskalasi(e.target.value)}
                        placeholder="Contoh: Lapor DPJP via telepon dan tahan sajian makanan."
                        className="w-full px-3 py-1.5 text-xs border border-rose-300 rounded focus:ring-2 focus:ring-rose-500"
                      />
                    </FormFieldMolecule>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setModalVerifikasiTerbuka(false)}
                    disabled={sedangMemverifikasi}
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    className={keputusanVerifikasi === "aman_lolos" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-rose-600 hover:bg-rose-700 text-white"}
                    disabled={sedangMemverifikasi}
                  >
                    {sedangMemverifikasi
                      ? "Menyimpan..."
                      : keputusanVerifikasi === "aman_lolos"
                      ? "Loloskan Makanan (Aman)"
                      : "Tahan Makanan (Safety Hold)"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: Skrining Gizi Malnutrition Screening Tool (MST) (BRD Bab V.5.2) */}
        {modalMstTerbuka && pasienTerpilih && (
          <div className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-lg w-full p-5 shadow-lg border border-slate-200 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <HeartPulse className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-slate-900 text-base">Skrining Risiko Gangguan Gizi (MST)</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setModalMstTerbuka(false)}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleKirimSkriningMst} className="space-y-4 text-xs text-slate-700">
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg flex justify-between items-center">
                  <div>
                    <div className="font-bold text-indigo-900 text-sm">{pasienTerpilih.namaPasien}</div>
                    <div className="text-xs text-indigo-700">{pasienTerpilih.nomorRekamMedis} • {pasienTerpilih.usiaTahun} Tahun</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-slate-500 font-medium">Skor Total MST:</div>
                    <div className="text-2xl font-bold font-mono text-indigo-800">
                      {skorMstKalkulasi} / 5
                    </div>
                  </div>
                </div>

                {/* Pertanyaan 1: Penurunan Berat Badan */}
                <FormFieldMolecule
                  id="penurunanBb"
                  label="1. Apakah ada penurunan berat badan dalam 6 bulan terakhir?"
                  wajib
                >
                  <select
                    id="penurunanBb"
                    value={penurunanBb}
                    onChange={(e) => setPenurunanBb(e.target.value as KategoriPenurunanBb)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="tidak_ada">Tidak ada penurunan berat badan (Skor 0)</option>
                    <option value="ragu_pakaian_longgar">Ragu / Tidak yakin tetapi baju terasa longgar (Skor 2)</option>
                    <option value="1_sampai_5_kg">Ya, turun 1 - 5 kg (Skor 1)</option>
                    <option value="6_sampai_10_kg">Ya, turun 6 - 10 kg (Skor 2)</option>
                    <option value="11_sampai_15_kg">Ya, turun 11 - 15 kg (Skor 3)</option>
                    <option value="lebih_15_kg">Ya, turun &gt; 15 kg (Skor 4)</option>
                  </select>
                </FormFieldMolecule>

                {/* Pertanyaan 2: Penurunan Asupan Makan */}
                <FormFieldMolecule
                  id="asupanBerkurang"
                  label="2. Apakah asupan makan berkurang karena tidak nafsu makan / mual?"
                  wajib
                >
                  <div className="flex gap-4 mt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="asupanMakan"
                        checked={!asupanBerkurang}
                        onChange={() => setAsupanBerkurang(false)}
                      />
                      <span className="text-xs">Tidak (Skor 0)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer font-semibold text-rose-700">
                      <input
                        type="radio"
                        name="asupanMakan"
                        checked={asupanBerkurang}
                        onChange={() => setAsupanBerkurang(true)}
                      />
                      <span className="text-xs">Ya, asupan berkurang (Skor 1)</span>
                    </label>
                  </div>
                </FormFieldMolecule>

                {/* Indikator Risiko Otomatis */}
                <div
                  className={`p-3 rounded-lg border flex items-center gap-3 ${
                    skorMstKalkulasi >= 2
                      ? "bg-rose-50 border-rose-200 text-rose-900"
                      : "bg-emerald-50 border-emerald-200 text-emerald-900"
                  }`}
                >
                  {skorMstKalkulasi >= 2 ? (
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  )}
                  <div>
                    <div className="font-bold text-xs uppercase">
                      Klasifikasi: {skorMstKalkulasi >= 2 ? "Berisiko Malnutrisi Tinggi (Skor >= 2)" : "Berisiko Rendah"}
                    </div>
                    <div className="text-[11px] mt-0.5">
                      {skorMstKalkulasi >= 2
                        ? "Sistem akan otomatis mengirimkan rujukan Asuhan Gizi Terstandar (ADIME) ke Ahli Gizi Klinis."
                        : "Pasien dievaluasi berkala dalam 7 hari atau jika kondisi klinis berubah."}
                    </div>
                  </div>
                </div>

                <FormFieldMolecule id="catatanMst" label="Catatan Tambahan Pengamatan Perawat">
                  <input
                    type="text"
                    id="catatanMst"
                    value={catatanMst}
                    onChange={(e) => setCatatanMst(e.target.value)}
                    placeholder="Contoh: Pasien makan hanya 2 suap bubur dan tampak lemas."
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded"
                  />
                </FormFieldMolecule>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setModalMstTerbuka(false)}
                    disabled={sedangSkrining}
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    disabled={sedangSkrining}
                  >
                    {sedangSkrining ? "Menyimpan..." : "Simpan Skrining MST"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 3: Pencatatan Asupan Comstock Visual (BRD Bab X.10.1) */}
        {modalComstockTerbuka && pasienTerpilih && (
          <div className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-lg w-full p-5 shadow-lg border border-slate-200 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Utensils className="w-5 h-5 text-amber-600" />
                  <h3 className="font-bold text-slate-900 text-base">Observasi Asupan Makan Comstock (X.10.1)</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setModalComstockTerbuka(false)}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleKirimObservasiComstock} className="space-y-4 text-xs text-slate-700">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="font-bold text-amber-900 text-sm">{pasienTerpilih.namaPasien} ({pasienTerpilih.nomorRekamMedis})</div>
                  <div className="text-xs text-amber-700">
                    Kamar {pasienTerpilih.nomorKamar} • Bed {pasienTerpilih.nomorTempatTidur} • Diet: {pasienTerpilih.jenisDiet}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <FormFieldMolecule id="jadwalMakan" label="Jadwal Makanan Pasien" wajib>
                    <select
                      id="jadwalMakan"
                      value={jadwalMakan}
                      onChange={(e) => setJadwalMakan(e.target.value as JadwalMakan)}
                      className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded"
                    >
                      <option value="pagi">Makan Pagi (Sarapan)</option>
                      <option value="selingan_pagi">Selingan Pagi</option>
                      <option value="siang">Makan Siang</option>
                      <option value="selingan_sore">Selingan Sore</option>
                      <option value="malam">Makan Malam</option>
                    </select>
                  </FormFieldMolecule>

                  <FormFieldMolecule id="kondisiPemberian" label="Kondisi Pemberian" wajib>
                    <select
                      id="kondisiPemberian"
                      value={kondisiPemberian}
                      onChange={(e) => setKondisiPemberian(e.target.value as KondisiPemberianMakanan)}
                      className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded"
                    >
                      <option value="belum_diobservasi">Belum Diobservasi</option>
                      <option value="dikonsumsi_seluruhnya">Dikonsumsi Seluruhnya</option>
                      <option value="dikonsumsi_sebagian">Dikonsumsi Sebagian</option>
                      <option value="tidak_dikonsumsi">Tidak Dikonsumsi</option>
                      <option value="ditolak_pasien">Ditolak Pasien</option>
                      <option value="puasa_medis">Puasa Medis</option>
                    </select>
                  </FormFieldMolecule>
                </div>

                {/* Selector Skala Comstock Visual 0%, 25%, 50%, 75%, 100% */}
                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-slate-800">
                    Skala Comstock Visual (Piring Bersisa):
                  </div>
                  <div className="grid grid-cols-5 gap-1.5 text-center">
                    {[
                      { id: "skala_0", label: "0%", sub: "Tidak Makan" },
                      { id: "skala_25", label: "25%", sub: "Sisa 3/4" },
                      { id: "skala_50", label: "50%", sub: "Sisa 1/2" },
                      { id: "skala_75", label: "75%", sub: "Sisa 1/4" },
                      { id: "skala_100", label: "100%", sub: "Habis" },
                    ].map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSkalaComstock(s.id as SkalaComstock)}
                        className={`p-2 border rounded-lg transition-all ${
                          skalaComstock === s.id
                            ? "border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500 font-bold"
                            : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <div className="text-sm">{s.label}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{s.sub}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {skalaComstock !== "skala_100" && (
                  <FormFieldMolecule
                    id="alasanTidakHabis"
                    label="Alasan Makanan Tidak Habis"
                    wajib
                  >
                    <select
                      id="alasanTidakHabis"
                      value={alasanTidakHabis}
                      onChange={(e) => setAlasanTidakHabis(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded"
                    >
                      <option value="">Pilih Alasan...</option>
                      <option value="mual_muntah">Mual / Muntah</option>
                      <option value="tidak_nafsu_makan">Tidak Nafsu Makan</option>
                      <option value="gangguan_menelan">Nyeri Menelan / Disfagia</option>
                      <option value="kenyang">Kenyang / Porsi Terlalu Besar</option>
                      <option value="tidak_suka_menu">Tidak Suka Variasi Menu</option>
                      <option value="pasien_tidur">Pasien Sedang Tidur</option>
                      <option value="nyeri_perut">Nyeri Perut / Kembung</option>
                      <option value="pantangan_pribadi">Pantangan Makanan Pribadi</option>
                      <option value="lainnya">Alasan Lainnya</option>
                    </select>
                  </FormFieldMolecule>
                )}

                <FormFieldMolecule id="catatanComstock" label="Catatan Tambahan Observasi">
                  <input
                    type="text"
                    id="catatanComstock"
                    value={catatanComstock}
                    onChange={(e) => setCatatanComstock(e.target.value)}
                    placeholder="Contoh: Pasien hanya menghabiskan lauk hewani, nasi bersisa separuh."
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded"
                  />
                </FormFieldMolecule>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setModalComstockTerbuka(false)}
                    disabled={sedangObservasi}
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                    disabled={sedangObservasi}
                  >
                    {sedangObservasi ? "Menyimpan..." : "Simpan Observasi Asupan"}
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
