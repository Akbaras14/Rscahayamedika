"use client";

/**
 * @fileoverview Hook pembantu sesi dan notifikasi untuk halaman-halaman Tahap 1 (Administrator).
 */

import { useEffect, useState } from "react";
import type {
  DaftarNotifikasiRespons,
  ItemNavigasiPeran,
  ItemNotifikasiKontrak,
  ProfilSesiPengguna,
  ResponsApi,
} from "../../../../packages/shared-types/src/index.ts";

export function useSesiAdmin() {
  const [profil, setProfil] = useState<ProfilSesiPengguna | null>(null);
  const [navigasi, setNavigasi] = useState<ItemNavigasiPeran[]>([]);
  const [sedangMemuatSesi, setSedangMemuatSesi] = useState(true);
  const [notifikasiItems, setNotifikasiItems] = useState<
    ItemNotifikasiKontrak[]
  >([]);
  const [jumlahBelumDibaca, setJumlahBelumDibaca] = useState(0);
  const [sedangMemuatNotifikasi, setSedangMemuatNotifikasi] = useState(false);

  async function segarkanNotifikasi(): Promise<void> {
    setSedangMemuatNotifikasi(true);
    try {
      const res = await fetch(
        "/api/v1/notifications?halaman=1&ukuranHalaman=20",
        {
          cache: "no-store",
        },
      );
      if (!res.ok) {
        return;
      }
      const json = (await res.json()) as ResponsApi<DaftarNotifikasiRespons>;
      if (json.sukses) {
        setNotifikasiItems(json.data.items);
        setJumlahBelumDibaca(json.data.jumlahBelumDibaca);
      }
    } finally {
      setSedangMemuatNotifikasi(false);
    }
  }

  useEffect(() => {
    let aktif = true;
    async function muatAwal() {
      try {
        const res = await fetch("/api/v1/auth/me", { cache: "no-store" });
        if (!aktif) {
          return;
        }
        if (!res.ok) {
          setProfil(null);
          setNavigasi([]);
          return;
        }
        const json = (await res.json()) as ResponsApi<{
          profil: ProfilSesiPengguna;
          navigasi: ItemNavigasiPeran[];
        }>;
        if (json.sukses && aktif) {
          setProfil(json.data.profil);
          setNavigasi(json.data.navigasi);
          const resNotif = await fetch(
            "/api/v1/notifications?halaman=1&ukuranHalaman=20",
            { cache: "no-store" },
          );
          if (resNotif.ok) {
            const jsonNotif =
              (await resNotif.json()) as ResponsApi<DaftarNotifikasiRespons>;
            if (jsonNotif.sukses && aktif) {
              setNotifikasiItems(jsonNotif.data.items);
              setJumlahBelumDibaca(jsonNotif.data.jumlahBelumDibaca);
            }
          }
        }
      } finally {
        if (aktif) {
          setSedangMemuatSesi(false);
        }
      }
    }
    void muatAwal();
    return () => {
      aktif = false;
    };
  }, []);

  async function tandaiSatuNotifikasiDibaca(id: string): Promise<void> {
    const res = await fetch(`/api/v1/notifications/${id}/read`, {
      method: "PATCH",
      headers: { "X-Idempotency-Key": `mark-read-${id}` },
    });
    if (res.ok) {
      await segarkanNotifikasi();
    }
  }

  async function tandaiSemuaNotifikasiDibaca(): Promise<void> {
    const res = await fetch("/api/v1/notifications/read-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      await segarkanNotifikasi();
    }
  }

  async function keluarSesi(): Promise<void> {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    setProfil(null);
    setNavigasi([]);
    setNotifikasiItems([]);
    setJumlahBelumDibaca(0);
    if (typeof window !== "undefined") {
      window.location.assign(window.location.origin + "/login");
    }
  }

  return {
    profil,
    navigasi,
    sedangMemuatSesi,
    notifikasiItems,
    jumlahBelumDibaca,
    sedangMemuatNotifikasi,
    segarkanNotifikasi,
    tandaiSatuNotifikasiDibaca,
    tandaiSemuaNotifikasiDibaca,
    keluarSesi,
  };
}
