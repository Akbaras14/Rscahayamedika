"use client";

/**
 * @fileoverview Komponen Organism `ConfirmDialog` (Popup minimalis seperti SweetAlert2 berbasis Radix AlertDialog).
 * Mengikuti UI_UX.md Bagian 8:
 * - Judul spesifik berbahasa Indonesia (bukan "Are you sure?")
 * - Deskripsi dampak yang jelas
 * - Pengelolaan fokus keyboard & tombol `Escape`
 * - Tombol destruktif merah vs tombol primer biru, dibedakan dari tombol keselamatan klinis
 * - Status memproses untuk mencegah pengiriman ganda
 */

import { AlertDialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import { SemanticIcon } from "@/components/atoms/semantic-icon";

export interface ConfirmDialogProps {
  terbuka: boolean;
  onPerubahanTerbuka: (terbuka: boolean) => void;
  judul: string;
  deskripsiDampak: string;
  labelKonfirmasi: string;
  labelBatal?: string;
  varianTindakan?: "primer" | "destruktif" | "keselamatan_klinis";
  sedangMemproses?: boolean;
  onKonfirmasi: () => void | Promise<void>;
}

/**
 * Dialog konfirmasi minimalis yang aksesibel untuk tindakan penting, destruktif, atau penahanan keselamatan.
 */
export function ConfirmDialog({
  terbuka,
  onPerubahanTerbuka,
  judul,
  deskripsiDampak,
  labelKonfirmasi,
  labelBatal = "Kembali",
  varianTindakan = "primer",
  sedangMemproses = false,
  onKonfirmasi,
}: ConfirmDialogProps) {
  const adalahMerah =
    varianTindakan === "destruktif" || varianTindakan === "keselamatan_klinis";

  return (
    <AlertDialog.Root open={terbuka} onOpenChange={onPerubahanTerbuka}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-slate-950/40" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-5 shadow-sm focus:outline-none">
          <div className="flex items-start gap-3">
            <div
              className={
                adalahMerah
                  ? "flex size-9 shrink-0 items-center justify-center rounded-md border border-red-800/30 bg-red-50 text-red-800"
                  : "flex size-9 shrink-0 items-center justify-center rounded-md border border-blue-800/30 bg-blue-50 text-blue-800"
              }
            >
              <SemanticIcon
                nama={
                  varianTindakan === "keselamatan_klinis"
                    ? "Ban"
                    : adalahMerah
                      ? "Trash2"
                      : "ShieldCheck"
                }
                className="size-4"
              />
            </div>
            <div className="space-y-1.5">
              <AlertDialog.Title className="text-sm font-bold text-foreground">
                {judul}
              </AlertDialog.Title>
              <AlertDialog.Description className="text-xs leading-relaxed text-muted-foreground">
                {deskripsiDampak}
              </AlertDialog.Description>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-end gap-2.5">
            <AlertDialog.Cancel asChild>
              <Button
                type="button"
                variant="outline"
                disabled={sedangMemproses}
                className="min-h-8 rounded-md px-3 text-xs"
              >
                {labelBatal}
              </Button>
            </AlertDialog.Cancel>
            <Button
              type="button"
              disabled={sedangMemproses}
              onClick={() => void onKonfirmasi()}
              className={
                adalahMerah
                  ? "min-h-8 rounded-md bg-red-700 px-3 text-xs font-semibold text-white hover:bg-red-800"
                  : "min-h-8 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              }
            >
              {sedangMemproses ? "Memproses..." : labelKonfirmasi}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

