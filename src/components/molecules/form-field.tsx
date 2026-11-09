/**
 * @fileoverview Komponen Molecule untuk field formulir tervalidasi dan tombol aksi
 * dengan penjelasan syarat jika dinonaktifkan (UI_UX.md Bagian 4.3 & 10).
 */

import type * as React from "react";
import { cn } from "@/lib/utils";

export interface FormFieldMoleculeProps {
  id: string;
  label: string;
  wajib?: boolean;
  bantuan?: string;
  pesanGalat?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Pembungkus field formulir dengan label yang selalu terlihat, teks bantuan, dan pesan validasi di lokasi field.
 */
export function FormFieldMolecule({
  id,
  label,
  wajib = false,
  bantuan,
  pesanGalat,
  children,
  className,
}: FormFieldMoleculeProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-xs font-semibold text-foreground">
        {label}
        {wajib ? (
          <span className="ml-1 text-red-700" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {bantuan ? (
        <p id={`${id}-bantuan`} className="text-xs text-muted-foreground">
          {bantuan}
        </p>
      ) : null}
      {pesanGalat ? (
        <p
          id={`${id}-galat`}
          role="alert"
          className="flex items-center gap-1 text-xs font-medium text-red-800"
        >
          {pesanGalat}
        </p>
      ) : null}
    </div>
  );
}

