/**
 * @fileoverview Komponen Molecule untuk representasi state antarmuka standar:
 * Loading, Empty, Error (dengan kode laporan non-sensitif), Permission Denied,
 * dan Peringatan Keselamatan Permanen (tidak hilang otomatis).
 * Acuan: UI_UX.md Bagian 8, 9, 10, & 15.
 */

import { Button } from "@/components/ui/button";
import { SemanticIcon } from "@/components/atoms/semantic-icon";

export interface LoadingStateProps {
  judul?: string;
  deskripsi?: string;
}

/**
 * Menampilkan status pemuatan data yang tenang tanpa skeleton dekoratif berlebihan.
 */
export function LoadingState({
  judul = "Memuat data operasional...",
  deskripsi = "Mohon tunggu sebentar, sistem sedang memverifikasi data terbaru.",
}: LoadingStateProps) {
  return (
    <output
      aria-live="polite"
      className="flex flex-col items-start gap-2 rounded-md border border-border bg-card p-5 text-sm text-foreground"
    >
      <div className="flex items-center gap-2 font-medium text-foreground">
        <span
          aria-hidden="true"
          className="inline-block size-3.5 animate-pulse rounded-full bg-primary"
        />
        <span>{judul}</span>
      </div>
      <p className="text-xs text-muted-foreground">{deskripsi}</p>
    </output>
  );
}

export interface EmptyStateProps {
  judul: string;
  deskripsi: string;
  labelTindakan?: string;
  onTindakan?: () => void;
}

/**
 * Menampilkan kondisi kosong yang menyebut kondisi saat ini dan langkah tindak lanjut (tanpa ilustrasi 3D/AI slop).
 */
export function EmptyState({
  judul,
  deskripsi,
  labelTindakan,
  onTindakan,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-start justify-between gap-3 rounded-md border border-dashed border-border bg-card p-5 text-sm">
      <div className="space-y-1">
        <h3 className="font-semibold text-foreground">{judul}</h3>
        <p className="text-xs text-muted-foreground">{deskripsi}</p>
      </div>
      {labelTindakan && onTindakan ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onTindakan}
          className="min-h-8 rounded-md"
        >
          {labelTindakan}
        </Button>
      ) : null}
    </div>
  );
}

export interface ErrorStateProps {
  pesanAman?: string;
  kodeLaporan?: string;
  onCobaLagi?: () => void;
}

/**
 * Menampilkan galat secara aman tanpa membocorkan detail SQL/stack trace backend.
 * Menyediakan kode referensi bantuan (`ERR-...`) dan tombol `Coba lagi`.
 */
export function ErrorState({
  pesanAman = "Sistem sedang mengalami gangguan. Silakan coba lagi.",
  kodeLaporan,
  onCobaLagi,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-md border border-red-800/40 bg-red-50/90 p-4 text-sm text-red-950"
    >
      <div className="flex items-start gap-2.5">
        <SemanticIcon
          nama="TriangleAlert"
          className="mt-0.5 size-4 shrink-0 text-red-800"
        />
        <div className="space-y-1">
          <p className="font-semibold text-red-950">{pesanAman}</p>
          {kodeLaporan ? (
            <p className="font-mono text-xs text-red-900">
              Kode laporan: {kodeLaporan}
            </p>
          ) : null}
        </div>
      </div>
      {onCobaLagi ? (
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCobaLagi}
            className="min-h-8 rounded-md border-red-800/40 bg-white text-red-950 hover:bg-red-100"
          >
            Coba lagi
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export interface PermissionDeniedStateProps {
  pesan?: string;
  detailKonteks?: string;
}

/**
 * Menampilkan status penolakan akses sesuai salinan wajib UI_UX.md Bagian 9.1.
 */
export function PermissionDeniedState({
  pesan = "Anda tidak memiliki izin untuk tindakan ini.",
  detailKonteks,
}: PermissionDeniedStateProps) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-md border border-amber-800/40 bg-amber-50 p-4 text-sm text-amber-950"
    >
      <SemanticIcon
        nama="Ban"
        className="mt-0.5 size-4 shrink-0 text-amber-900"
      />
      <div className="space-y-1">
        <p className="font-semibold">{pesan}</p>
        {detailKonteks ? (
          <p className="text-xs text-amber-900">{detailKonteks}</p>
        ) : null}
      </div>
    </div>
  );
}

export interface SafetyHoldBannerProps {
  judul: string;
  alasanPenahanan: string;
  tindakLanjutWajib: string;
}

/**
 * Banner peringatan keselamatan klinis/operasional yang TIDAK hilang otomatis (UI_UX.md Bagian 8.1 & 12).
 */
export function SafetyHoldBanner({
  judul,
  alasanPenahanan,
  tindakLanjutWajib,
}: SafetyHoldBannerProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="rounded-md border-2 border-red-800 bg-red-50 p-4 text-sm text-red-950"
    >
      <div className="flex items-start gap-2.5">
        <SemanticIcon
          nama="Ban"
          className="mt-0.5 size-5 shrink-0 text-red-800"
        />
        <div className="space-y-1">
          <p className="font-bold text-red-950">{judul}</p>
          <p className="text-xs leading-relaxed text-red-900">
            {alasanPenahanan}
          </p>
          <p className="text-xs font-medium text-red-950">
            Langkah tindak lanjut: {tindakLanjutWajib}
          </p>
        </div>
      </div>
    </div>
  );
}

export interface MinimalToastBannerProps {
  jenis: "berhasil" | "kesalahan";
  pesan: string;
  onTutup?: () => void;
}

/**
 * Umpan balik toast/banner minimalis untuk tindakan non-kritis yang telah dikonfirmasi backend.
 */
export function MinimalToastBanner({
  jenis,
  pesan,
  onTutup,
}: MinimalToastBannerProps) {
  const apakahBerhasil = jenis === "berhasil";
  return (
    <output
      aria-live="polite"
      className={
        apakahBerhasil
          ? "flex items-center justify-between gap-3 rounded-md border border-emerald-700/40 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-950"
          : "flex items-center justify-between gap-3 rounded-md border border-red-800/40 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-950"
      }
    >
      <div className="flex items-center gap-2">
        <SemanticIcon
          nama={apakahBerhasil ? "CircleCheck" : "TriangleAlert"}
          className="size-4 shrink-0"
        />
        <span>{pesan}</span>
      </div>
      {onTutup ? (
        <button
          type="button"
          onClick={onTutup}
          aria-label="Tutup pemberitahuan"
          className="inline-flex min-h-6 min-w-6 items-center justify-center rounded p-1 hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <SemanticIcon nama="X" className="size-3.5" />
        </button>
      ) : null}
    </output>
  );
}

