"use client";

/**
 * @fileoverview Komponen Fitur `NotificationBell` (Lonceng Notifikasi Header).
 * Mengikuti aturan wajib UI_UX.md Bagian 7:
 * - Ikon `Bell` muncul di header untuk pengguna terautentikasi
 * - Badge menampilkan jumlah notifikasi belum dibaca (disembunyikan jika 0, `99+` jika > 99)
 * - Membuka panel TIDAK otomatis menandai semua sudah dibaca
 * - Menampilkan status `Belum dibaca` / `Sudah dibaca` secara teks eksplisit dan indikator visual
 * - Aksi `Tandai sudah dibaca`, `Tandai semua sudah dibaca`, serta filter `Semua` / `Belum dibaca`
 */

import { useState } from "react";
import { Popover } from "radix-ui";
import { SemanticIcon } from "@/components/atoms/semantic-icon";
import { Button } from "@/components/ui/button";
import type { ItemNotifikasiKontrak } from "../../../../packages/shared-types/src/index.ts";

export interface NotificationBellProps {
  items: readonly ItemNotifikasiKontrak[];
  jumlahBelumDibaca: number;
  sedangMemuat?: boolean;
  onTandaiSatuDibaca: (id: string) => Promise<void>;
  onTandaiSemuaDibaca: () => Promise<void>;
}

/**
 * Lonceng notifikasi header dengan dukungan status sudah/belum dibaca per pengguna.
 */
export function NotificationBell({
  items,
  jumlahBelumDibaca,
  sedangMemuat = false,
  onTandaiSatuDibaca,
  onTandaiSemuaDibaca,
}: NotificationBellProps) {
  const [filterStatus, setFilterStatus] = useState<"semua" | "belum_dibaca">(
    "semua",
  );
  const [idSedangDiproses, setIdSedangDiproses] = useState<string | null>(null);
  const [sedangProsesSemua, setSedangProsesSemua] = useState(false);

  const daftarTampil =
    filterStatus === "belum_dibaca"
      ? items.filter((item) => item.statusBaca === "belum_dibaca")
      : items;

  const teksBadge =
    jumlahBelumDibaca > 99 ? "99+" : String(jumlahBelumDibaca);

  async function tanganiTandaiSatu(id: string): Promise<void> {
    setIdSedangDiproses(id);
    try {
      await onTandaiSatuDibaca(id);
    } finally {
      setIdSedangDiproses(null);
    }
  }

  async function tanganiTandaiSemua(): Promise<void> {
    setSedangProsesSemua(true);
    try {
      await onTandaiSemuaDibaca();
    } finally {
      setSedangProsesSemua(false);
    }
  }

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={
            jumlahBelumDibaca > 0
              ? `Notifikasi (${jumlahBelumDibaca} belum dibaca)`
              : "Notifikasi (tidak ada yang belum dibaca)"
          }
          className="relative inline-flex size-9 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-600 shadow-2xs transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a6bff]"
        >
          <SemanticIcon nama="Bell" className="size-[18px]" />
          {jumlahBelumDibaca > 0 ? (
            <span
              aria-hidden="true"
              className="absolute -right-1 -top-1 inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#ff4d4f] px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white"
            >
              {teksBadge}
            </span>
          ) : null}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={10}
          className="z-50 w-[92vw] max-w-md overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xl shadow-slate-900/10 focus:outline-none"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="text-xs font-bold text-foreground">
                Notifikasi Akun
              </h2>
              <p className="text-[11px] text-muted-foreground">
                {jumlahBelumDibaca} belum dibaca • Status tersimpan per pengguna
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="xs"
              disabled={jumlahBelumDibaca === 0 || sedangProsesSemua}
              onClick={() => void tanganiTandaiSemua()}
              className="min-h-7 rounded-md px-2 text-[11px]"
            >
              {sedangProsesSemua
                ? "Memproses..."
                : "Tandai semua sudah dibaca"}
            </Button>
          </div>

          <div
            role="tablist"
            aria-label="Filter status notifikasi"
            className="flex items-center gap-1.5 border-b border-border bg-slate-50 px-4 py-2"
          >
            <button
              type="button"
              role="tab"
              aria-selected={filterStatus === "semua"}
              onClick={() => setFilterStatus("semua")}
              className={`min-h-7 rounded-md px-2.5 py-1 text-xs font-medium ${
                filterStatus === "semua"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-slate-200/70 hover:text-foreground"
              }`}
            >
              Semua ({items.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filterStatus === "belum_dibaca"}
              onClick={() => setFilterStatus("belum_dibaca")}
              className={`min-h-7 rounded-md px-2.5 py-1 text-xs font-medium ${
                filterStatus === "belum_dibaca"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-slate-200/70 hover:text-foreground"
              }`}
            >
              Belum dibaca ({jumlahBelumDibaca})
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-border">
            {sedangMemuat ? (
              <p className="p-4 text-xs text-muted-foreground">
                Memuat daftar notifikasi...
              </p>
            ) : daftarTampil.length === 0 ? (
              <div className="p-5 text-center text-xs text-muted-foreground">
                {filterStatus === "belum_dibaca"
                  ? "Tidak ada notifikasi dengan status Belum dibaca."
                  : "Belum ada notifikasi untuk akun ini."}
              </div>
            ) : (
              daftarTampil.map((item) => {
                const belumDibaca = item.statusBaca === "belum_dibaca";
                return (
                  <article
                    key={item.id}
                    className={`p-3.5 text-xs ${
                      belumDibaca ? "bg-blue-50/60" : "bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {belumDibaca ? (
                          <span
                            aria-hidden="true"
                            className="inline-block size-2 rounded-full bg-blue-700"
                          />
                        ) : null}
                        <span className="font-semibold text-foreground">
                          {item.judul}
                        </span>
                      </div>
                      <span
                        className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                          belumDibaca
                            ? "border-blue-800/30 bg-blue-100/80 text-blue-950"
                            : "border-slate-300 bg-slate-100 text-slate-700"
                        }`}
                      >
                        {belumDibaca ? "Belum dibaca" : "Sudah dibaca"}
                      </span>
                    </div>

                    <p className="mt-1 leading-relaxed text-muted-foreground">
                      {item.ringkasan}
                    </p>

                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span>
                        Kategori:{" "}
                        <strong className="font-medium text-foreground">
                          {item.kategori}
                        </strong>{" "}
                        • Prioritas:{" "}
                        <strong className="font-medium text-foreground">
                          {item.prioritas}
                        </strong>
                      </span>

                      {belumDibaca ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          disabled={idSedangDiproses === item.id}
                          onClick={() => void tanganiTandaiSatu(item.id)}
                          className="min-h-6 rounded px-2 text-[11px]"
                        >
                          {idSedangDiproses === item.id
                            ? "Menyimpan..."
                            : "Tandai sudah dibaca"}
                        </Button>
                      ) : null}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
