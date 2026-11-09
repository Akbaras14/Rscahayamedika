"use client";

/**
 * @fileoverview Template Tata Letak Aplikasi (`AppShellTemplate`) untuk HPNMS.
 * Mengimplementasikan desain visual sesuai `desaind.jpg` untuk Sistem Manajemen Asupan Gizi Pasien Rumah Sakit (BRD v4.0 Final):
 * - Navigasi kiri berbasis izin peran (RBAC fail-closed sesuai AB-032)
 * - Bilah pencarian global (`⌘ K`), tombol aksi cepat (`+`), lonceng notifikasi per pengguna, dan profil sesi aktif
 * - Kartu status penugasan bangsal & tata kelola di bagian bawah sidebar
 */

import { ambilRuteUtamaPeran } from "../../../packages/contracts/src/index.ts";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
import {
  Activity,
  ChevronDown,
  HeartPulse,
  LayoutGrid,
  LogOut,
  MessageSquare,
  Plus,
  Printer,
  ShieldCheck,
} from "lucide-react";
import { SemanticIcon } from "@/components/atoms/semantic-icon";
import { StatusBadge } from "@/components/atoms/status-badge";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/features/notifikasi/components/notification-bell";
import { OperasionalPendukung } from "@/features/operasional/components/operasional-pendukung";
import type {
  ItemNavigasiPeran,
  ItemNotifikasiKontrak,
  ProfilSesiPengguna,
} from "../../../packages/shared-types/src/index.ts";

export interface AppShellTemplateProps {
  judulHalaman?: string;
  subjudulHalaman?: string;
  judulDiKonten?: boolean;
  profil: ProfilSesiPengguna | null;
  navigasi: readonly ItemNavigasiPeran[];
  notifikasiItems: readonly ItemNotifikasiKontrak[];
  jumlahBelumDibaca: number;
  sedangMemuatNotifikasi?: boolean;
  onTandaiSatuNotifikasiDibaca: (id: string) => Promise<void>;
  onTandaiSemuaNotifikasiDibaca: () => Promise<void>;
  onPilihMenuTerkunci: (item: ItemNavigasiPeran) => void;
  onKeluarSesi: () => void;
  children: ReactNode;
}


/**
 * Tata letak utama operasional rumah sakit berbasis peran dan izin aktif (BRD v4.0 Final).
 */
export function AppShellTemplate({
  judulHalaman = "Dashboard HPNMS",
  subjudulHalaman = "Ruang kerja operasional rumah sakit",
  judulDiKonten = false,
  profil,
  navigasi,
  notifikasiItems,
  jumlahBelumDibaca,
  sedangMemuatNotifikasi = false,
  onTandaiSatuNotifikasiDibaca,
  onTandaiSemuaNotifikasiDibaca,
  onKeluarSesi,
  children,
}: AppShellTemplateProps) {
  const pathname = usePathname();
  const ruteUtamaPeran = profil ? ambilRuteUtamaPeran(profil.peran) : "/portal";
  const menuPeran = navigasi.filter((item) =>
    item.statusTahap !== "menunggu_tahap_peran" &&
    (item.href !== "/" || profil?.peran === "administrator"),
  );

  const inisialProfil = profil
    ? profil.namaLengkap
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((kata) => kata[0])
        .join("")
        .toLocaleUpperCase("id-ID")
    : "RS";

  const ringkasanBangsal =
    profil && profil.daftarBangsalId.length > 0
      ? profil.daftarBangsalId.join(", ")
      : "Seluruh Unit Terkait";

  return (
    <div className="min-h-screen flex flex-col bg-[#f4f7fe] text-slate-900 lg:flex-row">
      {/* Sidebar Navigasi Kiri Sesuai Desain & BRD */}
      <aside
        aria-label="Navigasi modul berdasarkan peran"
        className="w-full shrink-0 border-b border-slate-200/80 bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[252px] lg:flex-col lg:justify-between lg:border-b-0 lg:border-r lg:border-slate-200/70"
      >
        <div className="flex flex-col min-h-0 flex-1">
          {/* Brand Logo HPNMS */}
          <div className="px-5 pt-5 pb-4">
            <Link
              href="/portal"
              className="flex items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a6bff]"
            >
              <span className="relative flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#1a6bff] to-[#0051e6] text-white shadow-md shadow-blue-500/25">
                <HeartPulse className="size-5 stroke-[2.2]" />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1 text-[16px] font-extrabold tracking-tight text-slate-900">
                  <span>HPNMS</span>
                  <span className="text-[#1a6bff]">Gizi RS</span>
                </span>
                <span className="block truncate text-[11px] font-medium text-slate-400">
                  Sistem Manajemen Gizi Pasien
                </span>
              </span>
            </Link>
          </div>

          {/* Navigasi Utama */}
          <nav
            className="flex-1 overflow-x-auto px-3 py-1 lg:overflow-x-hidden lg:overflow-y-auto"
            aria-label="Menu modul peran aktif"
          >
            {!profil ? (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                Silakan masuk terlebih dahulu untuk memuat modul sesuai hak akses
                peran Anda.
              </p>
            ) : (
              <div className="space-y-4">
                <ul className="flex w-max min-w-full gap-1 lg:w-auto lg:flex-col lg:space-y-1">
                  {/* Item Dashboard Utama */}
                  <li className="shrink-0 lg:shrink">
                    <Link
                      href="/portal"
                      aria-current={pathname === "/portal" ? "page" : undefined}
                      className={`flex min-h-[42px] w-full items-center justify-between gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-[13px] transition-all focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#1a6bff] ${
                        pathname === "/portal"
                          ? "bg-[#1a6bff] font-semibold text-white shadow-[0_6px_16px_-3px_rgba(26,107,255,0.4)]"
                          : "font-medium text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <LayoutGrid className="size-[17px] shrink-0" />
                        <span>Dashboard</span>
                      </span>
                    </Link>
                  </li>

                  {/* Modul Aktif Sesuai Hak Akses Peran (Dari Kontrak Backend) */}
                  {menuPeran.map((item) => {
                    const targetHref =
                      item.href;
                    const terbuka = item.statusTahap !== "menunggu_tahap_peran";
                    const sedangAktifRute = pathname === targetHref;

                    if (terbuka) {
                      return (
                        <li key={item.id} className="shrink-0 lg:shrink">
                          <Link
                            href={targetHref}
                            aria-current={sedangAktifRute ? "page" : undefined}
                            className={`flex min-h-[40px] w-full items-center justify-between gap-2.5 rounded-xl px-3.5 py-2 text-left text-[12.5px] transition-all focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#1a6bff] ${
                              sedangAktifRute
                                ? "bg-[#1a6bff] font-semibold text-white shadow-[0_6px_16px_-3px_rgba(26,107,255,0.4)]"
                                : "font-medium text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                            }`}
                          >
                            <span className="flex items-center gap-3 min-w-0">
                              <SemanticIcon
                                nama={item.ikon}
                                className="size-4 shrink-0"
                              />
                              <span className="truncate">{item.label}</span>
                            </span>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                sedangAktifRute
                                  ? "bg-white/20 text-white"
                                  : "bg-blue-50 text-[#1a6bff]"
                              }`}
                            >
                              Aktif
                            </span>
                          </Link>
                        </li>
                      );
                    }

                    return null;
                  })}

                  <li className="shrink-0 lg:shrink">
                    <Link href="/portal#panel-notifikasi" className="flex min-h-10 items-center gap-3 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100">
                      <MessageSquare className="size-4 shrink-0" />
                      <span>Notifikasi saya</span>
                      {jumlahBelumDibaca > 0 ? <span className="ml-auto rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">{jumlahBelumDibaca}</span> : null}
                    </Link>
                  </li>
                </ul>
              </div>
            )}
          </nav>
        </div>

        {/* Kartu Bawah Sidebar: Status Penugasan & Pintasan Operasional (Sesuai Tata Letak desaind.jpg) */}
        <div className="hidden lg:block px-3.5 pb-4 pt-2 space-y-3">
          <div className="relative overflow-hidden rounded-2xl border border-blue-100/90 bg-gradient-to-br from-[#eef4ff] via-[#f5f9ff] to-[#e2ecff] p-3.5 shadow-2xs">
            <div className="relative z-10 pr-12">
              <p className="text-xs font-bold text-slate-900">
                Instalasi Gizi Terpadu
              </p>
              <p className="mt-1 text-[10.5px] leading-relaxed text-slate-600">
                Penugasan: <strong className="text-slate-800">{ringkasanBangsal}</strong>. Akses mengikuti peran dan unit penugasan Anda.
              </p>
            </div>

            {/* Ilustrasi Perangkat Tablet Klinik (SVG) */}
            <svg
              aria-hidden="true"
              viewBox="0 0 64 88"
              className="pointer-events-none absolute -right-1 top-2 h-20 w-14 -rotate-12 drop-shadow-sm"
            >
              <rect
                x="8"
                y="4"
                width="46"
                height="78"
                rx="8"
                fill="#1e293b"
              />
              <rect
                x="11"
                y="8"
                width="40"
                height="70"
                rx="5"
                fill="#ffffff"
              />
              <rect
                x="15"
                y="14"
                width="32"
                height="12"
                rx="3"
                fill="#1a6bff"
              />
              <rect
                x="15"
                y="30"
                width="32"
                height="8"
                rx="2"
                fill="#dbeafe"
              />
              <rect
                x="15"
                y="42"
                width="24"
                height="8"
                rx="2"
                fill="#e2e8f0"
              />
              <rect
                x="15"
                y="54"
                width="28"
                height="8"
                rx="2"
                fill="#dcfce7"
              />
            </svg>

            <div className="relative z-10 mt-3 grid grid-cols-2 gap-1.5">
              <Link
                href={ruteUtamaPeran}
                className="flex items-center justify-center gap-1 rounded-lg bg-slate-950 px-2 py-1.5 text-[9.5px] font-semibold text-white transition hover:bg-slate-800"
              >
                <Activity className="size-3 text-emerald-400" />
                <span>Modul Peran</span>
              </Link>
              <Link
                href="/portal#panel-notifikasi"
                className="flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[9.5px] font-semibold text-slate-800 transition hover:bg-slate-50"
              >
                <ShieldCheck className="size-3 text-[#1a6bff]" />
                <span>Notifikasi</span>
              </Link>
            </div>
          </div>

          <div className="px-1 text-[10.5px] leading-tight text-slate-400">
            <p className="font-medium text-slate-500">
              © 2026 HPNMS • Instalasi Gizi RS
            </p>
            <p className="mt-0.5">BRD Versi 4.0 Final • RBAC Terlindungi</p>
          </div>
        </div>
      </aside>

      {/* Kolom Konten Utama & Header Atas */}
      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 bg-white/95 px-4 py-3 backdrop-blur-md sm:px-6 lg:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-blue-600" />
              Lokal
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{profil?.labelPeran ?? "HPNMS"}</p>
              <p className="truncate text-[11px] text-slate-500">{ringkasanBangsal}</p>
            </div>
          </div>

          {/* Kanan: Tombol Aksi Cepat (+), Lonceng Notifikasi, Profil Pengguna */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            {profil ? (
              <>
                <Link
                  href={ruteUtamaPeran}
                  title={`Buka modul utama (${profil.labelPeran})`}
                  aria-label={`Aksi cepat ruang kerja ${profil.labelPeran}`}
                  className="inline-flex size-9 items-center justify-center rounded-full bg-[#1a6bff] text-white shadow-sm shadow-blue-500/30 transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a6bff]"
                >
                  <Plus className="size-4 stroke-[2.5]" />
                </Link>

                <NotificationBell
                  items={notifikasiItems}
                  jumlahBelumDibaca={jumlahBelumDibaca}
                  sedangMemuat={sedangMemuatNotifikasi}
                  onTandaiSatuDibaca={onTandaiSatuNotifikasiDibaca}
                  onTandaiSemuaDibaca={onTandaiSemuaNotifikasiDibaca}
                />

                <div className="flex items-center gap-2.5 border-l border-slate-200/80 pl-3">
                  <div className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-xs font-bold text-white ring-2 ring-blue-100">
                    {inisialProfil}
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-white"
                    />
                  </div>
                  <div className="hidden min-w-0 sm:block">
                    <p className="max-w-44 truncate text-xs font-bold text-slate-900">
                      {profil.namaLengkap}
                    </p>
                    <p className="flex items-center gap-1 max-w-44 truncate text-[11px] font-medium text-slate-500">
                      <span className="truncate">{profil.labelPeran}</span>
                      <ChevronDown className="size-3 shrink-0 text-slate-400" />
                    </p>
                  </div>
                </div>

                <Button type="button" variant="outline" size="sm" onClick={() => window.print()} aria-label="Cetak laporan halaman ini" className="min-h-9 rounded-full text-xs">
                  <Printer className="mr-1.5 size-3.5" /> Cetak
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onKeluarSesi}
                  className="min-h-9 rounded-full border-slate-200/90 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200"
                >
                  <LogOut className="mr-1.5 size-3.5" />
                  <span>Keluar Sesi</span>
                </Button>
              </>
            ) : (
              <StatusBadge varian="menunggu" label="Belum Masuk Sesi" />
            )}
          </div>
        </header>

        {/* Sub-header Kontekstual untuk Halaman Modul Peran */}
        {!judulDiKonten ? (
          <div className="border-b border-slate-200/60 bg-white/70 px-4 py-3.5 sm:px-6 lg:px-7">
            <div className="mx-auto flex max-w-[1640px] flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-semibold text-[#1a6bff]">
                  <span>HPNMS • Instalasi Gizi RS</span>
                  <span aria-hidden="true" className="text-slate-300">
                    /
                  </span>
                  <span>{profil?.labelPeran ?? "Ruang Kerja"}</span>
                </div>
                <h1 className="mt-0.5 text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
                  {judulHalaman}
                </h1>
                <p className="mt-0.5 text-xs text-slate-500">
                  {subjudulHalaman}
                </p>
              </div>
              {profil ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href="/portal"
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50"
                  >
                    <LayoutGrid className="size-3.5 text-[#1a6bff]" />
                    <span>Dashboard Utama</span>
                  </Link>
                  <StatusBadge varian="netral" label={profil.labelPeran} />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <main className="mx-auto w-full max-w-[1640px] flex-1 space-y-5 p-4 sm:p-5 lg:p-6">
          {children}
          {profil && pathname !== "/portal" ? <OperasionalPendukung profil={profil} /> : null}
        </main>
      </div>
    </div>
  );
}
