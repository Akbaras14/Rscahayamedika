"use client";

/**
 * @fileoverview Halaman Utama Aplikasi HPNMS (`/`).
 * Bertindak sebagai gateway cerdas berbasis peran:
 * 1. Jika pengguna belum masuk sesi (unauthenticated), langsung menyajikan halaman login (`LoginView`).
 * 2. Jika pengguna sudah memiliki sesi aktif, mengarahkan ke Dashboard Utama MediCore HPNMS (`/portal`)
 *    yang memuat ringkasan operasional dan navigasi ke workspace sesuai peran.
 */

import { ambilRuteUtamaPeran } from "../../packages/contracts/src/index.ts";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LoadingState } from "@/components/molecules/state-feedback";
import { LoginView } from "@/features/auth/components/login-view";
import type {
  ProfilSesiPengguna,
  ResponsApi,
} from "../../packages/shared-types/src/index.ts";

export default function HomePage() {
  const router = useRouter();
  const [sedangMemeriksa, setSedangMemeriksa] = useState(true);
  const [sudahOtentikasi, setSudahOtentikasi] = useState(false);

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
            setSudahOtentikasi(true);
            router.replace(ambilRuteUtamaPeran(json.data.profil.peran));
            return;
          }
        }
      } catch {
        // Belum ada sesi aktif
      } finally {
        if (aktif) {
          setSedangMemeriksa(false);
        }
      }
    }
    void periksaSesi();
    return () => {
      aktif = false;
    };
  }, [router]);

  if (sedangMemeriksa || sudahOtentikasi) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f7fe] p-4">
        <LoadingState
          judul="Memverifikasi Sesi HPNMS..."
          deskripsi="Menghubungkan ke gerbang layanan rumah sakit..."
        />
      </div>
    );
  }

  return <LoginView />;
}
