"use client";

/**
 * @fileoverview Dashboard Operasional Utama HPNMS (`RolePortalWorkspace`).
 * Mengimplementasikan tata letak sesuai `desaind.jpg` yang terhubung langsung (live)
 * ke endpoint backend `/api/v1/*` sesuai peran pengguna yang sedang aktif berdasarkan BRD Versi 4.0 Final:
 * - Hero banner sapaan waktu nyata (WIB), lokasi bangsal penugasan, ilustrasi medis, & panel kepatuhan BRD v4.0
 * - 5 kartu metrik KPI aktual yang dimuat dari database layanan peran terkait
 * - 3 kartu tengah: Antrean/Aktivitas Aktual Hari Ini, Tautan Cepat Modul BRD, dan Donut Chart Distribusi Status
 * - 4 kartu bawah: Siklus Pelayanan Makan RS, Catatan Operasional Terbaru, Peringatan Keselamatan (AB-003 s.d. AB-032), dan Tugas Tindak Lanjut
 * - Kolom kanan: Kalender operasional aktual, Siklus Harian, Panel Notifikasi Akun, dan Asisten Panduan Kepatuhan BRD v4.0
 */

import { ambilRuteUtamaPeran } from "../../../../packages/contracts/src/index.ts";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Bot,
  Calendar as CalendarIcon,
  CalendarCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileCheck2,
  FileSpreadsheet,
  FlaskConical,
  HeartPulse,
  LockKeyhole,
  MapPin,
  MoreVertical,
  RefreshCw,
  SendHorizontal,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  Users,
} from "lucide-react";
import { SemanticIcon } from "@/components/atoms/semantic-icon";
import { StatusBadge } from "@/components/atoms/status-badge";
import {
  ErrorState,
  LoadingState,
  PermissionDeniedState,
} from "@/components/molecules/state-feedback";
import { ConfirmDialog } from "@/components/organisms/confirm-dialog";
import { AppShellTemplate } from "@/components/templates/app-shell-template";
import { useSesiAdmin } from "@/features/admin/hooks/use-sesi-admin";
import type {
  ItemNavigasiPeran,
} from "../../../../packages/shared-types/src/index.ts";


const HARI_SINGKAT = ["MIN", "SEN", "SEL", "RAB", "KAM", "JUM", "SAB"] as const;

const NAMA_BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

const JAWABAN_ASISTEN_KLINIS: Record<string, string> = {
  ringkas:
    "Aturan BRD Bab IV & V (AB-003 / AB-004): Setiap pesanan makanan oral wajib didasarkan pada instruksi diet sah berversi aktif. Diet awal yang sah dapat diproses sebelum asesmen gizi lengkap agar pasien tidak terlambat makan.",
  diet:
    "Aturan BRD Bab V & VIII (AB-007 / AB-010): Alergi berat/anafilaksis wajib memblokir bahan terkait secara otomatis. Perubahan diet mendesak saat produksi langsung menahan pesanan terdampak untuk verifikasi ulang.",
  interaksi:
    "Aturan BRD Bab IX & X (AB-005 / AB-020 / AB-025): Larangan makan/minum oral (NPO) memblokir pesanan makan mulut. Penyerahan wajib memverifikasi minimal 2 pengenal pasien, dan konsumsi belum dicatat tidak boleh dianggap 0%.",
};

interface MetrikKpiDashboard {
  label: string;
  nilai: number | string;
  keterangan: string;
}

interface BarisJadwalAktivitas {
  id: string;
  waktu: string;
  judul: string;
  subjudul: string;
  statusLabel: string;
  statusTipe: "sesuai" | "menunggu" | "ditahan";
}

interface BarisCatatanOperasional {
  id: string;
  inisial: string;
  warnaAvatar: string;
  judul: string;
  isi: string;
  waktu: string;
}

interface BarisPeringatanRisiko {
  id: string;
  tingkat: "Risiko Tinggi" | "Perhatian Klinis" | "Invarian Aktif";
  judul: string;
  detail: string;
  tipe: "tinggi" | "sedang";
}

interface DataOperasionalLive {
  kpi: [
    MetrikKpiDashboard,
    MetrikKpiDashboard,
    MetrikKpiDashboard,
    MetrikKpiDashboard,
  ];
  aktivitas: BarisJadwalAktivitas[];
  distribusi: {
    menunggu: number;
    diproses: number;
    selesai: number;
    ditahan: number;
  };
  catatan: BarisCatatanOperasional[];
  risiko: BarisPeringatanRisiko[];
  pengingat: Array<{
    id: string;
    teks: string;
    labelAksi: string;
  }>;
}

function ambilSapaanWaktu(jam: number): string {
  if (jam >= 4 && jam < 11) return "Selamat pagi,";
  if (jam >= 11 && jam < 15) return "Selamat siang,";
  if (jam >= 15 && jam < 18) return "Selamat sore,";
  return "Selamat malam,";
}

function buatInisial(teks: string): string {
  return (
    teks
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((k) => k[0] ?? "")
      .join("")
      .toUpperCase() || "RS"
  );
}

function formatJamMenit(isoAtauTeks?: string | null): string {
  if (!isoAtauTeks) return "Hari ini";
  const d = new Date(isoAtauTeks);
  if (Number.isNaN(d.getTime())) return isoAtauTeks.slice(0, 10);
  return `${d.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  })} WIB`;
}

function formatTanggalWaktuSingkat(isoAtauTeks?: string | null): string {
  if (!isoAtauTeks) return "Data operasional aktif";
  const d = new Date(isoAtauTeks);
  if (Number.isNaN(d.getTime())) return isoAtauTeks;
  return `${d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  })} • ${d.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  })} WIB`;
}

async function mintaDataDashboard(url: string, options: RequestInit): Promise<Response> {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error("Data dashboard tidak tersedia.");
  return response;
}

export function RolePortalWorkspace() {
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

  const [dialogKeluarTerbuka, setDialogKeluarTerbuka] = useState(false);
  const [menuTerkunciTerpilih, setMenuTerkunciTerpilih] =
    useState<ItemNavigasiPeran | null>(null);

  // Waktu aktual operasional
  const [waktuSekarang, setWaktuSekarang] = useState<Date>(() => new Date(0));

  // State Kalender Interaktif (diinisialisasi ke bulan & tanggal aktual saat ini)
  const [indeksBulanKalender, setIndeksBulanKalender] = useState<number>(() =>
    new Date(0).getMonth(),
  );
  const [tahunKalender, setTahunKalender] = useState<number>(() =>
    new Date(0).getFullYear(),
  );
  const [tanggalTerpilih, setTanggalTerpilih] = useState<number>(() =>
    new Date(0).getDate(),
  );

  // State Data Operasional Live dari Backend
  const [dataLive, setDataLive] = useState<DataOperasionalLive | null>(null);
  const [sedangMemuatLive, setSedangMemuatLive] = useState(false);
  const [galatLive, setGalatLive] = useState(false);

  // State Asisten Kepatuhan Interaktif
  const [topikAsistenAktif, setTopikAsistenAktif] = useState<string | null>(
    null,
  );
  const [inputAsisten, setInputAsisten] = useState("");
  const [pesanKustomAsisten, setPesanKustomAsisten] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const sekarang = new Date();
      setWaktuSekarang(sekarang);
      setIndeksBulanKalender(sekarang.getMonth());
      setTahunKalender(sekarang.getFullYear());
      setTanggalTerpilih(sekarang.getDate());
    }, 0);
    const interval = window.setInterval(() => setWaktuSekarang(new Date()), 30_000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, []);

  const muatDataOperasionalPeran = useCallback(async () => {
    if (!profil) return;
    setSedangMemuatLive(true);
    setGalatLive(false);
    try {
      const peran = profil.peran;
      const bangsalUtama = profil.daftarBangsalId[0] ?? "BANGSAL-ANGGREK";

      if (peran === "administrator") {
        const [resUsers, resKonfig, resAudit] = await Promise.all([
          mintaDataDashboard("/api/v1/admin/users?halaman=1&ukuranHalaman=10", {
            cache: "no-store",
          }),
          mintaDataDashboard("/api/v1/admin/configurations", { cache: "no-store" }),
          mintaDataDashboard("/api/v1/admin/audit-logs?halaman=1&ukuranHalaman=10", {
            cache: "no-store",
          }),
        ]);
        const jUsers = resUsers.ok ? await resUsers.json() : null;
        const jKonfig = resKonfig.ok ? await resKonfig.json() : null;
        const jAudit = resAudit.ok ? await resAudit.json() : null;

        const users: Array<Record<string, unknown>> =
          jUsers?.sukses && Array.isArray(jUsers.data?.items)
            ? jUsers.data.items
            : [];
        const totalUsers = Number(jUsers?.data?.totalItem ?? users.length);
        const aktifCount = users.filter((u) => Boolean(u.aktif)).length;
        const nonaktifCount = Math.max(0, users.length - aktifCount);
        const konfigList: Array<Record<string, unknown>> =
          jKonfig?.sukses && Array.isArray(jKonfig.data?.items)
            ? jKonfig.data.items
            : [];
        const auditList: Array<Record<string, unknown>> =
          jAudit?.sukses && Array.isArray(jAudit.data?.items)
            ? jAudit.data.items
            : [];
        const totalAudit = Number(jAudit?.data?.totalItem ?? auditList.length);

        setDataLive({
          kpi: [
            {
              label: "Total Akun Pengguna",
              nilai: totalUsers,
              keterangan: `${aktifCount} akun aktif terotorisasi`,
            },
            {
              label: "Peran Resmi BRD",
              nilai: 10,
              keterangan: "Pemisahan klinis & admin (AB-032)",
            },
            {
              label: "Konfigurasi Operasional",
              nilai: konfigList.length,
              keterangan: "Parameter berversi & teraudit (AB-030)",
            },
            {
              label: "Catatan Jejak Audit",
              nilai: totalAudit,
              keterangan: "Metadata tersanitasi otomatis",
            },
          ],
          aktivitas: users.slice(0, 5).map((u, idx) => ({
            id: String(u.id ?? idx),
            waktu: String(u.peran ?? "peran").replace(/_/g, " "),
            judul: String(u.namaLengkap ?? u.namaPengguna ?? "Pengguna"),
            subjudul: `@${String(u.namaPengguna ?? "")} • ${
              Array.isArray(u.daftarBangsalId) && u.daftarBangsalId.length > 0
                ? u.daftarBangsalId.join(", ")
                : "Tanpa batas bangsal"
            }`,
            statusLabel: u.aktif ? "Aktif" : "Nonaktif",
            statusTipe: u.aktif ? "sesuai" : "ditahan",
          })),
          distribusi: {
            menunggu: konfigList.length,
            diproses: aktifCount,
            selesai: totalAudit,
            ditahan: nonaktifCount,
          },
          catatan: auditList.slice(0, 3).map((a, idx) => ({
            id: String(a.id ?? idx),
            inisial: buatInisial(String(a.aktorPeran ?? "AD")),
            warnaAvatar: "bg-blue-100 text-blue-700",
            judul: `${String(a.tindakan ?? "Aksi Sistem")} (${String(a.objekJenis ?? "Entitas")})`,
            isi: `Aktor: ${String(a.aktorPenggunaId ?? "sistem")} • Peran: ${String(a.aktorPeran ?? "-")}`,
            waktu: formatTanggalWaktuSingkat(String(a.waktuKejadian ?? "")),
          })),
          risiko: [
            {
              id: "adm-r1",
              tingkat: "Invarian Aktif",
              judul: "Pemisahan Kewenangan Klinis (AB-032)",
              detail:
                "Administrator dilarang mengesahkan instruksi diet atau mengubah rekam medis pasien.",
              tipe: "tinggi",
            },
            {
              id: "adm-r2",
              tingkat: "Perhatian Klinis",
              judul: `Akun Nonaktif Terkunci (${nonaktifCount} Akun)`,
              detail:
                "Akun nonaktif ditolak otomatis pada gerbang autentikasi HttpOnly.",
              tipe: "sedang",
            },
            {
              id: "adm-r3",
              tingkat: "Invarian Aktif",
              judul: "Riwayat Koreksi Konfigurasi (AB-030)",
              detail: `${konfigList.length} parameter operasional tersimpan dengan versi dan alasan wajib.`,
              tipe: "sedang",
            },
          ],
          pengingat: [
            {
              id: "rem-a1",
              teks: `${totalUsers} akun terdaftar dalam matriks RBAC rumah sakit`,
              labelAksi: "Kelola",
            },
            {
              id: "rem-a2",
              teks: `${konfigList.length} konfigurasi master operasional aktif`,
              labelAksi: "Tinjau",
            },
            {
              id: "rem-a3",
              teks: `${totalAudit} jejak audit akses tercatat dengan redaksi PII`,
              labelAksi: "Audit",
            },
          ],
        });
        return;
      }

      if (peran === "petugas_pendaftaran") {
        const [resPasien, resKunjungan] = await Promise.all([
          mintaDataDashboard("/api/v1/patients?halaman=1&ukuranHalaman=10", {
            cache: "no-store",
          }),
          mintaDataDashboard("/api/v1/patients/visits?halaman=1&ukuranHalaman=10", {
            cache: "no-store",
          }),
        ]);
        const jPasien = resPasien.ok ? await resPasien.json() : null;
        const jKunjungan = resKunjungan.ok ? await resKunjungan.json() : null;

        const pasienList: Array<Record<string, unknown>> =
          jPasien?.sukses && Array.isArray(jPasien.data?.items)
            ? jPasien.data.items
            : [];
        const totalPasien = Number(
          jPasien?.data?.totalItem ?? pasienList.length,
        );
        const kunjunganList: Array<Record<string, unknown>> =
          jKunjungan?.sukses && Array.isArray(jKunjungan.data?.items)
            ? jKunjungan.data.items
            : [];
        const ringkasan = jKunjungan?.data?.ringkasanAntrean ?? {
          menungguPemeriksaan: kunjunganList.length,
          mendesakMenunggu: 0,
          sedangDiperiksa: 0,
          dibatalkanHariIni: 0,
        };

        setDataLive({
          kpi: [
            {
              label: "Total Pasien Terdaftar",
              nilai: totalPasien,
              keterangan: "Verifikasi minimal 2 pengenal (AB-020)",
            },
            {
              label: "Menunggu Pemeriksaan",
              nilai: Number(ringkasan.menungguPemeriksaan ?? 0),
              keterangan: "Antrean poliklinik & IGD aktif",
            },
            {
              label: "Sedang Diperiksa DPJP",
              nilai: Number(ringkasan.sedangDiperiksa ?? 0),
              keterangan: "Terhubung ke modul Dokter",
            },
            {
              label: "Prioritas Mendesak",
              nilai: Number(ringkasan.mendesakMenunggu ?? 0),
              keterangan: "Penanganan segera diutamakan",
            },
          ],
          aktivitas: kunjunganList.slice(0, 5).map((k, idx) => ({
            id: String(k.id ?? idx),
            waktu: formatJamMenit(String(k.waktuRegistrasi ?? "")),
            judul: `${String(k.namaLengkapPasien ?? "Pasien")} (${String(k.nomorRekamMedis ?? "-")})`,
            subjudul: `${String(k.unitTujuan ?? "Poliklinik")} • ${String(k.dokterTujuanNama ?? "DPJP")}`,
            statusLabel:
              k.statusKunjungan === "menunggu_pemeriksaan"
                ? "Menunggu"
                : k.statusKunjungan === "sedang_diperiksa"
                  ? "Diperiksa"
                  : "Terkonfirmasi",
            statusTipe:
              k.prioritas === "mendesak"
                ? "ditahan"
                : k.statusKunjungan === "menunggu_pemeriksaan"
                  ? "menunggu"
                  : "sesuai",
          })),
          distribusi: {
            menunggu: Number(ringkasan.menungguPemeriksaan ?? kunjunganList.filter((item) => item.statusKunjungan === "menunggu_pemeriksaan").length),
            diproses: Number(ringkasan.sedangDiperiksa ?? kunjunganList.filter((item) => item.statusKunjungan === "sedang_diperiksa").length),
            selesai: totalPasien,
            ditahan: Number(ringkasan.mendesakMenunggu ?? 0),
          },
          catatan: pasienList.slice(0, 3).map((p, idx) => ({
            id: String(p.id ?? idx),
            inisial: buatInisial(String(p.namaLengkap ?? "PS")),
            warnaAvatar: "bg-sky-100 text-sky-700",
            judul: `${String(p.namaLengkap ?? "Pasien")} (${String(p.nomorRekamMedis ?? "-")})`,
            isi: `Tgl Lahir: ${String(p.tanggalLahir ?? "-")} • Status: ${String(p.statusVerifikasi ?? "terverifikasi").replace(/_/g, " ")}`,
            waktu: formatTanggalWaktuSingkat(String(p.waktuDibuat ?? "")),
          })),
          risiko: [
            {
              id: "pend-r1",
              tingkat: "Invarian Aktif",
              judul: "Pencegahan Rekam Medis Ganda (AB-001)",
              detail:
                "Setiap registrasi baru wajib melewati deteksi kemiripan NIK, nama, dan tanggal lahir.",
              tipe: "tinggi",
            },
            {
              id: "pend-r2",
              tingkat: "Perhatian Klinis",
              judul: `${Number(ringkasan.mendesakMenunggu ?? 0)} Kunjungan Prioritas Mendesak`,
              detail:
                "Kunjungan berprioritas mendesak ditempatkan di urutan atas antrean pemeriksaan dokter.",
              tipe: "sedang",
            },
          ],
          pengingat: [
            {
              id: "rem-p1",
              teks: `${Number(ringkasan.menungguPemeriksaan ?? 0)} pasien dalam antrean tunggu pemeriksaan dokter`,
              labelAksi: "Lihat",
            },
            {
              id: "rem-p2",
              teks: `${totalPasien} identitas pasien telah diverifikasi dua pengenal`,
              labelAksi: "Buka",
            },
          ],
        });
        return;
      }

      if (peran === "dokter") {
        const resQueue = await mintaDataDashboard("/api/v1/clinical-nutrition/queue", {
          cache: "no-store",
        });
        const jQueue = resQueue.ok ? await resQueue.json() : null;
        const antrean: Array<Record<string, unknown>> =
          jQueue?.sukses && Array.isArray(jQueue.data?.items)
            ? jQueue.data.items
            : [];
        const ringkasan = jQueue?.data?.ringkasan ?? {
          menungguPemeriksaan: 0,
          sedangDiperiksa: 0,
          selesaiPemeriksaan: 0,
          diajukanRawatInap: 0,
        };

        setDataLive({
          kpi: [
            {
              label: "Total Antrean Pasien",
              nilai: antrean.length,
              keterangan: `Penugasan: ${profil.daftarBangsalId.join(", ") || "Poliklinik"}`,
            },
            {
              label: "Menunggu Pemeriksaan",
              nilai: Number(ringkasan.menungguPemeriksaan ?? 0),
              keterangan: "Siap diperiksa & ditetapkan diet awal",
            },
            {
              label: "Sedang Diperiksa",
              nilai: Number(ringkasan.sedangDiperiksa ?? 0),
              keterangan: "Evaluasi klinis & alergi aktif",
            },
            {
              label: "Pengajuan Rawat Inap",
              nilai: Number(ringkasan.diajukanRawatInap ?? 0),
              keterangan: "Diteruskan ke Petugas Rawat Inap",
            },
          ],
          aktivitas: antrean.slice(0, 5).map((item, idx) => ({
            id: String(item.kunjunganId ?? idx),
            waktu: formatJamMenit(String(item.waktuRegistrasi ?? "")),
            judul: `${String(item.namaPasien ?? "Pasien")} (${String(item.nomorRekamMedis ?? "-")})`,
            subjudul: `${String(item.keluhanRingkas ?? item.unitTujuan ?? "Pemeriksaan Klinis")} • Diet: ${String(item.jenisDietAktif ?? "Belum ditetapkan").replace(/_/g, " ")}`,
            statusLabel: item.instruksiDietAktifId
              ? "Diet Disahkan"
              : "Menunggu Diet",
            statusTipe: item.memilikiAlergiBerat
              ? "ditahan"
              : item.instruksiDietAktifId
                ? "sesuai"
                : "menunggu",
          })),
          distribusi: {
            menunggu: Number(ringkasan.menungguPemeriksaan ?? 0),
            diproses: Number(ringkasan.sedangDiperiksa ?? 0),
            selesai: Number(ringkasan.selesaiPemeriksaan ?? 0),
            ditahan: Number(ringkasan.diajukanRawatInap ?? 0),
          },
          catatan: antrean.slice(0, 3).map((item, idx) => ({
            id: String(item.pasienId ?? idx),
            inisial: buatInisial(String(item.namaPasien ?? "PS")),
            warnaAvatar: "bg-indigo-100 text-indigo-700",
            judul: `${String(item.namaPasien ?? "Pasien")} (${String(item.nomorRekamMedis ?? "-")})`,
            isi: `Keluhan: ${String(item.keluhanRingkas ?? "Pemeriksaan awal")} • Alergi tercatat: ${Number(item.jumlahAlergiTercatat ?? 0)}`,
            waktu: `Bangsal: ${String(item.bangsalId ?? "-")} • Tgl Lahir: ${String(item.tanggalLahir ?? "-")}`,
          })),
          risiko: antrean
            .filter((i) => Boolean(i.memilikiAlergiBerat) || !i.instruksiDietAktifId)
            .slice(0, 3)
            .map((i, idx) => ({
              id: `dok-r-${idx}`,
              tingkat: i.memilikiAlergiBerat
                ? "Risiko Tinggi"
                : "Perhatian Klinis",
              judul: `${String(i.namaPasien ?? "Pasien")} (${String(i.nomorRekamMedis ?? "-")})`,
              detail: i.memilikiAlergiBerat
                ? "Terdeteksi riwayat alergi berat/anafilaksis (AB-007). Verifikasi ketat instruksi diet."
                : "Instruksi diet awal belum disahkan (AB-003). Pesanan makan ditahan hingga disahkan.",
              tipe: i.memilikiAlergiBerat ? "tinggi" : "sedang",
            })),
          pengingat: [
            {
              id: "rem-d1",
              teks: `${Number(ringkasan.menungguPemeriksaan ?? 0)} pasien menunggu pemeriksaan awal DPJP`,
              labelAksi: "Periksa",
            },
            {
              id: "rem-d2",
              teks: `${antrean.filter((i) => !i.instruksiDietAktifId).length} pasien membutuhkan pengesahan instruksi diet awal (AB-003)`,
              labelAksi: "Sahkan",
            },
            {
              id: "rem-d3",
              teks: `${Number(ringkasan.diajukanRawatInap ?? 0)} pengajuan rawat inap aktif`,
              labelAksi: "Lihat",
            },
          ],
        });
        return;
      }

      if (peran === "petugas_rawat_inap") {
        const [resOv, resReq, resEp] = await Promise.all([
          mintaDataDashboard("/api/v1/inpatient/overview", { cache: "no-store" }),
          mintaDataDashboard("/api/v1/inpatient/admission-requests", { cache: "no-store" }),
          mintaDataDashboard("/api/v1/inpatient/episodes", { cache: "no-store" }),
        ]);
        const jOv = resOv.ok ? await resOv.json() : null;
        const jReq = resReq.ok ? await resReq.json() : null;
        const jEp = resEp.ok ? await resEp.json() : null;

        const ov = jOv?.data ?? {};
        const reqList: Array<Record<string, unknown>> =
          jReq?.sukses && Array.isArray(jReq.data?.items)
            ? jReq.data.items
            : [];
        const epList: Array<Record<string, unknown>> =
          jEp?.sukses && Array.isArray(jEp.data?.items) ? jEp.data.items : [];

        setDataLive({
          kpi: [
            {
              label: "Episode Rawat Inap Aktif",
              nilai: Number(ov.totalEpisodeAktif ?? epList.length),
              keterangan: "Pasien menempati tempat tidur sah (AB-002)",
            },
            {
              label: "Pengajuan Menunggu Bed",
              nilai: Number(ov.pengajuanMenunggu ?? reqList.length),
              keterangan: "Rujukan rawat inap dari DPJP",
            },
            {
              label: "Tempat Tidur Tersedia",
              nilai: Number(ov.tempatTidurTersedia ?? 0),
              keterangan: "Bebas konflik alokasi ganda",
            },
            {
              label: "Perpindahan & Pulang",
              nilai: Number(ov.perpindahanHariIni ?? 0) + Number(ov.dipulangkanHariIni ?? 0),
              keterangan: "Otomatis sinkron ke layanan gizi (AB-031)",
            },
          ],
          aktivitas: epList.slice(0, 5).map((ep, idx) => ({
            id: String(ep.id ?? idx),
            waktu: String(ep.nomorEpisode ?? `EP-${idx + 1}`),
            judul: `${String(ep.namaPasien ?? "Pasien")} (${String(ep.nomorRekamMedis ?? "-")})`,
            subjudul: `${String(ep.namaBangsal ?? ep.bangsalId ?? "-")} • Kamar ${String(ep.nomorKamar ?? "-")} / Bed ${String(ep.kodeTempatTidur ?? "-")}`,
            statusLabel:
              ep.statusEpisode === "aktif" ? "Dirawat Aktif" : String(ep.statusEpisode ?? "Aktif"),
            statusTipe: ep.statusEpisode === "aktif" ? "sesuai" : "menunggu",
          })),
          distribusi: {
            menunggu: Number(ov.pengajuanMenunggu ?? 0),
            diproses: Number(ov.totalEpisodeAktif ?? epList.length),
            selesai: Number(ov.tempatTidurTersedia ?? 0),
            ditahan: Number(ov.perpindahanHariIni ?? 0),
          },
          catatan: reqList.slice(0, 3).map((r, idx) => ({
            id: String(r.id ?? idx),
            inisial: buatInisial(String(r.namaPasien ?? "RI")),
            warnaAvatar: "bg-emerald-100 text-emerald-700",
            judul: `Pengajuan Rawat Inap: ${String(r.namaPasien ?? "Pasien")}`,
            isi: `Diagnosis: ${String(r.diagnosisKerja ?? "-")} • Bangsal Tujuan: ${String(r.bangsalTujuan ?? "-")}`,
            waktu: `Prioritas: ${String(r.prioritas ?? "normal").toUpperCase()}`,
          })),
          risiko: [
            {
              id: "ri-r1",
              tingkat: "Invarian Aktif",
              judul: "Identitas Pasien ≠ Nomor Kamar (AB-002 & AB-020)",
              detail:
                "Perpindahan kamar segera memperbarui lokasi distribusi tanpa menggunakan nomor kamar sebagai satu-satunya pengenal.",
              tipe: "tinggi",
            },
            {
              id: "ri-r2",
              tingkat: "Perhatian Klinis",
              judul: "Penghentian Pesanan Saat Pasien Pulang (AB-031)",
              detail:
                "Pemulangan administratif otomatis menghentikan pembuatan pesanan makanan jadwal berikutnya.",
              tipe: "sedang",
            },
          ],
          pengingat: [
            {
              id: "rem-ri1",
              teks: `${Number(ov.pengajuanMenunggu ?? 0)} pengajuan rawat inap menunggu alokasi tempat tidur`,
              labelAksi: "Alokasikan",
            },
            {
              id: "rem-ri2",
              teks: `${Number(ov.totalEpisodeAktif ?? epList.length)} episode rawat inap aktif sedang berjalan`,
              labelAksi: "Pantau",
            },
          ],
        });
        return;
      }

      if (peran === "perawat") {
        const [resPasien, resObs] = await Promise.all([
          mintaDataDashboard(
            `/api/v1/nursing/patients?bangsalId=${encodeURIComponent(bangsalUtama)}`,
            { cache: "no-store" },
          ),
          mintaDataDashboard(
            `/api/v1/nursing/intake-observations?bangsalId=${encodeURIComponent(bangsalUtama)}`,
            { cache: "no-store" },
          ),
        ]);
        const jPasien = resPasien.ok ? await resPasien.json() : null;
        const jObs = resObs.ok ? await resObs.json() : null;
        const pList: Array<Record<string, unknown>> =
          jPasien?.sukses && Array.isArray(jPasien.data?.items)
            ? jPasien.data.items
            : [];
        const oList: Array<Record<string, unknown>> =
          jObs?.sukses && Array.isArray(jObs.data?.items)
            ? jObs.data.items
            : [];

        const sudahVerifikasi = pList.filter(
          (p) => p.statusVerifikasiTerakhir === "aman_lolos",
        ).length;
        const ditahanCount = pList.filter(
          (p) => p.statusVerifikasiTerakhir === "ditahan_safety_hold",
        ).length;

        setDataLive({
          kpi: [
            {
              label: `Pasien ${bangsalUtama}`,
              nilai: pList.length,
              keterangan: "Pasien rawat inap pada bangsal penugasan",
            },
            {
              label: "Verifikasi Keamanan Lolos",
              nilai: sudahVerifikasi,
              keterangan: "Menelan, kesadaran & NPO diperiksa",
            },
            {
              label: "Catatan Konsumsi (Comstock)",
              nilai: oList.length,
              keterangan: "Belum dicatat ≠ konsumsi 0% (AB-025)",
            },
            {
              label: "Safety Hold Bangsal",
              nilai: ditahanCount,
              keterangan: "Pesanan ditahan demi keselamatan",
            },
          ],
          aktivitas: pList.slice(0, 5).map((p, idx) => ({
            id: String(p.episodeId ?? idx),
            waktu: `Bed ${String(p.kodeTempatTidur ?? "-")}`,
            judul: `${String(p.namaPasien ?? "Pasien")} (${String(p.nomorRekamMedis ?? "-")})`,
            subjudul: `Diet: ${String(p.jenisDietAktif ?? "-").replace(/_/g, " ")} (${String(p.bentukMakananAktif ?? "-")})`,
            statusLabel:
              p.statusVerifikasiTerakhir === "aman_lolos"
                ? "Aman Lolos"
                : p.statusVerifikasiTerakhir === "ditahan_safety_hold"
                  ? "Safety Hold"
                  : "Perlu Verifikasi",
            statusTipe:
              p.statusVerifikasiTerakhir === "ditahan_safety_hold"
                ? "ditahan"
                : p.statusVerifikasiTerakhir === "aman_lolos"
                  ? "sesuai"
                  : "menunggu",
          })),
          distribusi: {
            menunggu: Math.max(0, pList.length - sudahVerifikasi - ditahanCount),
            diproses: sudahVerifikasi,
            selesai: oList.length,
            ditahan: ditahanCount,
          },
          catatan: oList.slice(0, 3).map((o, idx) => ({
            id: String(o.id ?? idx),
            inisial: buatInisial(String(o.namaPasien ?? "PR")),
            warnaAvatar: "bg-purple-100 text-purple-700",
            judul: `${String(o.namaPasien ?? "Pasien")} • ${String(o.jadwalMakan ?? "Makan").toUpperCase()}`,
            isi: `Skala Comstock: ${String(o.persentaseDikonsumsi ?? 0)}% dikonsumsi • Kondisi: ${String(o.kondisiPemberian ?? "-")}`,
            waktu: formatTanggalWaktuSingkat(String(o.waktuPencatatan ?? "")),
          })),
          risiko: [
            {
              id: "per-r1",
              tingkat: "Risiko Tinggi",
              judul: "Pemeriksaan Menelan & Risiko Aspirasi (AB-008)",
              detail:
                "Gangguan menelan atau penurunan kesadaran wajib memicu penahanan makanan biasa dan eskalasi ke DPJP.",
              tipe: "tinggi",
            },
            {
              id: "per-r2",
              tingkat: "Invarian Aktif",
              judul: "Konsumsi Belum Dicatat ≠ 0% Dikonsumsi (AB-025)",
              detail:
                "Sistem membedakan secara tegas pasien yang belum dicatat asupannya dari pasien dengan konsumsi 0%.",
              tipe: "sedang",
            },
          ],
          pengingat: [
            {
              id: "rem-pr1",
              teks: `${pList.length} pasien di ${bangsalUtama} memerlukan pemantauan keamanan makanan & MST`,
              labelAksi: "Verifikasi",
            },
            {
              id: "rem-pr2",
              teks: `${oList.length} catatan observasi sisa makanan Comstock terekam`,
              labelAksi: "Catat",
            },
          ],
        });
        return;
      }

      if (peran === "ahli_gizi") {
        const [resPasien, resAdime, resMenu, resEval] = await Promise.all([
          mintaDataDashboard("/api/v1/dietitian/patients", { cache: "no-store" }),
          mintaDataDashboard("/api/v1/dietitian/nutrition-care", { cache: "no-store" }),
          mintaDataDashboard("/api/v1/meal-planning/individual-menus", { cache: "no-store" }),
          mintaDataDashboard("/api/v1/dietitian/evaluations", { cache: "no-store" }),
        ]);
        const jPasien = resPasien.ok ? await resPasien.json() : null;
        const jAdime = resAdime.ok ? await resAdime.json() : null;
        const jMenu = resMenu.ok ? await resMenu.json() : null;
        const jEval = resEval.ok ? await resEval.json() : null;

        const pList: Array<Record<string, unknown>> =
          jPasien?.sukses && Array.isArray(jPasien.data?.items)
            ? jPasien.data.items
            : [];
        const adimeList: Array<Record<string, unknown>> =
          jAdime?.sukses && Array.isArray(jAdime.data?.items)
            ? jAdime.data.items
            : [];
        const menuList: Array<Record<string, unknown>> =
          jMenu?.sukses && Array.isArray(jMenu.data?.items)
            ? jMenu.data.items
            : [];
        const evalList: Array<Record<string, unknown>> =
          jEval?.sukses && Array.isArray(jEval.data?.items)
            ? jEval.data.items
            : [];

        setDataLive({
          kpi: [
            {
              label: "Pasien Asuhan Gizi",
              nilai: pList.length,
              keterangan: "Cakupan bangsal penugasan Dietisien",
            },
            {
              label: "Asesmen ADIME Sah",
              nilai: adimeList.length,
              keterangan: "Target energi & protein individual (AB-009)",
            },
            {
              label: "Rencana Menu Individual",
              nilai: menuList.length,
              keterangan: "Tervalidasi bebas alergen pasien (AB-007)",
            },
            {
              label: "Evaluasi 4-Tahap Gizi",
              nilai: evalList.length,
              keterangan: "Dibutuhkan vs Direncanakan vs Dikonsumsi",
            },
          ],
          aktivitas: pList.slice(0, 5).map((p, idx) => ({
            id: String(p.episodeId ?? idx),
            waktu: String(p.nomorRekamMedis ?? "-"),
            judul: String(p.namaPasien ?? "Pasien"),
            subjudul: `Diet: ${String(p.jenisDietAktif ?? "-").replace(/_/g, " ")} • Risiko MST: ${String(p.kategoriRisikoMst ?? "normal").replace(/_/g, " ")}`,
            statusLabel: p.sudahAdaAdime ? "ADIME Aktif" : "Perlu Asesmen",
            statusTipe: p.sudahAdaAdime ? "sesuai" : "menunggu",
          })),
          distribusi: {
            menunggu: Math.max(0, pList.length - adimeList.length),
            diproses: adimeList.length,
            selesai: menuList.length,
            ditahan: evalList.filter((e) => Boolean(e.perluRevisiMenu)).length,
          },
          catatan: adimeList.slice(0, 3).map((a, idx) => ({
            id: String(a.id ?? idx),
            inisial: buatInisial(String(a.namaPasien ?? "AG")),
            warnaAvatar: "bg-emerald-100 text-emerald-700",
            judul: `ADIME: ${String(a.namaPasien ?? "Pasien")}`,
            isi: `Target: ${String(a.targetEnergiKkal ?? "-")} kkal, Protein ${String(a.targetProteinGram ?? "-")}g • Diagnosis Gizi: ${String(a.diagnosisGiziPes ?? "-")}`,
            waktu: formatTanggalWaktuSingkat(String(a.waktuDisahkan ?? "")),
          })),
          risiko: [
            {
              id: "ag-r1",
              tingkat: "Risiko Tinggi",
              judul: "Blokir Otomatis Alergen & Tekstur (AB-007 & AB-011)",
              detail:
                "Menu individual yang mengandung alergen pasien atau tekstur tidak kompatibel ditolak saat pengesahan.",
              tipe: "tinggi",
            },
            {
              id: "ag-r2",
              tingkat: "Perhatian Klinis",
              judul: "Evaluasi 4 Tahap Pemenuhan Gizi (AB-026)",
              detail:
                "Membandingkan gizi yang dibutuhkan, direncanakan, disajikan, dan aktual dikonsumsi pasien.",
              tipe: "sedang",
            },
          ],
          pengingat: [
            {
              id: "rem-ag1",
              teks: `${pList.length} pasien rawat inap dalam daftar kerja asuhan gizi`,
              labelAksi: "Asesmen",
            },
            {
              id: "rem-ag2",
              teks: `${menuList.length} rencana menu individual telah disusun`,
              labelAksi: "Menu",
            },
          ],
        });
        return;
      }

      if (peran === "petugas_gudang") {
        const [resItems, resLots, resReqs, resLedger] = await Promise.all([
          mintaDataDashboard("/api/v1/inventory/items", { cache: "no-store" }),
          mintaDataDashboard("/api/v1/inventory/lots", { cache: "no-store" }),
          mintaDataDashboard("/api/v1/inventory/requests", { cache: "no-store" }),
          mintaDataDashboard("/api/v1/inventory/ledger", { cache: "no-store" }),
        ]);
        const jItems = resItems.ok ? await resItems.json() : null;
        const jLots = resLots.ok ? await resLots.json() : null;
        const jReqs = resReqs.ok ? await resReqs.json() : null;
        const jLedger = resLedger.ok ? await resLedger.json() : null;

        const items: Array<Record<string, unknown>> =
          jItems?.sukses && Array.isArray(jItems.data) ? jItems.data : [];
        const lots: Array<Record<string, unknown>> =
          jLots?.sukses && Array.isArray(jLots.data) ? jLots.data : [];
        const reqs: Array<Record<string, unknown>> =
          jReqs?.sukses && Array.isArray(jReqs.data) ? jReqs.data : [];
        const ledger: Array<Record<string, unknown>> =
          jLedger?.sukses && Array.isArray(jLedger.data) ? jLedger.data : [];

        const lotLayak = lots.filter(
          (l) => l.statusKelayakan === "layak_pakai",
        ).length;
        const lotKarantina = lots.length - lotLayak;

        setDataLive({
          kpi: [
            {
              label: "Master Bahan Pangan",
              nilai: items.length,
              keterangan: "Katalog bahan baku instalasi gizi",
            },
            {
              label: "Lot Stok Layak Pakai",
              nilai: lotLayak,
              keterangan: "Lulus QC suhu & kedaluwarsa (AB-015)",
            },
            {
              label: "Permintaan Bahan Dapur",
              nilai: reqs.length,
              keterangan: "Alokasi FEFO bebas stok negatif (AB-016)",
            },
            {
              label: "Mutasi Buku Besar Stok",
              nilai: ledger.length,
              keterangan: "Ketertelusuran lot ke produksi (AB-017)",
            },
          ],
          aktivitas: lots.slice(0, 5).map((l, idx) => ({
            id: String(l.id ?? idx),
            waktu: String(l.nomorLot ?? `LOT-${idx + 1}`),
            judul: String(l.namaBahan ?? l.kodeBahan ?? "Bahan Pangan"),
            subjudul: `Stok Tersedia: ${String(l.kuantitasTersedia ?? 0)} ${String(l.satuan ?? "")} • Exp: ${String(l.tanggalKedaluwarsa ?? "-")}`,
            statusLabel:
              l.statusKelayakan === "layak_pakai" ? "Layak Pakai" : "Karantina",
            statusTipe:
              l.statusKelayakan === "layak_pakai" ? "sesuai" : "ditahan",
          })),
          distribusi: {
            menunggu: reqs.filter((r) => r.status === "menunggu_alokasi").length,
            diproses: reqs.filter((r) => r.status === "dialokasikan").length,
            selesai: lotLayak,
            ditahan: lotKarantina,
          },
          catatan: ledger.slice(0, 3).map((lg, idx) => ({
            id: String(lg.id ?? idx),
            inisial: "GD",
            warnaAvatar: "bg-amber-100 text-amber-800",
            judul: `${String(lg.jenisTransaksi ?? "Mutasi").toUpperCase()} • ${String(lg.nomorLot ?? "-")}`,
            isi: `Kuantitas: ${String(lg.perubahanKuantitas ?? 0)} • Saldo akhir: ${String(lg.saldoAkhir ?? 0)}`,
            waktu: formatTanggalWaktuSingkat(String(lg.waktuTransaksi ?? "")),
          })),
          risiko: [
            {
              id: "gd-r1",
              tingkat: "Risiko Tinggi",
              judul: "Larangan Stok Negatif & Lot Kedaluwarsa (AB-015 & AB-016)",
              detail:
                "Bahan rusak, kedaluwarsa, atau berstatus karantina diblokir otomatis dari alokasi produksi dapur.",
              tipe: "tinggi",
            },
            {
              id: "gd-r2",
              tingkat: "Perhatian Klinis",
              judul: `${lotKarantina} Lot Dalam Karantina / Pemusnahan`,
              detail:
                "Wajib dipisahkan secara fisik dan dicatat berita acara pemusnahannya.",
              tipe: "sedang",
            },
          ],
          pengingat: [
            {
              id: "rem-g1",
              teks: `${reqs.length} permintaan bahan produksi dapur terdaftar`,
              labelAksi: "Alokasikan",
            },
            {
              id: "rem-g2",
              teks: `${lotLayak} lot bahan pangan aktif dengan urutan FEFO`,
              labelAksi: "Periksa",
            },
          ],
        });
        return;
      }

      if (peran === "petugas_dapur") {
        const [resOv, resPlans, resBatches, resLabels] = await Promise.all([
          mintaDataDashboard("/api/v1/kitchen/overview", { cache: "no-store" }),
          mintaDataDashboard("/api/v1/kitchen/production-plans", { cache: "no-store" }),
          mintaDataDashboard("/api/v1/kitchen/batches", { cache: "no-store" }),
          mintaDataDashboard("/api/v1/kitchen/portion-labels", { cache: "no-store" }),
        ]);
        const jOv = resOv.ok ? await resOv.json() : null;
        const jPlans = resPlans.ok ? await resPlans.json() : null;
        const jBatches = resBatches.ok ? await resBatches.json() : null;
        const jLabels = resLabels.ok ? await resLabels.json() : null;

        const ov = jOv?.data ?? {};
        const plans: Array<Record<string, unknown>> =
          jPlans?.sukses && Array.isArray(jPlans.data) ? jPlans.data : [];
        const batches: Array<Record<string, unknown>> =
          jBatches?.sukses && Array.isArray(jBatches.data) ? jBatches.data : [];
        const labels: Array<Record<string, unknown>> =
          jLabels?.sukses && Array.isArray(jLabels.data) ? jLabels.data : [];

        setDataLive({
          kpi: [
            {
              label: "Rencana Produksi H-1",
              nilai: Number(ov.totalRencanaH1 ?? plans.length),
              keterangan: "Kalkulasi porsi & kapasitas dapur (AB-012)",
            },
            {
              label: "Batch Memasak Aktif",
              nilai: Number(ov.totalBatchProduksi ?? batches.length),
              keterangan: "Wajib CCP suhu inti >= 75°C (AB-019)",
            },
            {
              label: "Porsi Siap Distribusi",
              nilai: Number(ov.totalPorsiSiapDistribusi ?? labels.length),
              keterangan: "Lulus uji mutu akhir & berlabel",
            },
            {
              label: "Porsi Ditahan (Hold)",
              nilai: Number(ov.totalPorsiDitahan ?? 0),
              keterangan: "Dampak perubahan diet mendesak (AB-010)",
            },
          ],
          aktivitas: batches.slice(0, 5).map((b, idx) => ({
            id: String(b.id ?? idx),
            waktu: String(b.kodeBatch ?? `BATCH-${idx + 1}`),
            judul: String(b.namaMenu ?? "Produksi Makanan"),
            subjudul: `Jadwal: ${String(b.jadwalMakan ?? "-").toUpperCase()} • Target: ${String(b.jumlahPorsiTarget ?? 0)} porsi`,
            statusLabel:
              b.statusBatch === "lulus_mutu"
                ? "Lulus QC"
                : String(b.statusBatch ?? "Proses").replace(/_/g, " "),
            statusTipe:
              b.statusBatch === "ditahan"
                ? "ditahan"
                : b.statusBatch === "lulus_mutu"
                  ? "sesuai"
                  : "menunggu",
          })),
          distribusi: {
            menunggu: plans.length,
            diproses: batches.length,
            selesai: Number(ov.totalPorsiSiapDistribusi ?? labels.length),
            ditahan: Number(ov.totalPorsiDitahan ?? 0),
          },
          catatan: labels.slice(0, 3).map((lb, idx) => ({
            id: String(lb.id ?? idx),
            inisial: buatInisial(String(lb.namaPasien ?? "DP")),
            warnaAvatar: "bg-sky-100 text-sky-700",
            judul: `Label Porsi: ${String(lb.namaPasien ?? "Pasien")} (${String(lb.nomorRekamMedis ?? "-")})`,
            isi: `Diet: ${String(lb.jenisDiet ?? "-").replace(/_/g, " ")} • Tekstur: ${String(lb.bentukMakanan ?? "-")}`,
            waktu: `Kode Label: ${String(lb.kodeLabel ?? "-")} • Status: ${String(lb.statusLabel ?? "-")}`,
          })),
          risiko: [
            {
              id: "dp-r1",
              tingkat: "Risiko Tinggi",
              judul: "Pemeriksaan Mutu Akhir & Suhu CCP >= 75°C (AB-019)",
              detail:
                "Batch masakan belum boleh dikemas atau dikirim ke bangsal sebelum lulus uji organoleptik dan suhu inti.",
              tipe: "tinggi",
            },
            {
              id: "dp-r2",
              tingkat: "Perhatian Klinis",
              judul: "Penahanan Otomatis Saat Diet Berubah (AB-010)",
              detail:
                "Perubahan instruksi diet DPJP menahan label porsi lama agar tidak salah diserahkan.",
              tipe: "sedang",
            },
          ],
          pengingat: [
            {
              id: "rem-dp1",
              teks: `${batches.length} batch produksi sedang dipantau suhu CCP & mutu akhirnya`,
              labelAksi: "Periksa",
            },
            {
              id: "rem-dp2",
              teks: `${labels.length} label porsi individual pasien tercatat di dapur`,
              labelAksi: "Label",
            },
          ],
        });
        return;
      }

      if (peran === "petugas_distribusi") {
        const [resOv, resTrolleys, resItems, resInc] = await Promise.all([
          mintaDataDashboard("/api/v1/delivery-intake/overview", { cache: "no-store" }),
          mintaDataDashboard("/api/v1/delivery-intake/trolleys", { cache: "no-store" }),
          mintaDataDashboard("/api/v1/delivery-intake/items", { cache: "no-store" }),
          mintaDataDashboard("/api/v1/delivery-intake/incidents", { cache: "no-store" }),
        ]);
        const jOv = resOv.ok ? await resOv.json() : null;
        const jTrolleys = resTrolleys.ok ? await resTrolleys.json() : null;
        const jItems = resItems.ok ? await resItems.json() : null;
        const jInc = resInc.ok ? await resInc.json() : null;

        const ov = jOv?.data ?? {};
        const trolleys: Array<Record<string, unknown>> =
          jTrolleys?.sukses && Array.isArray(jTrolleys.data)
            ? jTrolleys.data
            : [];
        const items: Array<Record<string, unknown>> =
          jItems?.sukses && Array.isArray(jItems.data) ? jItems.data : [];
        const incidents: Array<Record<string, unknown>> =
          jInc?.sukses && Array.isArray(jInc.data) ? jInc.data : [];

        setDataLive({
          kpi: [
            {
              label: "Troli Distribusi Bangsal",
              nilai: Number(ov.totalTroliHariIni ?? trolleys.length),
              keterangan: "Suhu troli terverifikasi sebelum berangkat",
            },
            {
              label: "Porsi Siap Serah",
              nilai: Number(ov.porsiMenungguPenyerahan ?? items.length),
              keterangan: "Wajib cek 2 pengenal & diet terbaru (AB-020)",
            },
            {
              label: "Berhasil Diserahkan",
              nilai: Number(ov.porsiBerhasilDiserahkan ?? 0),
              keterangan: "Diserahkan ≠ otomatis dikonsumsi (AB-023)",
            },
            {
              label: "Ditahan Saat Serah",
              nilai: Number(ov.porsiDitahanKeselamatan ?? 0),
              keterangan: "Ketidaksesuaian diet/identitas/NPO",
            },
          ],
          aktivitas: items.slice(0, 5).map((it, idx) => ({
            id: String(it.id ?? idx),
            waktu: `Bed ${String(it.kodeTempatTidur ?? "-")}`,
            judul: `${String(it.namaPasien ?? "Pasien")} (${String(it.nomorRekamMedis ?? "-")})`,
            subjudul: `${String(it.namaMenu ?? "Menu Diet")} • Versi Diet v${String(it.versiDietSaatCetak ?? 1)}`,
            statusLabel:
              it.statusDistribusi === "diserahkan"
                ? "Diserahkan"
                : it.statusDistribusi === "ditahan_keselamatan"
                  ? "Ditahan"
                  : "Siap Serah",
            statusTipe:
              it.statusDistribusi === "ditahan_keselamatan"
                ? "ditahan"
                : it.statusDistribusi === "diserahkan"
                  ? "sesuai"
                  : "menunggu",
          })),
          distribusi: {
            menunggu: Number(ov.porsiMenungguPenyerahan ?? 0),
            diproses: trolleys.length,
            selesai: Number(ov.porsiBerhasilDiserahkan ?? 0),
            ditahan: Number(ov.porsiDitahanKeselamatan ?? incidents.length),
          },
          catatan: trolleys.slice(0, 3).map((t, idx) => ({
            id: String(t.id ?? idx),
            inisial: "TR",
            warnaAvatar: "bg-blue-100 text-blue-700",
            judul: `Troli ${String(t.kodeTroli ?? "-")} • ${String(t.namaBangsal ?? t.bangsalTujuanId ?? "-")}`,
            isi: `Jadwal: ${String(t.jadwalMakan ?? "-").toUpperCase()} • Suhu Berangkat: ${String(t.suhuBerangkatCelsius ?? "-")}°C`,
            waktu: `Status: ${String(t.statusTroli ?? "-").replace(/_/g, " ")}`,
          })),
          risiko: [
            {
              id: "ds-r1",
              tingkat: "Risiko Tinggi",
              judul: "Verifikasi 2 Pengenal & Versi Diet Saat Serah (AB-020 & AB-021)",
              detail:
                "Penyerahan makanan wajib mencocokkan Nomor RM + Tanggal Lahir serta memastikan versi diet belum berubah.",
              tipe: "tinggi",
            },
            {
              id: "ds-r2",
              tingkat: "Invarian Aktif",
              judul: "Status Diserahkan ≠ Dikonsumsi (AB-023)",
              detail:
                "Penyerahan porsi hanya mencatat waktu serah ke pasien; persentase konsumsi dicatat melalui observasi asupan.",
              tipe: "sedang",
            },
          ],
          pengingat: [
            {
              id: "rem-ds1",
              teks: `${items.length} porsi pasien dalam daftar kerja distribusi bangsal`,
              labelAksi: "Verifikasi",
            },
            {
              id: "rem-ds2",
              teks: `${trolleys.length} troli pengantaran tercatat hari ini`,
              labelAksi: "Troli",
            },
          ],
        });
        return;
      }

      // Default / Kepala Instalasi Gizi
      const [resOv, resIns, resEval, resDown] = await Promise.all([
        mintaDataDashboard("/api/v1/incidents/overview", { cache: "no-store" }),
        mintaDataDashboard("/api/v1/incidents/reports", { cache: "no-store" }),
        mintaDataDashboard("/api/v1/incidents/quality-evaluations", { cache: "no-store" }),
        mintaDataDashboard("/api/v1/incidents/downtime-reconciliations", {
          cache: "no-store",
        }),
      ]);
      const jOv = resOv.ok ? await resOv.json() : null;
      const jIns = resIns.ok ? await resIns.json() : null;
      const jEval = resEval.ok ? await resEval.json() : null;
      const jDown = resDown.ok ? await resDown.json() : null;

      const ov = jOv?.data ?? {};
      const insList: Array<Record<string, unknown>> =
        jIns?.sukses && Array.isArray(jIns.data) ? jIns.data : [];
      const evalList: Array<Record<string, unknown>> =
        jEval?.sukses && Array.isArray(jEval.data) ? jEval.data : [];
      const downList: Array<Record<string, unknown>> =
        jDown?.sukses && Array.isArray(jDown.data) ? jDown.data : [];

      setDataLive({
        kpi: [
          {
            label: "Insiden Terbuka / RCA",
            nilai: Number(ov.totalInsidenAktif ?? 0),
            keterangan: "Wajib CAPA selesai sebelum ditutup (AB-029)",
          },
          {
            label: "Kepatuhan 2 Pengenal",
            nilai: evalList.length > 0 ? Number(ov.kepatuhanIdentitasBedsidePersen ?? 0) : "\u2014",
            keterangan: evalList.length > 0 ? "Persentase kepatuhan verifikasi serah (%)" : "Belum ada evaluasi mutu tercatat",
          },
          {
            label: "Evaluasi Mutu Bangsal",
            nilai: evalList.length,
            keterangan: evalList.length > 0 ? `Rata sisa makan: ${String(ov.rataRataPlateWasteBangsalPersen ?? 0)}%` : "Belum ada evaluasi mutu tercatat",
          },
          {
            label: "Rekonsiliasi Downtime",
            nilai: Number(ov.totalRekonsiliasiDowntimePending ?? 0),
            keterangan: "Pengendalian formulir darurat (AB-033)",
          },
        ],
        aktivitas: insList.slice(0, 5).map((ins, idx) => ({
          id: String(ins.id ?? idx),
          waktu: String(ins.nomorInsiden ?? `INC-${idx + 1}`),
          judul: String(ins.jenisInsiden ?? "Laporan Insiden Mutu"),
          subjudul: `Bangsal: ${String(ins.bangsalId ?? "-")} • Derajat: ${String(ins.derajatKeparahan ?? "-").toUpperCase()}`,
          statusLabel:
            ins.statusInsiden === "selesai_ditutup"
              ? "Ditutup Sah"
              : String(ins.statusInsiden ?? "Investigasi").replace(/_/g, " "),
          statusTipe:
            ins.derajatKeparahan === "kritis" || ins.derajatKeparahan === "tinggi"
              ? "ditahan"
              : ins.statusInsiden === "selesai_ditutup"
                ? "sesuai"
                : "menunggu",
        })),
        distribusi: {
          menunggu: insList.filter((item) => item.statusInsiden === "dilaporkan").length,
          diproses: insList.filter((item) => item.statusInsiden === "dalam_investigasi" || item.statusInsiden === "tindakan_koreksi").length,
          selesai: Number(ov.totalInsidenSelesaiDitutup ?? 0),
          ditahan: Number(ov.totalInsidenKritis ?? 0),
        },
        catatan: evalList.slice(0, 3).map((ev, idx) => ({
          id: String(ev.id ?? idx),
          inisial: "KI",
          warnaAvatar: "bg-indigo-100 text-indigo-700",
          judul: `Evaluasi Mutu: ${String(ev.namaBangsal ?? ev.bangsalId ?? "-")}`,
          isi: `Sisa Makanan: ${String(ev.rataRataSisaMakananPersen ?? "-")}% • Kepatuhan CCP: ${String(ev.kepatuhanCcpSuhuPersen ?? "-")}%`,
          waktu: `Periode: ${String(ev.tanggalEvaluasi ?? "-")}`,
        })),
        risiko: [
          {
            id: "ki-r1",
            tingkat: "Risiko Tinggi",
            judul: "Penyelesaian Insiden Tertutup / Closed-Loop (AB-028 & AB-029)",
            detail:
              "Insiden keselamatan tidak dapat ditutup otomatis sebelum akar masalah (RCA) dan seluruh tindakan korektif (CAPA) diverifikasi selesai.",
            tipe: "tinggi",
          },
          {
            id: "ki-r2",
            tingkat: "Perhatian Klinis",
            judul: "Rekonsiliasi Pasca-Gangguan Sistem (AB-033)",
            detail: `${downList.length} catatan rekonsiliasi formulir manual darurat diawasi terhadap duplikasi.`,
            tipe: "sedang",
          },
        ],
        pengingat: [
          {
            id: "rem-ki1",
            teks: `${Number(ov.totalInsidenAktif ?? 0)} insiden aktif membutuhkan investigasi RCA / verifikasi CAPA`,
            labelAksi: "Investigasi",
          },
          {
            id: "rem-ki2",
            teks: `${evalList.length} laporan evaluasi mutu & plate waste bangsal tercatat`,
            labelAksi: "Evaluasi",
          },
          {
            id: "rem-ki3",
            teks: `${downList.length} pengajuan rekonsiliasi pasca-downtime tercatat`,
            labelAksi: "Rekonsiliasi",
          },
        ],
      });
    } catch {
      setGalatLive(true);
    } finally {
      setSedangMemuatLive(false);
    }
  }, [profil]);

  useEffect(() => {
    if (!profil) return;
    const timer = window.setTimeout(() => void muatDataOperasionalPeran(), 0);
    return () => window.clearTimeout(timer);
  }, [profil, muatDataOperasionalPeran]);

  const selKalender = useMemo(() => {
    const hariPertama = new Date(
      tahunKalender,
      indeksBulanKalender,
      1,
    ).getDay();
    const jumlahHariBulanIni = new Date(
      tahunKalender,
      indeksBulanKalender + 1,
      0,
    ).getDate();
    const jumlahHariBulanLalu = new Date(
      tahunKalender,
      indeksBulanKalender,
      0,
    ).getDate();

    const daftar: Array<{
      tanggal: number;
      bulanSaatIni: boolean;
    }> = [];

    for (let i = hariPertama - 1; i >= 0; i -= 1) {
      daftar.push({
        tanggal: jumlahHariBulanLalu - i,
        bulanSaatIni: false,
      });
    }
    for (let d = 1; d <= jumlahHariBulanIni; d += 1) {
      daftar.push({
        tanggal: d,
        bulanSaatIni: true,
      });
    }
    while (daftar.length < 35) {
      daftar.push({
        tanggal: daftar.length - (hariPertama + jumlahHariBulanIni) + 1,
        bulanSaatIni: false,
      });
    }
    return daftar.slice(0, 35);
  }, [indeksBulanKalender, tahunKalender]);

  if (sedangMemuatSesi) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f7fe] p-4">
        <LoadingState
          judul="Memuat Dashboard Operasional HPNMS"
          deskripsi="Memeriksa profil sesi, penugasan bangsal, dan memuat data aktual peran Anda."
        />
      </div>
    );
  }

  if (!profil) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f7fe] p-4">
        <div className="max-w-md w-full bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <PermissionDeniedState
            pesan="Sesi Anda belum terotentikasi."
            detailKonteks="Masuk untuk membuka dashboard dan modul operasional sesuai peran Anda."
          />
          <Link
            href="/login"
            className="inline-flex items-center justify-center w-full h-10 text-sm font-semibold bg-[#1a6bff] hover:bg-blue-700 text-white rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a6bff]"
          >
            Masuk ke HPNMS
          </Link>
        </div>
      </div>
    );
  }

  const namaDepan =
    profil.namaLengkap.trim().split(/\s+/)[0] || profil.namaLengkap;
  const labelPeranAktif = profil.labelPeran;
  const ruteUtama = ambilRuteUtamaPeran(profil.peran);

  const ruteDiizinkan = new Set<string>([
    "/portal",
    ruteUtama,
  ]);
  for (const item of navigasi) {
    if (item.statusTahap !== "menunggu_tahap_peran") {
      ruteDiizinkan.add(item.href);
    }
  }

  const labelBangsal =
    profil.daftarBangsalId.length > 0
      ? profil.daftarBangsalId.join(", ")
      : "Seluruh Unit Terkait";

  const jamWib = waktuSekarang.getHours();
  const sapaanDinamis = ambilSapaanWaktu(jamWib);
  const jamSekarangTeks = `${waktuSekarang.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  })} WIB`;
  const tanggalSekarangTeks = waktuSekarang.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });

  function navigasiAtauTahan(
    id: string,
    label: string,
    href: string,
    tahapTarget: number,
  ) {
    if (ruteDiizinkan.has(href)) {
      window.location.assign(href);
      return;
    }
    setMenuTerkunciTerpilih({
      id,
      label,
      href,
      ikon: "ShieldCheck",
      izinWajib: "sistem:kesehatan:baca",
      statusTahap: "menunggu_tahap_peran",
      tahapTarget,
    });
  }

  function geserBulan(delta: number) {
    let bulanBaru = indeksBulanKalender + delta;
    let tahunBaru = tahunKalender;
    if (bulanBaru < 0) {
      bulanBaru = 11;
      tahunBaru -= 1;
    } else if (bulanBaru > 11) {
      bulanBaru = 0;
      tahunBaru += 1;
    }
    setIndeksBulanKalender(bulanBaru);
    setTahunKalender(tahunBaru);
  }

  function tanganiTanyaAsisten(e: React.FormEvent) {
    e.preventDefault();
    const q = inputAsisten.trim().toLowerCase();
    if (!q) return;
    if (q.includes("alergi") || q.includes("diet")) {
      setPesanKustomAsisten(JAWABAN_ASISTEN_KLINIS.diet);
    } else if (
      q.includes("npo") ||
      q.includes("puasa") ||
      q.includes("serah") ||
      q.includes("konsumsi")
    ) {
      setPesanKustomAsisten(JAWABAN_ASISTEN_KLINIS.interaksi);
    } else {
      setPesanKustomAsisten(
        `Panduan BRD v4.0 untuk "${inputAsisten.trim()}": Seluruh mutasi pada modul ${labelPeranAktif} divalidasi secara sinkron terhadap identitas pasien, versi diet aktif, dan hak akses bangsal.`,
      );
    }
    setInputAsisten("");
  }

  // Perhitungan Donut Chart Dinamis dari Data Aktual
  const dist = dataLive?.distribusi ?? {
    menunggu: 0,
    diproses: 0,
    selesai: 0,
    ditahan: 0,
  };
  const totalDistribusi = Math.max(
    1,
    dist.menunggu + dist.diproses + dist.selesai + dist.ditahan,
  );
  const kelilingLingkaran = 289;
  const porsiMenunggu = Math.round(
    (dist.menunggu / totalDistribusi) * kelilingLingkaran,
  );
  const porsiDiproses = Math.round(
    (dist.diproses / totalDistribusi) * kelilingLingkaran,
  );
  const porsiSelesai = Math.round(
    (dist.selesai / totalDistribusi) * kelilingLingkaran,
  );
  const porsiDitahan = Math.round((dist.ditahan / totalDistribusi) * kelilingLingkaran);

  const persenMenunggu = Math.round((dist.menunggu / totalDistribusi) * 100);
  const persenDiproses = Math.round((dist.diproses / totalDistribusi) * 100);
  const persenSelesai = Math.round((dist.selesai / totalDistribusi) * 100);
  const persenDitahan = Math.round((dist.ditahan / totalDistribusi) * 100);

  const tautanCepat = navigasi.filter((item) =>
    item.statusTahap !== "menunggu_tahap_peran" && item.href !== "/",
  );

  // Siklus jadwal pelayanan makan resmi rumah sakit sesuai BRD Bab VI & IX
  const siklusPelayananMakan = [
    {
      waktu: "06:30 WIB",
      kode: "MP",
      warnaAvatar: "bg-blue-100 text-blue-700",
      judul: "Siklus Makan Pagi",
      keterangan: "Verifikasi CCP dapur, distribusi troli & serah 2 pengenal",
    },
    {
      waktu: "12:00 WIB",
      kode: "MS",
      warnaAvatar: "bg-emerald-100 text-emerald-700",
      judul: "Siklus Makan Siang",
      keterangan: "Pemantauan perubahan diet mendesak & observasi Comstock",
    },
    {
      waktu: "17:30 WIB",
      kode: "MM",
      warnaAvatar: "bg-indigo-100 text-indigo-700",
      judul: "Siklus Makan Malam",
      keterangan: "Penutupan rekapitulasi H-1 hari berikutnya & evaluasi asupan",
    },
  ];

  const kpiCards = dataLive?.kpi ?? [
    {
      label: "Modul Aktif Peran",
      nilai: navigasi.length,
      keterangan: `Otorisasi: ${profil.labelPeran}`,
    },
    {
      label: "Cakupan Bangsal",
      nilai: Math.max(1, profil.daftarBangsalId.length),
      keterangan: labelBangsal,
    },
    {
      label: "Izin Granular Aktif",
      nilai: profil.daftarIzin.length,
      keterangan: "Diverifikasi di setiap endpoint",
    },
    {
      label: "Total Notifikasi Akun",
      nilai: notifikasiItems.length,
      keterangan: "Tersimpan per pengguna",
    },
  ];

  return (
    <AppShellTemplate
      judulDiKonten
      judulHalaman="Dashboard"
      subjudulHalaman="Ringkasan ruang kerja dan modul sesuai hak akses Anda."
      profil={profil}
      navigasi={navigasi}
      notifikasiItems={notifikasiItems}
      jumlahBelumDibaca={jumlahBelumDibaca}
      sedangMemuatNotifikasi={sedangMemuatNotifikasi}
      onTandaiSatuNotifikasiDibaca={tandaiSatuNotifikasiDibaca}
      onTandaiSemuaNotifikasiDibaca={tandaiSemuaNotifikasiDibaca}
      onPilihMenuTerkunci={setMenuTerkunciTerpilih}
      onKeluarSesi={() => setDialogKeluarTerbuka(true)}
    >
      {galatLive ? <ErrorState pesanAman="Data operasional belum berhasil dimuat. Periksa layanan lokal dan coba lagi." onCobaLagi={() => void muatDataOperasionalPeran()} /> : null}
      <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
        {/* ================================================================ */}
        {/* KOLOM TENGAH UTAMA                                               */}
        {/* ================================================================ */}
        <div className="min-w-0 space-y-5">
          {/* 1. HERO BANNER SAPAAN & PANEL KEPATUHAN BRD v4.0 */}
          <section
            aria-label="Ringkasan sapaan dan ruang kerja peran"
            className="relative overflow-hidden rounded-2xl border border-blue-100/90 bg-gradient-to-r from-[#eaf2ff] via-[#f1f7ff] to-[#e4efff] p-5 sm:p-6 shadow-[0_2px_14px_-4px_rgba(26,107,255,0.08)]"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-12 -bottom-16 size-56 rounded-full bg-blue-200/25 blur-2xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-1/3 -top-12 size-48 rounded-full bg-sky-200/30 blur-xl"
            />

            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
              {/* Kiri: Sapaan, Waktu Nyata WIB, dan Lokasi Penugasan */}
              <div className="lg:col-span-5 space-y-2.5">
                <p className="text-lg font-medium text-slate-700 sm:text-xl">
                  {sapaanDinamis}
                </p>
                <h1 className="flex flex-wrap items-center gap-2 text-2xl font-extrabold tracking-tight text-[#1a6bff] sm:text-3xl">
                  <span>{profil.namaLengkap}!</span>
                  <span
                    aria-hidden="true"
                    className="inline-flex size-8 items-center justify-center rounded-full bg-blue-100/80 text-lg"
                  >
                    👋
                  </span>
                </h1>
                <p className="max-w-md text-xs leading-relaxed text-slate-600 sm:text-[13px]">
                  Ringkasan data aktual pelayanan gizi & klinis untuk peran{" "}
                  <strong className="text-slate-800">{profil.labelPeran}</strong>.
                  Tetap waspada, utamakan keselamatan pasien.
                </p>

                <div className="pt-3 flex flex-wrap items-center gap-4 sm:gap-6">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/90 text-[#1a6bff] shadow-2xs">
                      <Clock aria-hidden="true" className="size-4" />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-slate-900">
                        {jamSekarangTeks}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {tanggalSekarangTeks}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/90 text-[#1a6bff] shadow-2xs">
                      <MapPin aria-hidden="true" className="size-4" />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-slate-900">
                        {profil.labelPeran}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Instalasi Gizi RS • {labelBangsal}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tengah: Ilustrasi Tenaga Kesehatan (SVG Vektor) */}
              <div
                aria-hidden="true"
                className="hidden lg:flex lg:col-span-3 justify-center items-end self-end -mb-6"
              >
                <svg
                  viewBox="0 0 220 210"
                  className="h-48 w-auto drop-shadow-sm"
                >
                  <circle
                    cx="110"
                    cy="110"
                    r="78"
                    fill="#dbeafe"
                    opacity="0.65"
                  />
                  <rect
                    x="22"
                    y="52"
                    width="46"
                    height="34"
                    rx="6"
                    fill="#ffffff"
                    opacity="0.85"
                  />
                  <path
                    d="M30 72 L38 64 L46 70 L58 58"
                    stroke="#1a6bff"
                    strokeWidth="2.5"
                    fill="none"
                    strokeLinecap="round"
                  />
                  <path
                    d="M52 210 C54 152 76 132 110 132 C144 132 166 152 168 210 Z"
                    fill="#ffffff"
                  />
                  <path d="M92 132 L110 178 L128 132 Z" fill="#bfdbfe" />
                  <path
                    d="M106 142 L114 142 L116 182 L110 190 L104 182 Z"
                    fill="#1a6bff"
                  />
                  <path d="M84 134 L98 175 L76 168 Z" fill="#f1f5f9" />
                  <path d="M136 134 L122 175 L144 168 Z" fill="#f1f5f9" />
                  <path
                    d="M84 138 C76 156 80 176 94 180"
                    stroke="#334155"
                    strokeWidth="4"
                    fill="none"
                    strokeLinecap="round"
                  />
                  <path
                    d="M136 138 C144 156 140 176 128 178"
                    stroke="#334155"
                    strokeWidth="4"
                    fill="none"
                    strokeLinecap="round"
                  />
                  <circle
                    cx="126"
                    cy="179"
                    r="6"
                    fill="#1a6bff"
                    stroke="#334155"
                    strokeWidth="2.5"
                  />
                  <rect
                    x="99"
                    y="110"
                    width="22"
                    height="26"
                    rx="8"
                    fill="#f6c39d"
                  />
                  <ellipse cx="110" cy="84" rx="28" ry="32" fill="#fbd1b0" />
                  <path
                    d="M80 78 C78 50 96 42 116 44 C134 45 142 58 139 78 C134 64 124 58 106 60 C92 61 85 68 80 78 Z"
                    fill="#0f172a"
                  />
                  <rect
                    x="91"
                    y="76"
                    width="15"
                    height="11"
                    rx="3"
                    fill="none"
                    stroke="#334155"
                    strokeWidth="2"
                  />
                  <rect
                    x="114"
                    y="76"
                    width="15"
                    height="11"
                    rx="3"
                    fill="none"
                    stroke="#334155"
                    strokeWidth="2"
                  />
                  <line
                    x1="106"
                    y1="81"
                    x2="114"
                    y2="81"
                    stroke="#334155"
                    strokeWidth="2"
                  />
                  <path
                    d="M102 98 Q110 105 118 98"
                    stroke="#b45309"
                    strokeWidth="2.2"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              {/* Kanan: Kartu Konsol Kepatuhan Klinis & Gizi (BRD v4.0 Final) */}
              <div className="lg:col-span-4">
                <div className="rounded-2xl border border-white/90 bg-white/85 p-4 shadow-sm backdrop-blur-md">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex size-6 items-center justify-center rounded-full bg-slate-900 text-white">
                        <Sparkles className="size-3.5 text-sky-400" />
                      </span>
                      <span className="text-xs font-bold text-slate-900">
                        Kepatuhan Klinis & Gizi
                      </span>
                    </div>
                    <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                      BRD v4.0 FINAL
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-600">
                    Validasi sinkron untuk instruksi diet sah, alergi, ketertelusuran
                    lot FEFO, dan verifikasi penyerahan 2 pengenal.
                  </p>

                  <div className="relative mt-3 overflow-hidden rounded-xl border border-blue-100/80 bg-gradient-to-br from-[#f5f9ff] to-[#e8f1ff] p-3.5">
                    <div className="pr-14">
                      <p className="text-xs font-bold text-slate-900">
                        Ruang Kerja {profil.labelPeran}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-snug text-slate-600">
                        Kelola transaksi operasional dan pemeriksaan keselamatan
                        unit Anda.
                      </p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <Link
                          href={ruteUtama}
                          className="inline-flex h-8 items-center justify-center rounded-lg bg-[#1a6bff] px-3.5 text-[11px] font-semibold text-white shadow-sm shadow-blue-500/25 transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a6bff]"
                        >
                          Buka Modul Utama
                        </Link>
                        <button
                          type="button"
                          onClick={() => void muatDataOperasionalPeran()}
                          disabled={sedangMemuatLive}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-blue-200 bg-white px-2.5 text-[11px] font-semibold text-[#1a6bff] transition hover:bg-blue-50"
                        >
                          <RefreshCw
                            className={`size-3 ${sedangMemuatLive ? "animate-spin" : ""}`}
                          />
                          <span>Segarkan</span>
                        </button>
                      </div>
                    </div>

                    <div
                      aria-hidden="true"
                      className="absolute right-2.5 bottom-2 flex size-12 items-center justify-center rounded-2xl bg-white/90 text-[#1a6bff] shadow-xs border border-blue-100"
                    >
                      <Bot className="size-7" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 2. BARIS 5 KARTU METRIK KPI AKTUAL DARI DATABASE */}
          <section
            aria-label="Indikator kinerja operasional aktual"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5"
          >
            {/* Kartu KPI 1 */}
            <div className="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-3px_rgba(15,23,42,0.04)]">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#1a6bff]">
                  <Users className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11.5px] font-medium text-slate-500">
                    {kpiCards[0].label}
                  </p>
                  <p className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
                    {kpiCards[0].nilai}
                  </p>
                </div>
              </div>
              <p className="mt-3 truncate text-[11px] font-medium text-emerald-700">
                ✓ {kpiCards[0].keterangan}
              </p>
            </div>

            {/* Kartu KPI 2 */}
            <div className="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-3px_rgba(15,23,42,0.04)]">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <FileSpreadsheet className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11.5px] font-medium text-slate-500">
                    {kpiCards[1].label}
                  </p>
                  <p className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
                    {kpiCards[1].nilai}
                  </p>
                </div>
              </div>
              <p className="mt-3 truncate text-[11px] font-medium text-emerald-700">
                ✓ {kpiCards[1].keterangan}
              </p>
            </div>

            {/* Kartu KPI 3 */}
            <div className="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-3px_rgba(15,23,42,0.04)]">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                  <FlaskConical className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11.5px] font-medium text-slate-500">
                    {kpiCards[2].label}
                  </p>
                  <p className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
                    {kpiCards[2].nilai}
                  </p>
                </div>
              </div>
              <p className="mt-3 truncate text-[11px] font-medium text-emerald-700">
                ✓ {kpiCards[2].keterangan}
              </p>
            </div>

            {/* Kartu KPI 4 */}
            <div className="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-3px_rgba(15,23,42,0.04)]">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <CalendarCheck className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11.5px] font-medium text-slate-500">
                    {kpiCards[3].label}
                  </p>
                  <p className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
                    {kpiCards[3].nilai}
                  </p>
                </div>
              </div>
              <p className="mt-3 truncate text-[11px] font-medium text-emerald-700">
                ✓ {kpiCards[3].keterangan}
              </p>
            </div>

            {/* Kartu KPI 5: Notifikasi & Peringatan */}
            <div className="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-3px_rgba(15,23,42,0.04)]">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                  <AlertTriangle className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11.5px] font-medium text-slate-500">
                    Notifikasi Belum Dibaca
                  </p>
                  <p className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
                    {jumlahBelumDibaca}
                  </p>
                </div>
              </div>
              <a
                href="#panel-notifikasi"
                className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[#1a6bff] hover:underline"
              >
                <span>Lihat panel notifikasi</span>
                <ArrowRight className="size-3" />
              </a>
            </div>
          </section>

          {/* 3. BARIS TENGAH 3 KOLOM: Antrean Aktual, Tautan Cepat BRD, & Distribusi Status */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            {/* Kolom 1: Daftar Aktivitas & Antrean Aktual Peran */}
            <section
              aria-labelledby="judul-antrean-hari-ini"
              className="xl:col-span-4 flex flex-col justify-between rounded-2xl border border-slate-200/75 bg-white p-5 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)]"
            >
              <div>
                <div className="flex items-center justify-between gap-2 pb-4">
                  <h2
                    id="judul-antrean-hari-ini"
                    className="text-sm font-bold text-slate-900"
                  >
                    Antrean & Data Aktual Peran
                  </h2>
                  <Link
                    href={ruteUtama}
                    className="text-xs font-semibold text-[#1a6bff] hover:underline"
                  >
                    Kelola semua
                  </Link>
                </div>

                {sedangMemuatLive ? (
                  <p className="py-6 text-xs text-slate-500">
                    Memuat data operasional dari server...
                  </p>
                ) : !dataLive || dataLive.aktivitas.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-xs text-slate-500">
                    Belum ada antrean aktif pada filter saat ini. Buka ruang
                    kerja {profil.labelPeran} untuk menambahkan atau memproses
                    data baru.
                  </div>
                ) : (
                  <ul className="space-y-3.5">
                    {dataLive.aktivitas.map((item) => {
                      const warnaBar =
                        item.statusTipe === "ditahan"
                          ? "bg-rose-500"
                          : item.statusTipe === "menunggu"
                            ? "bg-amber-400"
                            : "bg-emerald-500";
                      const kelasBadge =
                        item.statusTipe === "ditahan"
                          ? "bg-rose-50 text-rose-700"
                          : item.statusTipe === "menunggu"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-emerald-50 text-emerald-700";
                      return (
                        <li
                          key={item.id}
                          className="flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-16 shrink-0 truncate text-[11px] font-semibold text-slate-700">
                              {item.waktu}
                            </span>
                            <span
                              aria-hidden="true"
                              className={`h-8 w-1 shrink-0 rounded-full ${warnaBar}`}
                            />
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-slate-900">
                                {item.judul}
                              </p>
                              <p className="truncate text-[11px] text-slate-500">
                                {item.subjudul}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`shrink-0 rounded-md px-2.5 py-1 text-[10.5px] font-semibold ${kelasBadge}`}
                          >
                            {item.statusLabel}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <Link
                href={ruteUtama}
                className="mt-5 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200/90 bg-slate-50/60 text-xs font-semibold text-[#1a6bff] transition hover:bg-blue-50/60"
              >
                <span>Buka Ruang Kerja {profil.labelPeran}</span>
                <CalendarIcon className="size-3.5" />
              </Link>
            </section>

            {/* Kolom 2: Tautan Cepat Modul BRD */}
            <section
              aria-labelledby="judul-tautan-cepat"
              className="xl:col-span-4 flex flex-col justify-between rounded-2xl border border-slate-200/75 bg-white p-5 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)]"
            >
              <div>
                <div className="flex items-center justify-between gap-2 pb-4">
                  <h2
                    id="judul-tautan-cepat"
                    className="text-sm font-bold text-slate-900"
                  >
                    Ruang kerja Anda
                  </h2>
                  <span className="text-[11px] font-medium text-emerald-700">
                    Otorisasi Aktif
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  {tautanCepat.map((item) => {
                    const terbuka = ruteDiizinkan.has(item.href);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() =>
                          navigasiAtauTahan(
                            item.id,
                            item.label,
                            item.href,
                            item.tahapTarget,
                          )
                        }
                        className="group flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-100 bg-[#f8fafc] p-3 text-center transition hover:border-blue-200 hover:bg-blue-50/40 focus-visible:outline-2 focus-visible:outline-[#1a6bff]"
                      >
                        <span
                          className={`flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 shadow-2xs transition group-hover:scale-105`}
                        >
                          <SemanticIcon nama={item.ikon} className="size-5" />
                        </span>
                        <span className="text-[11px] font-semibold leading-tight text-slate-800">
                          {item.label}
                        </span>
                        <span
                          className={`text-[9.5px] font-medium ${
                            terbuka ? "text-emerald-600" : "text-slate-400"
                          }`}
                        >
                          {terbuka ? "Akses Aktif" : "Wewenang Peran"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Link
                href={ruteUtama}
                className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-indigo-100/90 bg-gradient-to-r from-indigo-50/70 via-blue-50/60 to-sky-50/70 px-3.5 py-3 transition hover:border-indigo-200"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-2xs">
                    <Stethoscope className="size-4.5" />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-slate-900">
                      Buka tugas utama Anda
                    </p>
                    <p className="text-[10.5px] text-slate-500">
                      Masuk ke konsol operasional {profil.labelPeran}
                    </p>
                  </div>
                </div>
                <ChevronRight className="size-4 text-slate-400" />
              </Link>
            </section>

            {/* Kolom 3: Distribusi Status Layanan (Donut Chart Dinamis) */}
            <section
              aria-labelledby="judul-status-antrean"
              className="xl:col-span-4 flex flex-col justify-between rounded-2xl border border-slate-200/75 bg-white p-5 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)]"
            >
              <div>
                <div className="flex items-center justify-between gap-2 pb-4">
                  <h2
                    id="judul-status-antrean"
                    className="text-sm font-bold text-slate-900"
                  >
                    Distribusi Status Operasional
                  </h2>
                  <Link
                    href={ruteUtama}
                    className="text-xs font-semibold text-[#1a6bff] hover:underline"
                  >
                    Rincian
                  </Link>
                </div>

                <div className="my-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                  {/* Donut Chart SVG Dinamis */}
                  <div className="relative flex size-36 shrink-0 items-center justify-center">
                    <svg
                      viewBox="0 0 120 120"
                      className="size-full -rotate-90"
                      aria-hidden="true"
                    >
                      <circle
                        cx="60"
                        cy="60"
                        r="46"
                        fill="none"
                        stroke="#f1f5f9"
                        strokeWidth="15"
                      />
                      <circle
                        cx="60"
                        cy="60"
                        r="46"
                        fill="none"
                        stroke="#1a6bff"
                        strokeWidth="15"
                        strokeDasharray={`${porsiMenunggu} ${kelilingLingkaran}`}
                        strokeDashoffset="0"
                      />
                      <circle
                        cx="60"
                        cy="60"
                        r="46"
                        fill="none"
                        stroke="#06b6d4"
                        strokeWidth="15"
                        strokeDasharray={`${porsiDiproses} ${kelilingLingkaran}`}
                        strokeDashoffset={`-${porsiMenunggu}`}
                      />
                      <circle
                        cx="60"
                        cy="60"
                        r="46"
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="15"
                        strokeDasharray={`${porsiSelesai} ${kelilingLingkaran}`}
                        strokeDashoffset={`-${porsiMenunggu + porsiDiproses}`}
                      />
                      <circle
                        cx="60"
                        cy="60"
                        r="46"
                        fill="none"
                        stroke="#fb923c"
                        strokeWidth="15"
                        strokeDasharray={`${porsiDitahan} ${kelilingLingkaran}`}
                        strokeDashoffset={`-${porsiMenunggu + porsiDiproses + porsiSelesai}`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-[11px] font-medium text-slate-400">
                        Total Item
                      </span>
                      <span className="text-xl font-extrabold text-slate-900">
                        {dist.menunggu +
                          dist.diproses +
                          dist.selesai +
                          dist.ditahan}
                      </span>
                    </div>
                  </div>

                  {/* Legenda Status */}
                  <ul className="w-full space-y-2.5 text-xs">
                    <li className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-slate-600">
                        <span className="size-2.5 rounded-full bg-[#1a6bff]" />
                        <span>Menunggu / Antrean</span>
                      </span>
                      <span className="font-bold text-slate-900">
                        {dist.menunggu}{" "}
                        <span className="font-normal text-slate-400">
                          ({persenMenunggu}%)
                        </span>
                      </span>
                    </li>
                    <li className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-slate-600">
                        <span className="size-2.5 rounded-full bg-cyan-500" />
                        <span>Aktif / Diproses</span>
                      </span>
                      <span className="font-bold text-slate-900">
                        {dist.diproses}{" "}
                        <span className="font-normal text-slate-400">
                          ({persenDiproses}%)
                        </span>
                      </span>
                    </li>
                    <li className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-slate-600">
                        <span className="size-2.5 rounded-full bg-emerald-500" />
                        <span>Selesai / Sesuai</span>
                      </span>
                      <span className="font-bold text-slate-900">
                        {dist.selesai}{" "}
                        <span className="font-normal text-slate-400">
                          ({persenSelesai}%)
                        </span>
                      </span>
                    </li>
                    <li className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-slate-600">
                        <span className="size-2.5 rounded-full bg-orange-400" />
                        <span>Ditahan / Perhatian</span>
                      </span>
                      <span className="font-bold text-slate-900">
                        {dist.ditahan}{" "}
                        <span className="font-normal text-slate-400">
                          ({persenDitahan}%)
                        </span>
                      </span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3.5">
                <div>
                  <p className="text-[11px] text-slate-400">
                    Kapasitas Desain BRD
                  </p>
                  <p className="mt-0.5 text-sm font-extrabold text-slate-900">
                    100–500 Pasien
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400">
                    Kebijakan Keamanan
                  </p>
                  <p className="mt-0.5 text-sm font-extrabold text-emerald-700">
                    Fail-Closed Aktif
                  </p>
                </div>
              </div>
            </section>
          </div>

          {/* 4. BARIS BAWAH 4 KOLOM: Siklus Makan RS, Catatan Terbaru, Peringatan Risiko, & Tugas */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Kartu Bawah 1: Siklus Pelayanan Makan RS (BRD Bab VI & IX) */}
            <section
              aria-labelledby="judul-siklus-makan"
              className="rounded-2xl border border-slate-200/75 bg-white p-5 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)]"
            >
              <div className="flex items-center justify-between gap-2 pb-4">
                <h2
                  id="judul-siklus-makan"
                  className="text-sm font-bold text-slate-900"
                >
                  Siklus Pelayanan Gizi
                </h2>
                <Link
                  href={ruteUtama}
                  className="text-xs font-semibold text-[#1a6bff] hover:underline"
                >
                  Buka
                </Link>
              </div>

              <ul className="space-y-4">
                {siklusPelayananMakan.map((item) => (
                  <li key={item.kode} className="flex items-center gap-3">
                    <span className="w-16 shrink-0 text-xs font-bold text-slate-800">
                      {item.waktu}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${item.warnaAvatar}`}
                    >
                      {item.kode}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-900">
                        {item.judul}
                      </p>
                      <p className="line-clamp-2 text-[11px] text-slate-500">
                        {item.keterangan}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* Kartu Bawah 2: Catatan & Riwayat Operasional Terbaru (Live dari DB) */}
            <section
              aria-labelledby="judul-catatan-pasien"
              className="flex flex-col justify-between rounded-2xl border border-slate-200/75 bg-white p-5 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)]"
            >
              <div>
                <h2
                  id="judul-catatan-pasien"
                  className="pb-4 text-sm font-bold text-slate-900"
                >
                  Catatan Operasional Terbaru
                </h2>

                {dataLive && dataLive.catatan.length > 0 ? (
                  <ul className="space-y-3.5">
                    {dataLive.catatan.map((item) => (
                      <li key={item.id} className="flex items-start gap-2.5">
                        <span
                          aria-hidden="true"
                          className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${item.warnaAvatar}`}
                        >
                          {item.inisial}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-slate-900">
                            {item.judul}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-slate-600">
                            {item.isi}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-400">
                            {item.waktu}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500">
                    Catatan operasional unit {profil.labelPeran} akan tampil
                    otomatis saat transaksi baru disimpan.
                  </p>
                )}
              </div>

              <Link
                href={ruteUtama}
                className="mt-4 inline-flex items-center justify-center gap-1 text-xs font-semibold text-[#1a6bff] hover:underline"
              >
                <span>Lihat Seluruh Riwayat</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </section>

            {/* Kartu Bawah 3: Peringatan Keselamatan Pasien (Live & Invarian BRD) */}
            <section
              aria-labelledby="judul-risiko-pasien"
              className="rounded-2xl border border-slate-200/75 bg-white p-5 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)]"
            >
              <div className="flex items-center justify-between gap-2 pb-4">
                <h2
                  id="judul-risiko-pasien"
                  className="text-sm font-bold text-slate-900"
                >
                  Peringatan Keselamatan
                </h2>
                <Link
                  href={ruteUtama}
                  className="text-xs font-semibold text-[#1a6bff] hover:underline"
                >
                  Periksa
                </Link>
              </div>

              <ul className="space-y-2.5">
                {(dataLive?.risiko ?? []).map((item) => {
                  const apakahTinggi = item.tipe === "tinggi";
                  return (
                    <li
                      key={item.id}
                      className={`rounded-xl border p-3 ${
                        apakahTinggi
                          ? "border-rose-100 bg-rose-50/75"
                          : "border-amber-100 bg-amber-50/75"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span
                          className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg ${
                            apakahTinggi
                              ? "bg-rose-100 text-rose-600"
                              : "bg-amber-100 text-amber-600"
                          }`}
                        >
                          <AlertTriangle className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <p
                            className={`text-[10.5px] font-bold uppercase tracking-wide ${
                              apakahTinggi ? "text-rose-600" : "text-amber-600"
                            }`}
                          >
                            {item.tingkat}
                          </p>
                          <p className="truncate text-xs font-bold text-slate-900">
                            {item.judul}
                          </p>
                          <p className="mt-0.5 text-[11px] leading-snug text-slate-600">
                            {item.detail}
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Kartu Bawah 4: Tugas & Tindak Lanjut Peran */}
            <section
              aria-labelledby="judul-pengingat-cerdas"
              className="rounded-2xl border border-slate-200/75 bg-white p-5 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)]"
            >
              <h2
                id="judul-pengingat-cerdas"
                className="pb-4 text-sm font-bold text-slate-900"
              >
                Tugas & Tindak Lanjut
              </h2>

              <ul className="space-y-3">
                {(dataLive?.pengingat ?? []).map((item, idx) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${
                          idx % 2 === 0
                            ? "bg-blue-50 text-[#1a6bff]"
                            : "bg-emerald-50 text-emerald-600"
                        }`}
                      >
                        <FileCheck2 className="size-3.5" />
                      </span>
                      <span className="text-[11.5px] font-medium leading-snug text-slate-700">
                        {item.teks}
                      </span>
                    </div>
                    <Link
                      href={ruteUtama}
                      className="shrink-0 text-[11px] font-semibold text-[#1a6bff] hover:underline"
                    >
                      {item.labelAksi}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* 5. DAFTAR MODUL RUANG KERJA AKTIF SESUAI HAK AKSES PERAN */}
          <section
            aria-labelledby="judul-modul-peran"
            className="rounded-2xl border border-slate-200/75 bg-white p-5 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
              <div>
                <h2
                  id="judul-modul-peran"
                  className="text-sm font-bold text-slate-900"
                >
                  Modul Hak Akses Aktif — {profil.labelPeran}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Klik modul di bawah ini untuk membuka konsol kerja sesuai
                  wewenang peran dan bangsal penugasan Anda.
                </p>
              </div>
              <StatusBadge
                varian="sesuai"
                label={`${navigasi.filter((item) => item.statusTahap !== "menunggu_tahap_peran").length} Modul Terotorisasi`}
              />
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {navigasi.map((item) => {
                const terbuka = item.statusTahap !== "menunggu_tahap_peran";
                const href =
                  item.href;
                return terbuka ? (
                  <Link
                    key={item.id}
                    href={href}
                    className="flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/40 p-3.5 transition hover:border-[#1a6bff] hover:bg-blue-50/80"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#1a6bff] text-xs font-bold text-white">
                        ✓
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-slate-900">
                          {item.label}
                        </p>
                        <p className="text-[11px] text-[#1a6bff] font-medium">
                          Akses Penuh Sesuai Peran
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="size-4 shrink-0 text-[#1a6bff]" />
                  </Link>
                ) : (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setMenuTerkunciTerpilih(item)}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-left transition hover:bg-slate-100"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-xs font-bold text-slate-600">
                        RBAC
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-slate-700">
                          {item.label}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Dibatasi Kewenangan Peran
                        </p>
                      </div>
                    </div>
                    <LockKeyhole className="size-4 shrink-0 text-slate-400" />
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* ================================================================ */}
        {/* KOLOM SIDEBAR KANAN (Kalender, Jadwal, Notifikasi, Panduan BRD)  */}
        {/* ================================================================ */}
        <aside className="min-w-0 space-y-4">
          {/* 1. KALENDER OPERASIONAL & AKTIVITAS HARI INI */}
          <section
            aria-label="Kalender dan jadwal operasional hari ini"
            className="rounded-2xl border border-slate-200/75 bg-white p-5 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)]"
          >
            {/* Header Kalender */}
            <div className="flex items-center justify-between gap-2 pb-4">
              <h2 className="text-sm font-bold text-slate-900">
                {NAMA_BULAN[indeksBulanKalender]} {tahunKalender}
              </h2>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => geserBulan(-1)}
                  aria-label="Bulan sebelumnya"
                  className="inline-flex size-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => geserBulan(1)}
                  aria-label="Bulan berikutnya"
                  className="inline-flex size-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                >
                  <ChevronRight className="size-4" />
                </button>
                <span className="ml-1 flex size-8 items-center justify-center rounded-xl bg-blue-50 text-[#1a6bff]">
                  <CalendarIcon className="size-4" />
                </span>
              </div>
            </div>

            {/* Grid Hari & Tanggal */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {HARI_SINGKAT.map((hari) => (
                <div
                  key={hari}
                  className="py-1 text-[10px] font-bold tracking-wider text-slate-400"
                >
                  {hari}
                </div>
              ))}
              {selKalender.map((sel, idx) => {
                const aktif =
                  sel.bulanSaatIni && sel.tanggal === tanggalTerpilih;
                return (
                  <button
                    key={`${sel.bulanSaatIni ? "curr" : "adj"}-${sel.tanggal}-${idx}`}
                    type="button"
                    onClick={() => {
                      if (sel.bulanSaatIni) setTanggalTerpilih(sel.tanggal);
                    }}
                    className={`mx-auto flex size-8 items-center justify-center rounded-full text-xs transition ${
                      aktif
                        ? "bg-[#1a6bff] font-bold text-white shadow-sm shadow-blue-500/35"
                        : sel.bulanSaatIni
                          ? "font-semibold text-slate-700 hover:bg-slate-100"
                          : "font-normal text-slate-300"
                    }`}
                  >
                    {sel.tanggal}
                  </button>
                );
              })}
            </div>

            {/* Bagian Jadwal Hari Ini di dalam Kartu Kalender */}
            <div className="mt-5 border-t border-slate-100 pt-4">
              <h3 className="text-xs font-bold text-slate-900">
                Aktivitas Unit Hari Ini
              </h3>
              <ul className="mt-3 space-y-3">
                {(dataLive?.aktivitas ?? []).slice(0, 4).map((item) => (
                  <li
                    key={`sched-${item.id}`}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-14 shrink-0 truncate text-[11px] font-semibold text-slate-700">
                        {item.waktu.replace(" WIB", "")}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-slate-900">
                          {item.judul}
                        </p>
                        <p className="truncate text-[10.5px] text-slate-500">
                          {item.subjudul}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                        item.statusTipe === "ditahan"
                          ? "bg-rose-50 text-rose-700"
                          : item.statusTipe === "menunggu"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {item.statusLabel}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href={ruteUtama}
                className="mt-4 inline-flex w-full items-center justify-center gap-1 text-xs font-semibold text-[#1a6bff] hover:underline"
              >
                <span>Buka Konsol Lengkap</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </section>

          {/* 2. PANEL NOTIFIKASI AKUN (Terhubung ke Database) */}
          <section
            id="panel-notifikasi"
            aria-labelledby="judul-notifikasi-kanan"
            className="rounded-2xl border border-slate-200/75 bg-white p-5 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)]"
          >
            <div className="flex items-center justify-between gap-2 pb-3.5">
              <div className="flex items-center gap-2">
                <h2
                  id="judul-notifikasi-kanan"
                  className="text-sm font-bold text-slate-900"
                >
                  Notifikasi Akun
                </h2>
                {jumlahBelumDibaca > 0 ? (
                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600">
                    {jumlahBelumDibaca} baru
                  </span>
                ) : null}
              </div>
              {jumlahBelumDibaca > 0 ? (
                <button
                  type="button"
                  onClick={() => void tandaiSemuaNotifikasiDibaca()}
                  className="text-xs font-semibold text-[#1a6bff] hover:underline"
                >
                  Tandai semua
                </button>
              ) : (
                <span className="text-xs font-semibold text-[#1a6bff]">
                  Terbaru
                </span>
              )}
            </div>

            {sedangMemuatNotifikasi ? (
              <p className="py-5 text-xs text-slate-500">
                Memuat daftar notifikasi...
              </p>
            ) : notifikasiItems.length === 0 ? (
              <div className="py-6 text-center">
                <span className="mx-auto flex size-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <Check aria-hidden="true" className="size-4" />
                </span>
                <p className="mt-2.5 text-xs font-bold text-slate-800">
                  Tidak ada notifikasi belum dibaca
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Seluruh pembaruan operasional telah ditinjau.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {notifikasiItems.slice(0, 4).map((n, idx) => {
                  const warnaKotak =
                    idx % 3 === 0
                      ? "bg-blue-50 text-[#1a6bff]"
                      : idx % 3 === 1
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-rose-50 text-rose-600";
                  return (
                    <li
                      key={n.id}
                      className="flex items-start justify-between gap-2.5 rounded-xl border border-slate-100 bg-slate-50/50 p-2.5"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span
                          className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${warnaKotak}`}
                        >
                          <Bell className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold leading-snug text-slate-900">
                            {n.judul}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-600">
                            {n.ringkasan}
                          </p>
                          <time
                            dateTime={n.waktuDibuat}
                            className="mt-1 block text-[10px] text-slate-400"
                          >
                            {new Date(n.waktuDibuat).toLocaleString("id-ID", {
                              dateStyle: "medium",
                              timeStyle: "short",
                              timeZone: "Asia/Jakarta",
                            })}
                          </time>
                        </div>
                      </div>
                      {n.statusBaca === "belum_dibaca" ? (
                        <button
                          type="button"
                          onClick={() => void tandaiSatuNotifikasiDibaca(n.id)}
                          title="Tandai sudah dibaca"
                          aria-label={`Tandai notifikasi ${n.judul} sudah dibaca`}
                          className="shrink-0 rounded-lg p-1 text-[#1a6bff] hover:bg-blue-50"
                        >
                          <Check className="size-4" />
                        </button>
                      ) : (
                        <MoreVertical
                          aria-hidden="true"
                          className="size-4 shrink-0 text-slate-300"
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* 3. WIDGET PANDUAN KEPATUHAN BRD v4.0 */}
          <section
            aria-labelledby="judul-ai-assistant"
            className="rounded-2xl border border-blue-100/90 bg-white p-5 shadow-[0_2px_14px_-4px_rgba(26,107,255,0.08)]"
          >
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-full bg-blue-50 text-[#1a6bff]">
                  <Bot className="size-5" />
                </span>
                <div>
                  <h2
                    id="judul-ai-assistant"
                    className="text-xs font-bold text-slate-900"
                  >
                    Panduan Kepatuhan BRD
                  </h2>
                  <p className="flex items-center gap-1 text-[10.5px] font-medium text-emerald-600">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    <span>Aktif • Standar Keselamatan v4.0</span>
                  </p>
                </div>
              </div>
              <HeartPulse
                aria-hidden="true"
                className="size-4 text-slate-400"
              />
            </div>

            <div className="mt-3.5 flex items-start gap-2.5">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[#1a6bff]">
                <Bot className="size-4" />
              </span>
              <div className="rounded-2xl rounded-tl-xs bg-[#f4f7fe] px-3.5 py-2.5 text-xs leading-relaxed text-slate-800">
                <p className="font-semibold text-slate-900">
                  Halo {namaDepan}! 👋
                </p>
                <p className="mt-0.5 text-[11.5px] text-slate-600">
                  {pesanKustomAsisten
                    ? pesanKustomAsisten
                    : topikAsistenAktif
                      ? JAWABAN_ASISTEN_KLINIS[topikAsistenAktif]
                      : "Pilih topik aturan bisnis di bawah ini untuk memeriksa invarian keselamatan pasien:"}
                </p>
              </div>
            </div>

            <div className="mt-3.5 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setPesanKustomAsisten(null);
                  setTopikAsistenAktif("ringkas");
                }}
                className="rounded-full border border-blue-100 bg-blue-50/70 px-3 py-1.5 text-[11px] font-semibold text-[#1a6bff] transition hover:bg-blue-100/80"
              >
                Aturan Instruksi Diet
              </button>
              <button
                type="button"
                onClick={() => {
                  setPesanKustomAsisten(null);
                  setTopikAsistenAktif("diet");
                }}
                className="rounded-full border border-blue-100 bg-blue-50/70 px-3 py-1.5 text-[11px] font-semibold text-[#1a6bff] transition hover:bg-blue-100/80"
              >
                Alergi & Perubahan H-1
              </button>
              <button
                type="button"
                onClick={() => {
                  setPesanKustomAsisten(null);
                  setTopikAsistenAktif("interaksi");
                }}
                className="rounded-full border border-blue-100 bg-blue-50/70 px-3 py-1.5 text-[11px] font-semibold text-[#1a6bff] transition hover:bg-blue-100/80"
              >
                Verifikasi 2 Pengenal & NPO
              </button>
            </div>

            <form onSubmit={tanganiTanyaAsisten} className="mt-3.5 relative">
              <label htmlFor="tanya-asisten-input" className="sr-only">
                Tanyakan panduan prosedur HPNMS
              </label>
              <input
                id="tanya-asisten-input"
                type="text"
                value={inputAsisten}
                onChange={(e) => setInputAsisten(e.target.value)}
                placeholder="Cari aturan bisnis (mis. alergi, NPO)..."
                className="h-9 w-full rounded-xl border border-slate-200 bg-[#f8fafc] pl-3 pr-9 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#1a6bff] focus:bg-white focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Kirim pertanyaan"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[#1a6bff] hover:bg-blue-50"
              >
                <SendHorizontal className="size-4" />
              </button>
            </form>
          </section>

          {/* Info Tata Kelola RBAC */}
          <section className="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-2xs">
            <div className="flex items-start gap-2.5">
              <ShieldAlert
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-[#1a6bff]"
              />
              <div>
                <h2 className="text-xs font-bold text-slate-900">
                  Otorisasi & Keselamatan Pasien
                </h2>
                <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                  Sistem membantu petugas dan tidak membuat keputusan medis
                  mandiri. Akses data diperiksa per peran & bangsal penugasan.
                </p>
              </div>
            </div>
          </section>
        </aside>
      </div>

      {/* Dialog Konfirmasi Keluar Sesi */}
      <ConfirmDialog
        terbuka={dialogKeluarTerbuka}
        onPerubahanTerbuka={setDialogKeluarTerbuka}
        judul="Konfirmasi keluar sesi"
        deskripsiDampak={`Akhiri sesi untuk ${profil.namaLengkap} (${profil.labelPeran})?`}
        labelKonfirmasi="Keluar sesi"
        labelBatal="Batal"
        varianTindakan="destruktif"
        onKonfirmasi={async () => {
          await keluarSesi();
          setDialogKeluarTerbuka(false);
        }}
      />

      {/* Dialog Penjelasan Pembatasan Kewenangan Lintas Peran (AB-032) */}
      <ConfirmDialog
        terbuka={menuTerkunciTerpilih !== null}
        onPerubahanTerbuka={(buka) => {
          if (!buka) setMenuTerkunciTerpilih(null);
        }}
        judul={`Pembatasan Kewenangan Peran: ${menuTerkunciTerpilih?.label ?? ""}`}
        deskripsiDampak={`Sesuai kebijakan pemisahan kewenangan BRD Bab III (AB-032), modul "${menuTerkunciTerpilih?.label ?? ""}" hanya dapat diakses oleh petugas dengan peran yang berwenang. Akun Anda (${profil.labelPeran}) memiliki akses penuh pada modul yang telah diotorisasi untuk peran Anda.`}
        labelKonfirmasi="Mengerti"
        labelBatal="Tutup"
        onKonfirmasi={() => setMenuTerkunciTerpilih(null)}
      />
    </AppShellTemplate>
  );
}
