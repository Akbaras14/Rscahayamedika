"use client";

/**
 * @fileoverview Komponen Halaman Masuk Sesi (Login View) HPNMS.
 * Mengadopsi identitas visual MediCore AI ERP (`desaind.jpg`) dengan tetap mematuhi:
 * - Formulir kredensial terstruktur dengan validasi input ramah pengguna.
 * - Tidak menyertakan akun demo atau kredensial bersama pada UI.
 * - Pengalihan otomatis ke Dashboard MediCore HPNMS (`/portal`) atau workspace peran.
 * - Keamanan sesi dilindungi cookie HttpOnly dan pencatatan audit kegagalan login.
 */

import { ambilRuteUtamaPeran } from "../../../../packages/contracts/src/index.ts";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  Bot,
  CalendarCheck,
  Clock,
  Eye,
  EyeOff,
  HeartPulse,
  LogIn,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { StatusBadge } from "@/components/atoms/status-badge";
import { FormFieldMolecule } from "@/components/molecules/form-field";
import { ErrorState, LoadingState } from "@/components/molecules/state-feedback";
import { Button } from "@/components/ui/button";
import type {
  ProfilSesiPengguna,
  ResponsApi,
} from "../../../../packages/shared-types/src/index.ts";

export function LoginView() {
  const router = useRouter();

  const [namaPengguna, setNamaPengguna] = useState("");
  const [kataSandi, setKataSandi] = useState("");
  const [tampilkanSandi, setTampilkanSandi] = useState(false);

  const [sedangMemeriksaSesiAwal, setSedangMemeriksaSesiAwal] = useState(true);
  const [sedangProsesLogin, setSedangProsesLogin] = useState(false);
  const [galatLogin, setGalatLogin] = useState<{
    pesan: string;
    kodeLaporan?: string;
  } | null>(null);

  useEffect(() => {
    let aktif = true;
    async function periksaSesi() {
      try {
        const res = await fetch("/api/v1/auth/me", { cache: "no-store" });
        if (!aktif) return;
        if (res.ok) {
          const json = (await res.json()) as ResponsApi<{
            profil: ProfilSesiPengguna;
          }>;
          if (json.sukses && json.data?.profil) {
            router.replace(ambilRuteUtamaPeran(json.data.profil.peran));
            return;
          }
        }
      } catch {
        // Abaikan galat jika belum ada sesi
      } finally {
        if (aktif) {
          setSedangMemeriksaSesiAwal(false);
        }
      }
    }
    void periksaSesi();
    return () => {
      aktif = false;
    };
  }, [router]);

  async function lakukanLogin(u = namaPengguna, p = kataSandi) {
    setGalatLogin(null);
    if (!u.trim()) {
      setGalatLogin({ pesan: "Nama pengguna wajib diisi." });
      return;
    }
    if (!p) {
      setGalatLogin({ pesan: "Kata sandi wajib diisi." });
      return;
    }

    setSedangProsesLogin(true);
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ namaPengguna: u.trim(), kataSandi: p }),
      });

      const json = (await res.json()) as ResponsApi<{
        profil: ProfilSesiPengguna;
      }>;

      if (!json.sukses) {
        setGalatLogin({
          pesan: json.galat.pesan,
          kodeLaporan: json.galat.kodeLaporan,
        });
        return;
      }

      // Berhasil masuk, arahkan ke Dashboard Utama MediCore HPNMS (/portal)
      router.push(ambilRuteUtamaPeran(json.data.profil.peran));
    } catch {
      setGalatLogin({
        pesan: "Koneksi ke gateway terputus. Pastikan server layanan aktif.",
      });
    } finally {
      setSedangProsesLogin(false);
    }
  }

  if (sedangMemeriksaSesiAwal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f7fe] p-4">
        <LoadingState
          judul="Memeriksa Status Sesi MediCore HPNMS..."
          deskripsi="Menghubungkan ke layanan otentikasi rumah sakit..."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f7fe] flex flex-col justify-between p-4 sm:p-6 lg:p-8 text-slate-900 font-sans">
      {/* Header Institusi Bergaya MediCore AI ERP */}
      <header className="max-w-6xl mx-auto w-full flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-5 py-3.5 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-gradient-to-br from-[#1a6bff] to-[#0051e6] text-white flex items-center justify-center shadow-md shadow-blue-500/25">
            <HeartPulse className="size-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-slate-900">
                HPNMS <span className="text-[#1a6bff]">Gizi RS</span>
              </span>
              <StatusBadge varian="sesuai" label="BRD Versi 4.0 Final" />
            </div>
            <p className="text-xs text-slate-500">
              Sistem Manajemen Asupan Gizi Pasien Rumah Sakit — Portal Masuk Berbasis Peran
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Aplikasi lokal</span>
          </span>
        </div>
      </header>

      {/* Konten Utama: 2 Kolom (Formulir Masuk & Preview MediCore AI ERP) */}
      <main className="max-w-6xl mx-auto w-full my-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Kolom Kiri: Formulir Masuk Sesi */}
        <section
          aria-labelledby="judul-masuk"
          className="lg:col-span-5 bg-white border border-slate-200/80 rounded-2xl shadow-[0_4px_20px_-6px_rgba(15,23,42,0.06)] p-6 sm:p-7 flex flex-col justify-between space-y-5"
        >
          <div className="space-y-5">
            <div className="space-y-1.5 border-b border-slate-100 pb-4">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-[#1a6bff]">
                <Sparkles className="size-3.5" />
                <span>Otentikasi Sesi Rumah Sakit</span>
              </div>
              <h1
                id="judul-masuk"
                className="text-xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2 pt-1"
              >
                <LogIn className="size-5 text-[#1a6bff]" />
                Masuk ke Dashboard
              </h1>
              <p className="text-xs leading-relaxed text-slate-500">
                Gunakan nama pengguna dan kata sandi resmi sesuai peran penugasan
                klinis, gizi, atau administratif Anda.
              </p>
            </div>

            {galatLogin ? (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                <ErrorState
                  pesanAman={galatLogin.pesan}
                  kodeLaporan={galatLogin.kodeLaporan}
                />
              </div>
            ) : null}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void lakukanLogin();
              }}
              className="space-y-4"
            >
              <FormFieldMolecule
                id="namaPengguna"
                label="Nama Pengguna"
                wajib
                bantuan="Akun terdaftar pada repositori identitas HPNMS"
              >
                <input
                  id="namaPengguna"
                  type="text"
                  value={namaPengguna}
                  onChange={(e) => setNamaPengguna(e.target.value)}
                  placeholder="Nama pengguna Anda"
                  autoCapitalize="none"
                  autoCorrect="off"
                  disabled={sedangProsesLogin}
                  className="w-full h-10 px-3.5 text-xs bg-[#f8fafc] rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a6bff]/25 focus:border-[#1a6bff] transition-all"
                  required
                />
              </FormFieldMolecule>

              <FormFieldMolecule
                id="kataSandi"
                label="Kata Sandi"
                wajib
                bantuan="Minimal 8 karakter terenkripsi"
              >
                <div className="relative">
                  <input
                    id="kataSandi"
                    type={tampilkanSandi ? "text" : "password"}
                    value={kataSandi}
                    onChange={(e) => setKataSandi(e.target.value)}
                    placeholder="Masukkan kata sandi..."
                    disabled={sedangProsesLogin}
                    className="w-full h-10 px-3.5 pr-10 text-xs bg-[#f8fafc] rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a6bff]/25 focus:border-[#1a6bff] transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setTampilkanSandi(!tampilkanSandi)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 focus:outline-none"
                    aria-label={
                      tampilkanSandi
                        ? "Sembunyikan kata sandi"
                        : "Tampilkan kata sandi"
                    }
                  >
                    {tampilkanSandi ? (
                      <EyeOff className="size-4.5" />
                    ) : (
                      <Eye className="size-4.5" />
                    )}
                  </button>
                </div>
              </FormFieldMolecule>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={sedangProsesLogin}
                  className="w-full h-10 text-xs font-semibold bg-[#1a6bff] hover:bg-blue-700 text-white flex items-center justify-center gap-2 shadow-md shadow-blue-500/25 rounded-xl transition-all"
                >
                  {sedangProsesLogin ? (
                    <>
                      <span className="size-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      <span>Memverifikasi Sesi...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="size-4" />
                      <span>Masuk ke Sistem</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>

          <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-500 space-y-1.5">
            <div className="flex items-center gap-1.5 text-slate-800 font-semibold">
              <ShieldCheck className="size-4 text-[#1a6bff]" />
              <span>Perlindungan Keamanan Sesi HttpOnly Aktif</span>
            </div>
            <p className="leading-relaxed">
              Setiap sesi diterbitkan dalam bentuk token aman HttpOnly, tidak
              dapat diakses skrip pihak ketiga (XSS-safe), dan diaudit penuh.
            </p>
          </div>
        </section>

        {/* Kolom Kanan: Hero Visual MediCore AI ERP (Sesuai desaind.jpg) */}
        <section
          aria-labelledby="judul-akun-uji"
          className="lg:col-span-7 rounded-2xl border border-blue-100/90 bg-gradient-to-br from-[#eaf2ff] via-[#f3f8ff] to-[#e3eeff] p-6 sm:p-7 shadow-[0_4px_20px_-6px_rgba(26,107,255,0.08)] flex flex-col justify-between space-y-6"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-[#1a6bff] shadow-2xs">
                <Bot className="size-4" />
                <span>Sistem Manajemen Gizi & Klinis Mandiri (BRD v4.0)</span>
              </span>
              <span className="rounded-md bg-[#1a6bff] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                10 Peran Terpadu
              </span>
            </div>

            <div className="space-y-2">
              <h2
                id="judul-akun-uji"
                className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl"
              >
                Selamat bertugas di{" "}
                <span className="text-[#1a6bff]">HPNMS Instalasi Gizi!</span>
              </h2>
              <p className="text-xs sm:text-sm leading-relaxed text-slate-600 max-w-xl">
                Masuk menggunakan kredensial resmi yang ditetapkan oleh
                administrator rumah sakit untuk mengakses modul sesuai peran dan
                penugasan bangsal Anda.
              </p>
            </div>

            {/* Kartu Ringkasan KPI Preview ala desaind.jpg */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="rounded-xl border border-white/90 bg-white/90 p-3.5 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-[#1a6bff]">
                    <Users className="size-4" />
                  </span>
                  <div>
                    <p className="text-[11px] font-medium text-slate-500">
                      Alur Pasien & Diet
                    </p>
                    <p className="text-sm font-extrabold text-slate-900">
                      Pelayanan klinis
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-[10.5px] font-medium text-emerald-600">
                  ✓ Verifikasi 2 Pengenal (AB-020)
                </p>
              </div>

              <div className="rounded-xl border border-white/90 bg-white/90 p-3.5 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <Clock className="size-4" />
                  </span>
                  <div>
                    <p className="text-[11px] font-medium text-slate-500">
                      Gudang & Produksi
                    </p>
                    <p className="text-sm font-extrabold text-slate-900">
                      Persediaan & produksi
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-[10.5px] font-medium text-emerald-600">
                  ✓ Ketertelusuran Lot FEFO
                </p>
              </div>

              <div className="rounded-xl border border-white/90 bg-white/90 p-3.5 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <CalendarCheck className="size-4" />
                  </span>
                  <div>
                    <p className="text-[11px] font-medium text-slate-500">
                      Distribusi & Mutu
                    </p>
                    <p className="text-sm font-extrabold text-slate-900">
                      Penyerahan & evaluasi
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-[10.5px] font-medium text-emerald-600">
                  ✓ Audit & Rekonsiliasi Lintas Unit
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-amber-200/90 bg-amber-50/90 p-3.5 text-xs text-amber-950 flex items-start gap-2.5 shadow-2xs">
              <ShieldAlert className="size-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  Batas Kewenangan Klinis & Penugasan Bangsal (AB-032)
                </p>
                <p className="text-[11px] text-amber-900/90 mt-0.5 leading-relaxed">
                  Administrator sistem tidak memiliki akses langsung terhadap
                  keputusan klinis atau rekam gizi. Dokter, Perawat, dan Petugas
                  Distribusi hanya dapat mengakses bangsal yang ditugaskan.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/80 bg-white/75 px-4 py-2.5 text-[11px] text-slate-600">
              <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                <Activity className="size-3.5 text-[#1a6bff]" />
                <span>Prinsip Keselamatan: Fail-Closed & Tanpa Silent Fallback</span>
              </span>
              <span className="text-slate-400">Standar BRD v4.0</span>
            </div>
          </div>
        </section>
      </main>

      {/* Footer Hak Cipta */}
      <footer className="max-w-6xl mx-auto w-full pt-3 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <div>
          <span className="font-semibold text-slate-700">
            © 2026 HPNMS • Instalasi Gizi Rumah Sakit.
          </span>{" "}
          <span>BRD Versi 4.0 Final • Seluruh Hak Dilindungi.</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-slate-300">•</span>
          <span>Standar Keselamatan Rekam Medis Elektronik</span>
        </div>
      </footer>
    </div>
  );
}
