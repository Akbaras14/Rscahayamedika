"use client";

/**
 * @fileoverview Komponen Organism `DataTableFoundation` untuk tabel operasional rumah sakit.
 * Menyediakan pencarian, filter, jumlah hasil, header tabel yang jelas, loading state,
 * empty state, dan paginasi sesuai UI_UX.md Bagian 10.
 */

import type * as React from "react";
import { SemanticIcon } from "@/components/atoms/semantic-icon";
import { EmptyState, LoadingState } from "@/components/molecules/state-feedback";
import { Button } from "@/components/ui/button";

export interface DefinisiKolomTabel<TRow> {
  id: string;
  header: string;
  renderSel: (baris: TRow) => React.ReactNode;
  lebarKelas?: string;
}

export interface DataTableFoundationProps<TRow> {
  judulTabel: string;
  deskripsiTabel?: string;
  kolom: readonly DefinisiKolomTabel<TRow>[];
  data: readonly TRow[];
  ambilKunciBaris: (baris: TRow) => string;
  kataKunciCari: string;
  onUbahKataKunciCari: (nilai: string) => void;
  placeholderCari?: string;
  slotFilterTambahan?: React.ReactNode;
  sedangMemuat?: boolean;
  judulKosong?: string;
  deskripsiKosong?: string;
  halamanSaatIni: number;
  totalHalaman: number;
  totalData: number;
  onUbahHalaman: (halamanBaru: number) => void;
}

/**
 * Komponen tabel data fondasi yang dirancang untuk efisiensi operasional dan aksesibilitas keyboard.
 */
export function DataTableFoundation<TRow>({
  judulTabel,
  deskripsiTabel,
  kolom,
  data,
  ambilKunciBaris,
  kataKunciCari,
  onUbahKataKunciCari,
  placeholderCari = "Cari berdasarkan kode atau nama...",
  slotFilterTambahan,
  sedangMemuat = false,
  judulKosong = "Tidak ada data yang cocok dengan filter saat ini",
  deskripsiKosong = "Ubah kata kunci pencarian atau atur ulang penyaringan untuk melihat daftar data.",
  halamanSaatIni,
  totalHalaman,
  totalData,
  onUbahHalaman,
}: DataTableFoundationProps<TRow>) {
  return (
    <section
      aria-label={judulTabel}
      className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)]"
    >
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-bold tracking-tight text-slate-900">{judulTabel}</h2>
          {deskripsiTabel ? (
            <p className="mt-0.5 text-xs text-slate-500">{deskripsiTabel}</p>
          ) : null}
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100/80 px-3 py-1 text-xs font-medium text-slate-600">
          Menampilkan <span className="font-bold text-slate-900">{data.length}</span> dari{" "}
          <span className="font-bold text-slate-900">{totalData}</span> entri
        </div>
      </div>

      <div className="flex flex-col gap-2.5 border-b border-slate-100 bg-slate-50/50 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <label htmlFor={`cari-${judulTabel}`} className="sr-only">
            {placeholderCari}
          </label>
          <SemanticIcon
            nama="Search"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
          />
          <input
            id={`cari-${judulTabel}`}
            type="search"
            value={kataKunciCari}
            onChange={(e) => onUbahKataKunciCari(e.target.value)}
            placeholder={placeholderCari}
            className="h-9 w-full rounded-xl border border-slate-200/90 bg-white pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus-visible:border-[#1a6bff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a6bff]/20"
          />
        </div>
        {slotFilterTambahan ? (
          <div className="flex flex-wrap items-center gap-2">
            {slotFilterTambahan}
          </div>
        ) : null}
      </div>

      <div className="p-3">
        {sedangMemuat ? (
          <LoadingState />
        ) : data.length === 0 ? (
          <EmptyState
            judul={judulKosong}
            deskripsi={deskripsiKosong}
            labelTindakan={
              kataKunciCari.trim().length > 0 ? "Atur Ulang Pencarian" : undefined
            }
            onTindakan={
              kataKunciCari.trim().length > 0
                ? () => onUbahKataKunciCari("")
                : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-slate-50 text-slate-700">
                  {kolom.map((kol) => (
                    <th
                      key={kol.id}
                      scope="col"
                      className={`px-3 py-2.5 font-semibold ${kol.lebarKelas ?? ""}`}
                    >
                      {kol.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map((baris) => (
                  <tr
                    key={ambilKunciBaris(baris)}
                    className="hover:bg-slate-50/80"
                  >
                    {kolom.map((kol) => (
                      <td
                        key={kol.id}
                        className="px-3 py-2.5 align-top text-foreground"
                      >
                        {kol.renderSel(baris)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
        <span>
          Halaman {halamanSaatIni} dari {Math.max(1, totalHalaman)}
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={halamanSaatIni <= 1}
            onClick={() => onUbahHalaman(halamanSaatIni - 1)}
            className="min-h-7 rounded-md px-2.5 text-xs"
          >
            Sebelumnya
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={halamanSaatIni >= totalHalaman}
            onClick={() => onUbahHalaman(halamanSaatIni + 1)}
            className="min-h-7 rounded-md px-2.5 text-xs"
          >
            Berikutnya
          </Button>
        </div>
      </div>
    </section>
  );
}

