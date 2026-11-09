/**
 * @fileoverview Workspace antarmuka pengguna untuk Petugas Rawat Inap.
 * Menyediakan alur kerja:
 * 1. Antrean Pengajuan Rawat Inap dari DPJP Dokter (Terima, Tunda, Tolak).
 * 2. Visualisasi Ketersediaan Bed & Denah Bangsal (Melati, Anggrek, Mawar) — AB-002.
 * 3. Penerimaan & Alokasi Tempat Tidur dengan Verifikasi 2 Pengenal — AB-020.
 * 4. Pemindahan Tempat Tidur / Bangsal Teraudit — AB-030, AB-034.
 * 5. Pemulangan Administratif Pasien (Discharge) & Penghentian Pesanan — AB-031.
 */

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRightLeft,
  Bed,
  Building2,
  CheckCircle2,
  Clock,
  History,
  LogOut,
  RefreshCw,
  Search,
  UserCheck,
  Users,
} from "lucide-react";
import { StatusBadge, type VarianStatusBadge } from "@/components/atoms/status-badge";
import { FormFieldMolecule } from "@/components/molecules/form-field";
import {
  LoadingState,
  MinimalToastBanner,
  PermissionDeniedState,
  SafetyHoldBanner,
} from "@/components/molecules/state-feedback";
import { ConfirmDialog } from "@/components/organisms/confirm-dialog";
import {
  DataTableFoundation,
  type DefinisiKolomTabel,
} from "@/components/organisms/data-table-foundation";
import { AppShellTemplate } from "@/components/templates/app-shell-template";
import { Button } from "@/components/ui/button";
import { useSesiAdmin } from "@/features/admin/hooks/use-sesi-admin";
import type {
  AlasanPemulangan,
  ItemBangsalDto,
  ItemEpisodeRawatInapDto,
  ItemKamarDto,
  ItemNavigasiPeran,
  ItemPengajuanRawatInapDto,
  ItemRiwayatPerpindahanDto,
  ItemTempatTidurDto,
  RingkasanKapasitasRawatInap,
  ResponsApi,
} from "../../../../packages/shared-types/src/index.ts";

type TabRawatInap =
  | "pengajuan"
  | "denah_bed"
  | "pasien_aktif"
  | "riwayat_perpindahan";

export function RawatInapWorkspace() {
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

  // Tab & Filter States
  const [tabAktif, setTabAktif] = useState<TabRawatInap>("pengajuan");
  const [filterBangsal, setFilterBangsal] = useState("SEMUA");
  const [kataKunciCari, setKataKunciCari] = useState("");
  const [halamanSaatIni, setHalamanSaatIni] = useState(1);
  const ukuranHalaman = 10;

  // Data States
  const [ringkasan, setRingkasan] = useState<RingkasanKapasitasRawatInap>({
    totalTempatTidur: 0,
    totalTersedia: 0,
    totalTerisi: 0,
    totalPemeliharaan: 0,
    totalPasienAktif: 0,
    totalPengajuanMenunggu: 0,
  });
  const [daftarBangsal, setDaftarBangsal] = useState<ItemBangsalDto[]>([]);
  const [daftarKamar, setDaftarKamar] = useState<ItemKamarDto[]>([]);
  const [daftarTempatTidur, setDaftarTempatTidur] = useState<ItemTempatTidurDto[]>([]);
  const [daftarPengajuan, setDaftarPengajuan] = useState<ItemPengajuanRawatInapDto[]>([]);
  const [daftarEpisode, setDaftarEpisode] = useState<ItemEpisodeRawatInapDto[]>([]);
  const [daftarRiwayat, setDaftarRiwayat] = useState<ItemRiwayatPerpindahanDto[]>([]);

  // Pemuatan & Dialog
  const [sedangMemuatData, setSedangMemuatData] = useState(false);
  const [toast, setToast] = useState<{
    jenis: "berhasil" | "kesalahan";
    pesan: string;
  } | null>(null);
  const [peringatanKeselamatan, setPeringatanKeselamatan] = useState<string | null>(null);
  const [menuTerkunci, setMenuTerkunci] = useState<ItemNavigasiPeran | null>(null);

  // Modal Alokasi Bed (Admission)
  const [pengajuanTerpilih, setPengajuanTerpilih] = useState<ItemPengajuanRawatInapDto | null>(null);
  const [bedAlokasiTerpilih, setBedAlokasiTerpilih] = useState("");
  const [verifikasiTglLahir, setVerifikasiTglLahir] = useState("");
  const [catatanPenempatan, setCatatanPenempatan] = useState("");
  const [sedangSimpanAdmit, setSedangSimpanAdmit] = useState(false);

  // Modal Pemindahan Bed (Transfer)
  const [episodePindahTerpilih, setEpisodePindahTerpilih] = useState<ItemEpisodeRawatInapDto | null>(null);
  const [bedTujuanPindah, setBedTujuanPindah] = useState("");
  const [alasanPemindahan, setAlasanPemindahan] = useState("");
  const [sedangSimpanPindah, setSedangSimpanPindah] = useState(false);

  // Modal Pemulangan Pasien (Discharge)
  const [episodePulangTerpilih, setEpisodePulangTerpilih] = useState<ItemEpisodeRawatInapDto | null>(null);
  const [alasanPemulangan, setAlasanPemulangan] = useState<AlasanPemulangan>("sembuh");
  const [catatanPemulangan, setCatatanPemulangan] = useState("");
  const [sedangSimpanPulang, setSedangSimpanPulang] = useState(false);

  // Muat data terpadu
  async function muatSemuaData(): Promise<void> {
    setSedangMemuatData(true);
    try {
      const [resOverview, resPengajuan, resEpisode, resRiwayat] = await Promise.all([
        fetch("/api/v1/inpatient/overview", { cache: "no-store" }),
        fetch("/api/v1/inpatient/admission-requests", { cache: "no-store" }),
        fetch("/api/v1/inpatient/episodes", { cache: "no-store" }),
        fetch("/api/v1/inpatient/transfers", { cache: "no-store" }),
      ]);

      const jsonOverview = (await resOverview.json()) as ResponsApi<{
        ringkasan: RingkasanKapasitasRawatInap;
        daftarBangsal: readonly ItemBangsalDto[];
        daftarKamar: readonly ItemKamarDto[];
        daftarTempatTidur: readonly ItemTempatTidurDto[];
      }>;
      const jsonPengajuan = (await resPengajuan.json()) as ResponsApi<{
        items: readonly ItemPengajuanRawatInapDto[];
      }>;
      const jsonEpisode = (await resEpisode.json()) as ResponsApi<{
        items: readonly ItemEpisodeRawatInapDto[];
      }>;
      const jsonRiwayat = (await resRiwayat.json()) as ResponsApi<{
        items: readonly ItemRiwayatPerpindahanDto[];
      }>;

      if (jsonOverview.sukses) {
        setRingkasan(jsonOverview.data.ringkasan);
        setDaftarBangsal([...jsonOverview.data.daftarBangsal]);
        setDaftarKamar([...jsonOverview.data.daftarKamar]);
        setDaftarTempatTidur([...jsonOverview.data.daftarTempatTidur]);
      }
      if (jsonPengajuan.sukses) {
        setDaftarPengajuan([...jsonPengajuan.data.items]);
      }
      if (jsonEpisode.sukses) {
        setDaftarEpisode([...jsonEpisode.data.items]);
      }
      if (jsonRiwayat.sukses) {
        setDaftarRiwayat([...jsonRiwayat.data.items]);
      }
    } catch {
      setToast({
        jenis: "kesalahan",
        pesan: "Gagal memuat data operasional rawat inap dari server.",
      });
    } finally {
      setSedangMemuatData(false);
    }
  }

  useEffect(() => {
    if (!profil || profil.peran !== "petugas_rawat_inap") return;
    let aktif = true;
    async function muatOtomatis() {
      try {
        const [resOverview, resPengajuan, resEpisode, resRiwayat] = await Promise.all([
          fetch("/api/v1/inpatient/overview", { cache: "no-store" }),
          fetch("/api/v1/inpatient/admission-requests", { cache: "no-store" }),
          fetch("/api/v1/inpatient/episodes", { cache: "no-store" }),
          fetch("/api/v1/inpatient/transfers", { cache: "no-store" }),
        ]);

        const jsonOverview = (await resOverview.json()) as ResponsApi<{
          ringkasan: RingkasanKapasitasRawatInap;
          daftarBangsal: readonly ItemBangsalDto[];
          daftarKamar: readonly ItemKamarDto[];
          daftarTempatTidur: readonly ItemTempatTidurDto[];
        }>;
        const jsonPengajuan = (await resPengajuan.json()) as ResponsApi<{
          items: readonly ItemPengajuanRawatInapDto[];
        }>;
        const jsonEpisode = (await resEpisode.json()) as ResponsApi<{
          items: readonly ItemEpisodeRawatInapDto[];
        }>;
        const jsonRiwayat = (await resRiwayat.json()) as ResponsApi<{
          items: readonly ItemRiwayatPerpindahanDto[];
        }>;

        if (aktif) {
          if (jsonOverview.sukses) {
            setRingkasan(jsonOverview.data.ringkasan);
            setDaftarBangsal([...jsonOverview.data.daftarBangsal]);
            setDaftarKamar([...jsonOverview.data.daftarKamar]);
            setDaftarTempatTidur([...jsonOverview.data.daftarTempatTidur]);
          }
          if (jsonPengajuan.sukses) {
            setDaftarPengajuan([...jsonPengajuan.data.items]);
          }
          if (jsonEpisode.sukses) {
            setDaftarEpisode([...jsonEpisode.data.items]);
          }
          if (jsonRiwayat.sukses) {
            setDaftarRiwayat([...jsonRiwayat.data.items]);
          }
        }
      } catch {
        // Abaikan galat pemuatan awal
      }
    }
    void muatOtomatis();
    return () => {
      aktif = false;
    };
  }, [profil]);

  // Aksi: Penerimaan & Penempatan Tempat Tidur (AB-002, AB-020)
  async function tanganiSimpanAdmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pengajuanTerpilih || !bedAlokasiTerpilih) return;

    if (!verifikasiTglLahir.trim()) {
      setPeringatanKeselamatan(
        "Penahanan Keselamatan (AB-020): Verifikasi dua pengenal wajib dilakukan. Masukkan tanggal lahir pasien yang dikonfirmasi langsung sebelum melakukan penempatan rawat inap.",
      );
      return;
    }

    setSedangSimpanAdmit(true);
    setPeringatanKeselamatan(null);
    try {
      const res = await fetch("/api/v1/inpatient/admissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": `admit-${pengajuanTerpilih.id}-${Date.now()}`,
        },
        body: JSON.stringify({
          pengajuanId: pengajuanTerpilih.id,
          tempatTidurId: bedAlokasiTerpilih,
          konfirmasiTanggalLahir: verifikasiTglLahir.trim(),
          catatanPenempatan: catatanPenempatan.trim() || undefined,
        }),
      });

      const json = (await res.json()) as ResponsApi<{
        episode: ItemEpisodeRawatInapDto;
        penempatanId: string;
      }>;

      if (json.sukses) {
        setToast({
          jenis: "berhasil",
          pesan: `Pasien ${pengajuanTerpilih.namaPasien} berhasil ditempatkan di tempat tidur. Episode Rawat Inap: ${json.data.episode.nomorEpisode}.`,
        });
        setPengajuanTerpilih(null);
        setBedAlokasiTerpilih("");
        setVerifikasiTglLahir("");
        setCatatanPenempatan("");
        await muatSemuaData();
      } else {
        if (json.galat.kode === "ERR_PENAHANAN_KESELAMATAN") {
          setPeringatanKeselamatan(json.galat.pesan);
        } else {
          setToast({ jenis: "kesalahan", pesan: json.galat.pesan });
        }
      }
    } catch {
      setToast({
        jenis: "kesalahan",
        pesan: "Terjadi kesalahan jaringan saat memproses penerimaan rawat inap.",
      });
    } finally {
      setSedangSimpanAdmit(false);
    }
  }

  // Aksi: Keputusan Tunda / Tolak Pengajuan
  async function tanganiKeputusanPengajuan(
    pengajuanId: string,
    keputusan: "ditunda" | "ditolak",
    alasan: string,
  ) {
    try {
      const res = await fetch(
        `/api/v1/inpatient/admission-requests/${pengajuanId}/decide`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keputusan, alasan }),
        },
      );
      const json = (await res.json()) as ResponsApi<ItemPengajuanRawatInapDto>;
      if (json.sukses) {
        setToast({
          jenis: "berhasil",
          pesan: `Pengajuan rawat inap berhasil diubah menjadi '${keputusan}'.`,
        });
        await muatSemuaData();
      } else {
        setToast({ jenis: "kesalahan", pesan: json.galat.pesan });
      }
    } catch {
      setToast({
        jenis: "kesalahan",
        pesan: "Gagal memperbarui status pengajuan rawat inap.",
      });
    }
  }

  // Aksi: Pemindahan Tempat Tidur (AB-030, AB-034)
  async function tanganiSimpanPemindahan(e: React.FormEvent) {
    e.preventDefault();
    if (!episodePindahTerpilih || !bedTujuanPindah) return;

    if (alasanPemindahan.trim().length < 5) {
      setToast({
        jenis: "kesalahan",
        pesan: "Alasan pemindahan tempat tidur wajib diisi minimal 5 karakter.",
      });
      return;
    }

    setSedangSimpanPindah(true);
    try {
      const res = await fetch(
        `/api/v1/inpatient/episodes/${episodePindahTerpilih.id}/transfer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tempatTidurTujuanId: bedTujuanPindah,
            alasanPemindahan: alasanPemindahan.trim(),
            versi: episodePindahTerpilih.versi,
          }),
        },
      );

      const json = (await res.json()) as ResponsApi<{
        episode: ItemEpisodeRawatInapDto;
        riwayatId: string;
      }>;

      if (json.sukses) {
        setToast({
          jenis: "berhasil",
          pesan: `Pasien ${episodePindahTerpilih.namaPasien} berhasil dipindahkan ke tempat tidur baru. Riwayat perpindahan tersimpan.`,
        });
        setEpisodePindahTerpilih(null);
        setBedTujuanPindah("");
        setAlasanPemindahan("");
        await muatSemuaData();
      } else {
        setToast({ jenis: "kesalahan", pesan: json.galat.pesan });
      }
    } catch {
      setToast({
        jenis: "kesalahan",
        pesan: "Gagal memproses pemindahan tempat tidur.",
      });
    } finally {
      setSedangSimpanPindah(false);
    }
  }

  // Aksi: Pemulangan Pasien (AB-031, BRD Bab 11.1)
  async function tanganiSimpanPemulangan(e: React.FormEvent) {
    e.preventDefault();
    if (!episodePulangTerpilih) return;

    if (catatanPemulangan.trim().length < 5) {
      setToast({
        jenis: "kesalahan",
        pesan: "Catatan atau ringkasan pemulangan wajib diisi minimal 5 karakter.",
      });
      return;
    }

    setSedangSimpanPulang(true);
    try {
      const res = await fetch(
        `/api/v1/inpatient/episodes/${episodePulangTerpilih.id}/discharge`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            alasanPemulangan,
            catatanPemulangan: catatanPemulangan.trim(),
            versi: episodePulangTerpilih.versi,
          }),
        },
      );

      const json = (await res.json()) as ResponsApi<ItemEpisodeRawatInapDto>;

      if (json.sukses) {
        setToast({
          jenis: "berhasil",
          pesan: `Pasien ${episodePulangTerpilih.namaPasien} resmi dipulangkan (${alasanPemulangan}). Tempat tidur telah dibebaskan dan jadwal pesanan gizi dihentikan (AB-031).`,
        });
        setEpisodePulangTerpilih(null);
        setCatatanPemulangan("");
        await muatSemuaData();
      } else {
        setToast({ jenis: "kesalahan", pesan: json.galat.pesan });
      }
    } catch {
      setToast({
        jenis: "kesalahan",
        pesan: "Gagal memproses pemulangan pasien.",
      });
    } finally {
      setSedangSimpanPulang(false);
    }
  }

  // Cek otorisasi
  if (sedangMemuatSesi) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoadingState
          judul="Memverifikasi hak akses admisi rawat inap..."
          deskripsi="Memeriksa sesi login dan izin operasional rawat inap."
        />
      </div>
    );
  }

  if (!profil || profil.peran !== "petugas_rawat_inap") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white p-6 rounded-lg shadow-sm border border-slate-200 text-center space-y-4">
          <PermissionDeniedState
            pesan="Akses Terbatas: Khusus Petugas Admisi Rawat Inap."
            detailKonteks="Sesuai Aturan Keselamatan AB-002 & AB-032, penetapan tempat tidur, perpindahan kamar, dan pemulangan administratif memerlukan wewenang Petugas Rawat Inap."
          />
          <div className="pt-2">
            <Link
              href="/portal"
              className="inline-flex items-center justify-center w-full h-9 text-xs font-semibold bg-blue-700 hover:bg-blue-800 text-white rounded-md transition-colors"
            >
              Kembali ke Portal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Filter tempat tidur & pengajuan
  const tempatTidurTersedia = daftarTempatTidur.filter(
    (b) => b.statusTempatTidur === "tersedia",
  );

  const daftarTempatTidurTampil = daftarTempatTidur.filter((b) => {
    if (filterBangsal !== "SEMUA" && b.bangsalId !== filterBangsal) return false;
    if (kataKunciCari.trim()) {
      const q = kataKunciCari.toLowerCase();
      const matchNomor = b.nomorTempatTidur.toLowerCase().includes(q);
      const matchKamar = b.nomorKamar.toLowerCase().includes(q);
      const matchPasien = b.namaPasien?.toLowerCase().includes(q) ?? false;
      const matchRm = b.nomorRekamMedis?.toLowerCase().includes(q) ?? false;
      return matchNomor || matchKamar || matchPasien || matchRm;
    }
    return true;
  });

  const daftarPengajuanTampil = daftarPengajuan.filter((p) => {
    if (kataKunciCari.trim()) {
      const q = kataKunciCari.toLowerCase();
      const matchRm = p.nomorRekamMedis.toLowerCase().includes(q);
      const matchNama = p.namaPasien.toLowerCase().includes(q);
      const matchDiag = p.diagnosisUtama.toLowerCase().includes(q);
      return matchRm || matchNama || matchDiag;
    }
    return true;
  });

  const daftarEpisodeTampil = daftarEpisode.filter((e) => {
    if (filterBangsal !== "SEMUA" && e.bangsalId !== filterBangsal) return false;
    if (kataKunciCari.trim()) {
      const q = kataKunciCari.toLowerCase();
      const matchRm = e.nomorRekamMedis.toLowerCase().includes(q);
      const matchNama = e.namaPasien.toLowerCase().includes(q);
      const matchEp = e.nomorEpisode.toLowerCase().includes(q);
      const matchBed = e.nomorTempatTidur.toLowerCase().includes(q);
      return matchRm || matchNama || matchEp || matchBed;
    }
    return true;
  });

  // Definisi Kolom Tabel Pengajuan
  const kolomPengajuan: readonly DefinisiKolomTabel<ItemPengajuanRawatInapDto>[] = [
    {
      id: "nomorPengajuan",
      header: "No. Pengajuan",
      lebarKelas: "w-[140px]",
      renderSel: (item: ItemPengajuanRawatInapDto) => (
        <div>
          <span className="font-mono text-xs font-bold text-slate-900 block">
            {item.nomorPengajuan}
          </span>
          <span className="text-[11px] text-slate-500">
            {new Date(item.dibuatPada).toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      ),
    },
    {
      id: "pasien",
      header: "Identitas Pasien (2 Pengenal)",
      lebarKelas: "min-w-[200px]",
      renderSel: (item: ItemPengajuanRawatInapDto) => (
        <div>
          <div className="font-semibold text-slate-900 text-xs">
            {item.namaPasien}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-1 py-0.5 rounded border border-slate-200">
              {item.nomorRekamMedis}
            </span>
          </div>
        </div>
      ),
    },
    {
      id: "prioritas",
      header: "Prioritas",
      lebarKelas: "w-[110px]",
      renderSel: (item: ItemPengajuanRawatInapDto) => {
        const varian: VarianStatusBadge =
          item.prioritasRawatInap === "kritis" || item.prioritasRawatInap === "gawat_darurat"
            ? "ditahan"
            : item.prioritasRawatInap === "mendesak"
              ? "menunggu"
              : "netral";
        return (
          <StatusBadge
            label={item.prioritasRawatInap.toUpperCase()}
            varian={varian}
          />
        );
      },
    },
    {
      id: "detailKlinis",
      header: "Diagnosis & Rekomendasi",
      renderSel: (item: ItemPengajuanRawatInapDto) => (
        <div className="space-y-0.5 text-xs">
          <div className="font-medium text-slate-900 line-clamp-1">
            {item.diagnosisUtama}
          </div>
          <div className="text-[11px] text-slate-500">
            Rekomendasi: <span className="font-semibold text-slate-700">{item.rekomendasiBangsal}</span>
            {item.kebutuhanKhusus && ` • ${item.kebutuhanKhusus}`}
          </div>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      lebarKelas: "w-[130px]",
      renderSel: (item: ItemPengajuanRawatInapDto) => {
        const varian: VarianStatusBadge =
          item.statusPengajuan === "ditempatkan"
            ? "sesuai"
            : item.statusPengajuan === "menunggu_penempatan"
              ? "menunggu"
              : item.statusPengajuan === "ditolak"
                ? "ditahan"
                : "netral";
        return (
          <StatusBadge
            label={item.statusPengajuan.replace(/_/g, " ")}
            varian={varian}
          />
        );
      },
    },
    {
      id: "aksi",
      header: "Tindakan Admisi",
      lebarKelas: "w-[180px]",
      renderSel: (item: ItemPengajuanRawatInapDto) => {
        if (item.statusPengajuan === "ditempatkan") {
          return (
            <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Ditempatkan
            </span>
          );
        }
        if (item.statusPengajuan === "ditolak") {
          return (
            <span className="text-[11px] text-rose-700 font-medium">
              Ditolak: {item.alasanPenolakan || "-"}
            </span>
          );
        }
        return (
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              className="h-7 text-xs bg-emerald-700 hover:bg-emerald-800 text-white"
              onClick={() => {
                setPengajuanTerpilih(item);
                setVerifikasiTglLahir("");
                setPeringatanKeselamatan(null);
                setTabAktif("denah_bed");
              }}
            >
              Alokasi Bed
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-rose-300 text-rose-700 hover:bg-rose-50"
              onClick={() => {
                const alasanInput = prompt(
                  `Masukkan alasan penolakan untuk pasien ${item.namaPasien}:`,
                );
                if (alasanInput && alasanInput.trim().length >= 5) {
                  void tanganiKeputusanPengajuan(item.id, "ditolak", alasanInput.trim());
                } else if (alasanInput !== null) {
                  alert("Alasan penolakan minimal 5 karakter.");
                }
              }}
            >
              Tolak
            </Button>
          </div>
        );
      },
    },
  ];

  // Definisi Kolom Tabel Pasien Aktif
  const kolomEpisodeAktif: readonly DefinisiKolomTabel<ItemEpisodeRawatInapDto>[] = [
    {
      id: "nomorEpisode",
      header: "No. Episode",
      lebarKelas: "w-[140px]",
      renderSel: (item: ItemEpisodeRawatInapDto) => (
        <div>
          <span className="font-mono text-xs font-bold text-slate-900 block">
            {item.nomorEpisode}
          </span>
          <span className="text-[11px] text-slate-500">
            Versi {item.versi}
          </span>
        </div>
      ),
    },
    {
      id: "pasien",
      header: "Pasien",
      lebarKelas: "min-w-[180px]",
      renderSel: (item: ItemEpisodeRawatInapDto) => (
        <div>
          <div className="font-semibold text-slate-900 text-xs">
            {item.namaPasien}
          </div>
          <div className="text-[11px] text-slate-500">
            {item.nomorRekamMedis} • Tgl Lahir: {item.tanggalLahir}
          </div>
        </div>
      ),
    },
    {
      id: "lokasi",
      header: "Lokasi Ruang & Bed",
      lebarKelas: "min-w-[180px]",
      renderSel: (item: ItemEpisodeRawatInapDto) => (
        <div className="text-xs">
          <div className="font-semibold text-blue-900">
            {item.nomorTempatTidur}
          </div>
          <div className="text-[11px] text-slate-600">
            {item.namaBangsal} (Kamar {item.nomorKamar})
          </div>
        </div>
      ),
    },
    {
      id: "dpjp",
      header: "DPJP & Masuk",
      lebarKelas: "w-[170px]",
      renderSel: (item: ItemEpisodeRawatInapDto) => (
        <div className="text-xs">
          <div className="font-medium text-slate-800 line-clamp-1">
            {item.dokterDpjpNama}
          </div>
          <div className="text-[11px] text-slate-500">
            {new Date(item.waktuMasuk).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </div>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      lebarKelas: "w-[110px]",
      renderSel: (item: ItemEpisodeRawatInapDto) => {
        const varian: VarianStatusBadge =
          item.statusPerawatan === "aktif"
            ? "sesuai"
            : item.statusPerawatan === "selesai"
              ? "netral"
              : "menunggu";
        return (
          <StatusBadge
            label={item.statusPerawatan.toUpperCase()}
            varian={varian}
          />
        );
      },
    },
    {
      id: "aksi",
      header: "Aksi Rawat Inap",
      lebarKelas: "w-[180px]",
      renderSel: (item: ItemEpisodeRawatInapDto) => {
        if (item.statusPerawatan !== "aktif") {
          return (
            <span className="text-[11px] text-slate-500 italic">
              Dipulangkan ({item.alasanPemulangan || "-"})
            </span>
          );
        }
        return (
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-blue-300 text-blue-800 hover:bg-blue-50 flex items-center gap-1"
              onClick={() => {
                setEpisodePindahTerpilih(item);
                setBedTujuanPindah("");
                setAlasanPemindahan("");
              }}
            >
              <ArrowRightLeft className="w-3 h-3" /> Pindah
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-amber-300 text-amber-800 hover:bg-amber-50 flex items-center gap-1"
              onClick={() => {
                setEpisodePulangTerpilih(item);
                setAlasanPemulangan("sembuh");
                setCatatanPemulangan("");
              }}
            >
              <LogOut className="w-3 h-3" /> Pulang
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <AppShellTemplate
      judulDiKonten
      judulHalaman="Admisi Rawat Inap & Manajemen Tempat Tidur"
      subjudulHalaman="Penerimaan pengajuan rawat inap, alokasi bed anti-tabrakan (AB-002), verifikasi dua pengenal (AB-020), mutasi bangsal teraudit (AB-030), dan pemulangan administratif (AB-031)."
      profil={profil}
      navigasi={navigasi}
      notifikasiItems={notifikasiItems}
      jumlahBelumDibaca={jumlahBelumDibaca}
      sedangMemuatNotifikasi={sedangMemuatNotifikasi}
      onTandaiSatuNotifikasiDibaca={tandaiSatuNotifikasiDibaca}
      onTandaiSemuaNotifikasiDibaca={tandaiSemuaNotifikasiDibaca}
      onPilihMenuTerkunci={(item: ItemNavigasiPeran) => {
        if (item.statusTahap === "menunggu_tahap_peran") {
          setMenuTerkunci(item);
        }
      }}
      onKeluarSesi={() => void keluarSesi()}
    >
      <div className="space-y-6">
        {/* Banner Peringatan Keselamatan */}
        {peringatanKeselamatan && (
          <SafetyHoldBanner
            judul="Penahanan Keselamatan Admisi Rawat Inap (AB-002 / AB-020)"
            alasanPenahanan={peringatanKeselamatan}
            tindakLanjutWajib="Verifikasi kembali dua pengenal pasien (tanggal lahir) atau pilih tempat tidur yang berstatus tersedia."
          />
        )}

        {/* Minimal Toast Feedback */}
        {toast && (
          <MinimalToastBanner
            jenis={toast.jenis}
            pesan={toast.pesan}
            onTutup={() => setToast(null)}
          />
        )}

        {/* Header Modul */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center p-1.5 bg-blue-100 text-blue-800 rounded-md">
                <Bed className="w-5 h-5" />
              </span>
              <h1 className="text-xl font-bold text-slate-900">
                Workspace Admisi & Penempatan Rawat Inap
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Pengelolaan pengajuan rawat inap, alokasi tempat tidur tanpa tabrakan (AB-002), perpindahan ruang teraudit (AB-030), dan pemulangan administratif (AB-031).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void muatSemuaData()}
              disabled={sedangMemuatData}
              className="text-xs gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${sedangMemuatData ? "animate-spin" : ""}`} />
              Segarkan Data
            </Button>
          </div>
        </div>

        {/* Ringkasan Kapasitas Ruang & Bed (Kartu Metrik) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
            <div className="text-[11px] font-medium text-slate-500">Total Tempat Tidur</div>
            <div className="text-xl font-bold text-slate-900 mt-1">
              {ringkasan.totalTempatTidur}
            </div>
          </div>
          <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-200 shadow-xs">
            <div className="text-[11px] font-medium text-emerald-700">Bed Tersedia</div>
            <div className="text-xl font-bold text-emerald-800 mt-1">
              {ringkasan.totalTersedia}
            </div>
          </div>
          <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-200 shadow-xs">
            <div className="text-[11px] font-medium text-blue-700">Bed Terisi (Aktif)</div>
            <div className="text-xl font-bold text-blue-900 mt-1">
              {ringkasan.totalTerisi}
            </div>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 shadow-xs">
            <div className="text-[11px] font-medium text-slate-500">Pemeliharaan</div>
            <div className="text-xl font-bold text-slate-700 mt-1">
              {ringkasan.totalPemeliharaan}
            </div>
          </div>
          <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-200 shadow-xs">
            <div className="text-[11px] font-medium text-amber-700">Antrean Pengajuan</div>
            <div className="text-xl font-bold text-amber-800 mt-1">
              {ringkasan.totalPengajuanMenunggu}
            </div>
          </div>
          <div className="bg-purple-50/50 p-3 rounded-lg border border-purple-200 shadow-xs">
            <div className="text-[11px] font-medium text-purple-700">Pasien Terawat</div>
            <div className="text-xl font-bold text-purple-900 mt-1">
              {ringkasan.totalPasienAktif}
            </div>
          </div>
        </div>

        {/* Tab Navigasi Alur Kerja */}
        <div className="border-b border-slate-200 flex gap-1 overflow-x-auto pb-px">
          <button
            type="button"
            onClick={() => setTabAktif("pengajuan")}
            className={`px-3 py-2 text-xs font-semibold rounded-t-md transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              tabAktif === "pengajuan"
                ? "bg-white text-blue-800 border-t-2 border-l border-r border-slate-200 border-t-blue-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Clock className="w-4 h-4" />
            Pengajuan DPJP Dokter
            {ringkasan.totalPengajuanMenunggu > 0 && (
              <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-1">
                {ringkasan.totalPengajuanMenunggu}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setTabAktif("denah_bed")}
            className={`px-3 py-2 text-xs font-semibold rounded-t-md transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              tabAktif === "denah_bed"
                ? "bg-white text-blue-800 border-t-2 border-l border-r border-slate-200 border-t-blue-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Building2 className="w-4 h-4" />
            Ketersediaan Bed & Denah Bangsal (AB-002)
          </button>
          <button
            type="button"
            onClick={() => setTabAktif("pasien_aktif")}
            className={`px-3 py-2 text-xs font-semibold rounded-t-md transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              tabAktif === "pasien_aktif"
                ? "bg-white text-blue-800 border-t-2 border-l border-r border-slate-200 border-t-blue-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Users className="w-4 h-4" />
            Pasien Rawat Inap Aktif
            <span className="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-1">
              {ringkasan.totalTerisi}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTabAktif("riwayat_perpindahan")}
            className={`px-3 py-2 text-xs font-semibold rounded-t-md transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              tabAktif === "riwayat_perpindahan"
                ? "bg-white text-blue-800 border-t-2 border-l border-r border-slate-200 border-t-blue-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <History className="w-4 h-4" />
            Riwayat Perpindahan Bed (AB-030)
          </button>
        </div>

        {/* Kontrol Pencarian & Filter */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Cari pasien, RM, atau nomor bed..."
                value={kataKunciCari}
                onChange={(e) => setKataKunciCari(e.target.value)}
                className="w-full h-9 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600"
              />
            </div>
            {kataKunciCari && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setKataKunciCari("")}
                className="text-xs h-8 text-slate-500"
              >
                Reset
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <span className="text-xs text-slate-500 font-medium">Filter Bangsal:</span>
            <select
              value={filterBangsal}
              onChange={(e) => setFilterBangsal(e.target.value)}
              className="h-8 text-xs bg-white border border-slate-200 rounded-md px-2 focus:ring-1 focus:ring-blue-600"
            >
              <option value="SEMUA">Semua Bangsal</option>
              {daftarBangsal.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.namaBangsal}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* TAB 1: Antrean Pengajuan Rawat Inap */}
        {tabAktif === "pengajuan" && (
          <div className="space-y-4">
            <DataTableFoundation<ItemPengajuanRawatInapDto>
              judulTabel="Antrean Pengajuan Rawat Inap Dokter DPJP"
              deskripsiTabel="Daftar pengajuan rawat inap dari pemeriksaan poliklinik atau IGD yang menunggu penempatan tempat tidur."
              kolom={kolomPengajuan}
              data={daftarPengajuanTampil}
              ambilKunciBaris={(item: ItemPengajuanRawatInapDto) => item.id}
              kataKunciCari={kataKunciCari}
              onUbahKataKunciCari={setKataKunciCari}
              placeholderCari="Cari nomor pengajuan, nama pasien, no RM..."
              sedangMemuat={sedangMemuatData}
              judulKosong="Tidak Ada Pengajuan Rawat Inap"
              deskripsiKosong="Tidak ada pengajuan rawat inap yang menunggu saat ini."
              halamanSaatIni={halamanSaatIni}
              totalHalaman={Math.max(1, Math.ceil(daftarPengajuanTampil.length / ukuranHalaman))}
              totalData={daftarPengajuanTampil.length}
              onUbahHalaman={setHalamanSaatIni}
            />
          </div>
        )}

        {/* TAB 2: Ketersediaan Bed & Denah Bangsal (AB-002) */}
        {tabAktif === "denah_bed" && (
          <div className="space-y-6">
            {/* Banner info alokasi jika ada pengajuan terpilih */}
            {pengajuanTerpilih && (
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-blue-700" />
                    Mode Alokasi Bed untuk Pasien: {pengajuanTerpilih.namaPasien} ({pengajuanTerpilih.nomorRekamMedis})
                  </div>
                  <div className="text-xs text-blue-800">
                    Diagnosis: <span className="font-semibold">{pengajuanTerpilih.diagnosisUtama}</span> • Rekomendasi: <span className="font-semibold">{pengajuanTerpilih.rekomendasiBangsal}</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs border-blue-300 text-blue-800 hover:bg-blue-100"
                  onClick={() => setPengajuanTerpilih(null)}
                >
                  Batal Alokasi
                </Button>
              </div>
            )}

            {/* Denah Tempat Tidur per Bangsal */}
            {daftarBangsal
              .filter((b) => filterBangsal === "SEMUA" || b.id === filterBangsal)
              .map((bangsal) => {
                const bedDiBangsal = daftarTempatTidurTampil.filter(
                  (t) => t.bangsalId === bangsal.id,
                );

                return (
                  <div
                    key={bangsal.id}
                    className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs"
                  >
                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-700" />
                        <h2 className="text-sm font-bold text-slate-900">
                          {bangsal.namaBangsal}
                        </h2>
                        <span className="text-[11px] font-mono bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-semibold">
                          {bangsal.kelasPelayanan.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        Kapasitas: <span className="font-bold text-slate-800">{bangsal.kapasitasTempatTidur} Bed ({daftarKamar.filter((k) => k.bangsalId === bangsal.id).length} Kamar)</span> • Tersedia: <span className="font-bold text-emerald-700">{bangsal.jumlahTersedia}</span> • Terisi: <span className="font-bold text-blue-700">{bangsal.jumlahTerisi}</span>
                      </div>
                    </div>

                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {bedDiBangsal.length === 0 ? (
                        <div className="col-span-full text-center py-6 text-xs text-slate-500">
                          Belum ada tempat tidur yang terdaftar pada bangsal ini.
                        </div>
                      ) : (
                        bedDiBangsal.map((bed) => {
                          const isTersedia = bed.statusTempatTidur === "tersedia";
                          const isTerisi = bed.statusTempatTidur === "terisi";

                          return (
                            <div
                              key={bed.id}
                              className={`p-3 rounded-lg border transition-all ${
                                isTersedia
                                  ? "bg-emerald-50/30 border-emerald-200 hover:border-emerald-400"
                                  : isTerisi
                                    ? "bg-blue-50/30 border-blue-200"
                                    : "bg-slate-100 border-slate-300 opacity-70"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                                  <Bed className="w-3.5 h-3.5 text-slate-700" />
                                  {bed.nomorTempatTidur}
                                </span>
                                <StatusBadge
                                  label={bed.statusTempatTidur.toUpperCase()}
                                  varian={
                                    isTersedia
                                      ? "sesuai"
                                      : isTerisi
                                        ? "netral"
                                        : "menunggu"
                                  }
                                />
                              </div>

                              <div className="text-[11px] text-slate-500 mt-1">
                                Kamar {bed.nomorKamar}
                              </div>

                              {isTerisi && bed.namaPasien && (
                                <div className="mt-2.5 pt-2 border-t border-blue-200/60 space-y-0.5">
                                  <div className="text-xs font-semibold text-slate-900 line-clamp-1">
                                    {bed.namaPasien}
                                  </div>
                                  <div className="text-[11px] text-slate-500 font-mono">
                                    {bed.nomorRekamMedis}
                                  </div>
                                </div>
                              )}

                              {/* Tombol Tempatkan Jika Sedang Mode Alokasi */}
                              {isTersedia && pengajuanTerpilih && (
                                <Button
                                  size="sm"
                                  className="w-full mt-3 h-7 text-xs bg-emerald-700 hover:bg-emerald-800 text-white"
                                  onClick={() => setBedAlokasiTerpilih(bed.id)}
                                >
                                  Pilih Bed Ini
                                </Button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}

            {/* Formulir Konfirmasi Alokasi Bed & Verifikasi 2 Pengenal (AB-020) */}
            {pengajuanTerpilih && bedAlokasiTerpilih && (
              <div className="bg-white p-5 rounded-lg border-2 border-emerald-500 shadow-md space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                    Konfirmasi Alokasi & Verifikasi Keselamatan (AB-020)
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-slate-500"
                    onClick={() => setBedAlokasiTerpilih("")}
                  >
                    Ganti Bed
                  </Button>
                </div>

                <form onSubmit={tanganiSimpanAdmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-slate-500 block">Pasien:</span>
                      <span className="text-xs font-bold text-slate-900">
                        {pengajuanTerpilih.namaPasien} ({pengajuanTerpilih.nomorRekamMedis})
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 block">Tempat Tidur Dipilih:</span>
                      <span className="text-xs font-bold text-emerald-800">
                        {daftarTempatTidur.find((b) => b.id === bedAlokasiTerpilih)?.nomorTempatTidur} • {daftarTempatTidur.find((b) => b.id === bedAlokasiTerpilih)?.namaBangsal}
                      </span>
                    </div>
                  </div>

                  <div className="bg-amber-50 p-3 rounded-md border border-amber-200">
                    <FormFieldMolecule
                      id="verifikasiTglLahir"
                      label="Konfirmasi Tanggal Lahir Pasien (Wajib AB-020):"
                    >
                      <input
                        type="date"
                        required
                        value={verifikasiTglLahir}
                        onChange={(e) => setVerifikasiTglLahir(e.target.value)}
                        className="h-9 w-full sm:w-64 text-xs px-2.5 bg-white border border-amber-300 rounded-md focus:ring-1 focus:ring-amber-600"
                      />
                    </FormFieldMolecule>
                    <span className="text-[11px] text-amber-800 block mt-1">
                      Ketikkan tanggal lahir yang dikonfirmasi langsung oleh pasien / wali pasien. Sistem menolak alokasi bila tanggal lahir tidak sesuai (Pencegahan salah pasien).
                    </span>
                  </div>

                  <FormFieldMolecule
                    id="catatanPenempatan"
                    label="Catatan Administratif Penempatan:"
                  >
                    <input
                      type="text"
                      placeholder="Catatan ruang atau instruksi khusus dari admisi..."
                      value={catatanPenempatan}
                      onChange={(e) => setCatatanPenempatan(e.target.value)}
                      className="h-9 w-full text-xs px-2.5 bg-slate-50 border border-slate-200 rounded-md focus:bg-white"
                    />
                  </FormFieldMolecule>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setBedAlokasiTerpilih("")}
                    >
                      Batal
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={sedangSimpanAdmit}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {sedangSimpanAdmit ? "Menempatkan..." : "Sahkan Penempatan Rawat Inap"}
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Pasien Rawat Inap Aktif */}
        {tabAktif === "pasien_aktif" && (
          <div className="space-y-4">
            <DataTableFoundation<ItemEpisodeRawatInapDto>
              judulTabel="Daftar Pasien Rawat Inap Aktif"
              deskripsiTabel="Daftar episode rawat inap aktif yang sedang menempati tempat tidur di bangsal perawatan."
              kolom={kolomEpisodeAktif}
              data={daftarEpisodeTampil}
              ambilKunciBaris={(item: ItemEpisodeRawatInapDto) => item.id}
              kataKunciCari={kataKunciCari}
              onUbahKataKunciCari={setKataKunciCari}
              placeholderCari="Cari nomor episode, nama pasien, nomor bed..."
              sedangMemuat={sedangMemuatData}
              judulKosong="Tidak Ada Episode Rawat Inap Aktif"
              deskripsiKosong="Saat ini tidak ada pasien yang sedang dirawat inap."
              halamanSaatIni={halamanSaatIni}
              totalHalaman={Math.max(1, Math.ceil(daftarEpisodeTampil.length / ukuranHalaman))}
              totalData={daftarEpisodeTampil.length}
              onUbahHalaman={setHalamanSaatIni}
            />
          </div>
        )}

        {/* TAB 4: Riwayat Perpindahan Bed (AB-030, AB-034) */}
        {tabAktif === "riwayat_perpindahan" && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-700" />
                  Jejak Audit Perpindahan Ruang & Tempat Tidur
                </div>
                <span className="text-[11px] text-slate-500">
                  Total: {daftarRiwayat.length} Log Perpindahan
                </span>
              </div>

              {daftarRiwayat.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Belum ada catatan perpindahan tempat tidur.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {daftarRiwayat.map((r) => (
                    <div key={r.id} className="p-4 space-y-2 hover:bg-slate-50/60 transition-colors">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-blue-900">
                            {r.nomorEpisode}
                          </span>
                          <span className="text-xs text-slate-900 font-semibold">
                            {r.namaPasien} ({r.nomorRekamMedis})
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500">
                          {new Date(r.waktuPemindahan).toLocaleString("id-ID")}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs bg-slate-50 p-2.5 rounded-md border border-slate-200">
                        <div className="space-y-0.5">
                          <span className="text-[10px] text-slate-500 uppercase font-bold block">Dari Bed Asal:</span>
                          <span className="font-semibold text-slate-800">
                            {r.tempatTidurAsalNomor} • {r.bangsalAsalNama} (Kamar {r.kamarAsalNomor})
                          </span>
                        </div>
                        <ArrowRightLeft className="w-4 h-4 text-slate-400 shrink-0" />
                        <div className="space-y-0.5">
                          <span className="text-[10px] text-emerald-700 uppercase font-bold block">Ke Bed Tujuan:</span>
                          <span className="font-semibold text-emerald-800">
                            {r.tempatTidurTujuanNomor} • {r.bangsalTujuanNama} (Kamar {r.kamarTujuanNomor})
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-slate-600 flex items-center justify-between pt-1">
                        <div>
                          <span className="font-semibold text-slate-700">Alasan Pemindahan:</span> {r.alasanPemindahan}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Petugas: <span className="font-medium text-slate-700">{r.dipindahkanOlehNama}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Dialog: Pemindahan Tempat Tidur */}
        {episodePindahTerpilih && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-5 border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 text-blue-700" />
                  Formulir Pemindahan Tempat Tidur
                </div>
                <button
                  type="button"
                  onClick={() => setEpisodePindahTerpilih(null)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={tanganiSimpanPemindahan} className="space-y-3">
                <div className="bg-slate-50 p-3 rounded-md border border-slate-200 text-xs space-y-1">
                  <div>
                    Pasien: <span className="font-bold text-slate-900">{episodePindahTerpilih.namaPasien}</span> ({episodePindahTerpilih.nomorRekamMedis})
                  </div>
                  <div>
                    Bed Saat Ini: <span className="font-bold text-blue-900">{episodePindahTerpilih.nomorTempatTidur}</span> ({episodePindahTerpilih.namaBangsal})
                  </div>
                </div>

                <FormFieldMolecule
                  id="bedTujuanPindah"
                  label="Pilih Tempat Tidur Tujuan (Hanya Bed Tersedia):"
                >
                  <select
                    required
                    value={bedTujuanPindah}
                    onChange={(e) => setBedTujuanPindah(e.target.value)}
                    className="h-9 w-full text-xs px-2.5 bg-white border border-slate-200 rounded-md focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="">-- Pilih Bed Tujuan --</option>
                    {tempatTidurTersedia.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nomorTempatTidur} • {b.namaBangsal} (Kamar {b.nomorKamar})
                      </option>
                    ))}
                  </select>
                </FormFieldMolecule>

                <FormFieldMolecule
                  id="alasanPemindahan"
                  label="Alasan Pemindahan Tempat Tidur (Wajib AB-030):"
                >
                  <textarea
                    required
                    rows={3}
                    placeholder="Contoh: Kondisi klinis memerlukan ruang perawatan intensif atau perbaikan fasilitas kamar..."
                    value={alasanPemindahan}
                    onChange={(e) => setAlasanPemindahan(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:ring-1 focus:ring-blue-600"
                  />
                </FormFieldMolecule>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEpisodePindahTerpilih(null)}
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={sedangSimpanPindah || !bedTujuanPindah}
                    className="bg-blue-700 hover:bg-blue-800 text-white text-xs gap-1.5"
                  >
                    {sedangSimpanPindah ? "Menyimpan..." : "Eksekusi Pemindahan"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Dialog: Pemulangan Pasien (Discharge) */}
        {episodePulangTerpilih && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-5 border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="text-sm font-bold text-amber-900 flex items-center gap-2">
                  <LogOut className="w-4 h-4 text-amber-700" />
                  Pemulangan Administratif Pasien (Discharge)
                </div>
                <button
                  type="button"
                  onClick={() => setEpisodePulangTerpilih(null)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={tanganiSimpanPemulangan} className="space-y-3">
                <div className="bg-amber-50/70 p-3 rounded-md border border-amber-200 text-xs space-y-1">
                  <div>
                    Pasien: <span className="font-bold text-slate-900">{episodePulangTerpilih.namaPasien}</span> ({episodePulangTerpilih.nomorRekamMedis})
                  </div>
                  <div>
                    Bed yang akan Dikosongkan: <span className="font-bold text-slate-900">{episodePulangTerpilih.nomorTempatTidur}</span> ({episodePulangTerpilih.namaBangsal})
                  </div>
                  <div className="text-[11px] text-amber-800 pt-1 font-medium">
                    Perhatian (AB-031): Pemulangan pasien akan membebaskan tempat tidur dan secara otomatis menghentikan pesanan makanan rumah sakit mendatang.
                  </div>
                </div>

                <FormFieldMolecule
                  id="alasanPemulangan"
                  label="Status / Disposisi Pemulangan:"
                >
                  <select
                    value={alasanPemulangan}
                    onChange={(e) => setAlasanPemulangan(e.target.value as AlasanPemulangan)}
                    className="h-9 w-full text-xs px-2.5 bg-white border border-slate-200 rounded-md focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="sembuh">Izin Dokter / Sembuh (Rencana Pulang)</option>
                    <option value="rujuk_rs_lain">Rujukan ke Rumah Sakit Lain</option>
                    <option value="pulang_paksa">Pulang Atas Permintaan Sendiri (APS)</option>
                    <option value="meninggal">Pasien Meninggal Dunia</option>
                  </select>
                </FormFieldMolecule>

                <FormFieldMolecule
                  id="catatanPemulangan"
                  label="Ringkasan Catatan Pemulangan (Wajib):"
                >
                  <textarea
                    required
                    rows={3}
                    placeholder="Tuliskan catatan kelayakan pulang dari DPJP, resume klinis, atau rencana kontrol..."
                    value={catatanPemulangan}
                    onChange={(e) => setCatatanPemulangan(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:ring-1 focus:ring-blue-600"
                  />
                </FormFieldMolecule>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEpisodePulangTerpilih(null)}
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={sedangSimpanPulang}
                    className="bg-amber-700 hover:bg-amber-800 text-white text-xs gap-1.5"
                  >
                    {sedangSimpanPulang ? "Memproses..." : "Sahkan Pemulangan"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Dialog Informasi Pembatasan Kewenangan Lintas Peran (AB-032) */}
        {menuTerkunci && (
          <ConfirmDialog
            terbuka={Boolean(menuTerkunci)}
            onPerubahanTerbuka={(terbuka) => {
              if (!terbuka) {
                setMenuTerkunci(null);
              }
            }}
            judul={`Pembatasan Akses Peran: ${menuTerkunci.label}`}
            deskripsiDampak={`Sesuai BRD Bab III & AB-032, modul "${menuTerkunci.label}" dikelola oleh petugas dengan peran dan izin kewenangan terkait.`}
            labelKonfirmasi="Mengerti"
            labelBatal="Tutup"
            varianTindakan="primer"
            onKonfirmasi={() => setMenuTerkunci(null)}
          />
        )}
      </div>
    </AppShellTemplate>
  );
}
