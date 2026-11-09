"use client";

/**
 * @fileoverview Ruang Kerja Peran Administrator:
 * Konfigurasi Master Operasional Berversi (AB-030) & Peninjauan Jejak Audit Akses (AB-032, AB-034).
 * Acuan: BRD Bab III & XVII, UI_UX.md Bagian 6.1, 8, 9, & 10.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SemanticIcon } from "@/components/atoms/semantic-icon";
import { StatusBadge } from "@/components/atoms/status-badge";
import { FormFieldMolecule } from "@/components/molecules/form-field";
import {
  ErrorState,
  LoadingState,
  MinimalToastBanner,
  PermissionDeniedState,
} from "@/components/molecules/state-feedback";
import { ConfirmDialog } from "@/components/organisms/confirm-dialog";
import {
  DataTableFoundation,
  type DefinisiKolomTabel,
} from "@/components/organisms/data-table-foundation";
import { AppShellTemplate } from "@/components/templates/app-shell-template";
import { Button } from "@/components/ui/button";
import { useSesiAdmin } from "@/features/admin/hooks/use-sesi-admin";
import type {
  ItemNavigasiPeran,
  ResponsApi,
} from "../../../../packages/shared-types/src/index.ts";
import type {
  DaftarAuditAdminRespons,
  EntitasCatatanAudit,
  EntitasKonfigurasiOperasional,
  EntitasRiwayatKonfigurasi,
} from "../../../../services/identity-service/src/model/identity.model.ts";

export function AdminConfigAuditWorkspace() {
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

  const [konfigurasiList, setKonfigurasiList] = useState<
    EntitasKonfigurasiOperasional[]
  >([]);
  const [riwayatKonfigurasiList, setRiwayatKonfigurasiList] = useState<
    EntitasRiwayatKonfigurasi[]
  >([]);

  // State pengubahan konfigurasi dengan konfirmasi
  const [konfigDiedit, setKonfigDiedit] =
    useState<EntitasKonfigurasiOperasional | null>(null);
  const [nilaiBaruKonfig, setNilaiBaruKonfig] = useState("");
  const [alasanKonfig, setAlasanKonfig] = useState("");
  const [dialogKonfirmasiKonfig, setDialogKonfirmasiKonfig] = useState(false);
  const [sedangMenyimpanKonfig, setSedangMenyimpanKonfig] = useState(false);

  // State tabel jejak audit
  const [auditItems, setAuditItems] = useState<EntitasCatatanAudit[]>([]);
  const [totalAudit, setTotalAudit] = useState(0);
  const [halamanAudit, setHalamanAudit] = useState(1);
  const ukuranHalamanAudit = 10;
  const [kataKunciAudit, setKataKunciAudit] = useState("");
  const [filterStatusAudit, setFilterStatusAudit] = useState<string>("");
  const [sedangMemuatAudit, setSedangMemuatAudit] = useState(false);

  // Umpan balik aman
  const [toastInfo, setToastInfo] = useState<{
    jenis: "berhasil" | "kesalahan";
    pesan: string;
  } | null>(null);
  const [galatUmum, setGalatUmum] = useState<{
    pesan: string;
    kodeLaporan?: string;
  } | null>(null);

  const [dialogKeluarTerbuka, setDialogKeluarTerbuka] = useState(false);
  const [menuTerkunciTerpilih, setMenuTerkunciTerpilih] =
    useState<ItemNavigasiPeran | null>(null);

  const muatKonfigurasiDanAudit = useCallback(async () => {
    try {
      const paramsAudit = new URLSearchParams({
        halaman: String(halamanAudit),
        ukuranHalaman: String(ukuranHalamanAudit),
      });
      if (kataKunciAudit.trim()) {
        paramsAudit.set("kataKunci", kataKunciAudit.trim());
      }
      if (filterStatusAudit) {
        paramsAudit.set("statusHasil", filterStatusAudit);
      }

      const [resKonfig, resAudit] = await Promise.all([
        fetch("/api/v1/admin/configurations", { cache: "no-store" }),
        fetch(`/api/v1/admin/audit-logs?${paramsAudit.toString()}`, {
          cache: "no-store",
        }),
      ]);

      const jsonKonfig = (await resKonfig.json()) as ResponsApi<{
        konfigurasi: EntitasKonfigurasiOperasional[];
        riwayat: EntitasRiwayatKonfigurasi[];
      }>;
      if (jsonKonfig.sukses) {
        setKonfigurasiList(jsonKonfig.data.konfigurasi);
        setRiwayatKonfigurasiList(jsonKonfig.data.riwayat);
      }

      const jsonAudit =
        (await resAudit.json()) as ResponsApi<DaftarAuditAdminRespons>;
      if (jsonAudit.sukses) {
        setGalatUmum(null);
        setAuditItems(jsonAudit.data.items);
        setTotalAudit(jsonAudit.data.totalItem);
      } else {
        setGalatUmum({
          pesan: jsonAudit.galat.pesan,
          kodeLaporan: jsonAudit.galat.kodeLaporan,
        });
      }
    } catch {
      setGalatUmum({
        pesan: "Koneksi terputus. Periksa jaringan dan coba kembali.",
      });
    } finally {
      setSedangMemuatAudit(false);
    }
  }, [halamanAudit, kataKunciAudit, filterStatusAudit]);

  useEffect(() => {
    if (!profil || profil.peran !== "administrator") {
      return;
    }
    let aktif = true;
    async function sinkronisasi() {
      await Promise.resolve();
      if (aktif) {
        await muatKonfigurasiDanAudit();
      }
    }
    void sinkronisasi();
    return () => {
      aktif = false;
    };
  }, [profil, muatKonfigurasiDanAudit]);

  function pilihKonfigUntukDiedit(item: EntitasKonfigurasiOperasional): void {
    setKonfigDiedit(item);
    setNilaiBaruKonfig(item.nilai);
    setAlasanKonfig("");
    setToastInfo(null);
    setGalatUmum(null);
  }

  async function eksekusiSimpanKonfigurasi(): Promise<void> {
    if (!konfigDiedit) {
      return;
    }
    setSedangMenyimpanKonfig(true);
    setGalatUmum(null);
    setToastInfo(null);
    try {
      const res = await fetch(
        `/api/v1/admin/configurations/${encodeURIComponent(konfigDiedit.kunci)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nilai: nilaiBaruKonfig.trim(),
            versi: konfigDiedit.versi,
            alasanPerubahan: alasanKonfig.trim(),
          }),
        },
      );

      const json = (await res.json()) as ResponsApi<{
        konfigurasi: EntitasKonfigurasiOperasional;
        riwayat: EntitasRiwayatKonfigurasi;
      }>;

      if (!json.sukses) {
        setGalatUmum({
          pesan: json.galat.pesan,
          kodeLaporan: json.galat.kodeLaporan,
        });
        return;
      }

      setKonfigDiedit(null);
      setToastInfo({
        jenis: "berhasil",
        pesan: `Konfigurasi "${json.data.konfigurasi.kunci}" berhasil diperbarui ke versi v${json.data.konfigurasi.versi} dan dicatat dalam riwayat.`,
      });
      await muatKonfigurasiDanAudit();
    } finally {
      setSedangMenyimpanKonfig(false);
      setDialogKonfirmasiKonfig(false);
    }
  }

  const totalHalamanAudit = Math.max(
    1,
    Math.ceil(totalAudit / ukuranHalamanAudit),
  );

  const kolomAudit: readonly DefinisiKolomTabel<EntitasCatatanAudit>[] = [
    {
      id: "waktu",
      header: "Waktu Kejadian",
      renderSel: (baris) => (
        <div className="space-y-0.5">
          <p className="font-mono text-[11px] text-foreground">
            {new Date(baris.waktuKejadian).toLocaleString("id-ID", {
              timeZone: "Asia/Jakarta",
            })}
          </p>
          <p className="font-mono text-[10px] text-muted-foreground">
            {baris.correlationId}
          </p>
        </div>
      ),
    },
    {
      id: "aktor",
      header: "Aktor & Peran",
      renderSel: (baris) => (
        <div>
          <p className="font-semibold text-foreground">{baris.aktorPeran}</p>
          <p className="font-mono text-[11px] text-muted-foreground">
            {baris.aktorPenggunaId ?? "anonim"}
          </p>
        </div>
      ),
    },
    {
      id: "tindakan",
      header: "Tindakan & Objek",
      renderSel: (baris) => (
        <div>
          <p className="font-mono font-semibold text-foreground">
            {baris.tindakan}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {baris.objekTipe}:{" "}
            <span className="font-mono text-foreground">{baris.objekId}</span>
          </p>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status Hasil",
      renderSel: (baris) =>
        baris.statusHasil === "berhasil" ? (
          <StatusBadge varian="sesuai" label="Berhasil" />
        ) : baris.statusHasil === "ditolak" ? (
          <StatusBadge varian="ditahan" label="Ditolak" />
        ) : (
          <StatusBadge varian="menunggu" label="Gagal" />
        ),
    },
    {
      id: "alasan",
      header: "Alasan & Metadata Tersanitasi",
      renderSel: (baris) => (
        <div className="space-y-1 max-w-md">
          <p className="text-foreground">{baris.alasan}</p>
          {Object.keys(baris.metadataTersanitasi).length > 0 ? (
            <p className="font-mono text-[10px] text-muted-foreground break-all">
              {JSON.stringify(baris.metadataTersanitasi)}
            </p>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <AppShellTemplate
      judulHalaman="Konfigurasi Master Operasional & Jejak Audit"
      subjudulHalaman="Pengelolaan parameter sistem berversi (AB-030) dan peninjauan log audit teknis yang telah disanitasi (AB-032, AB-034)."
      profil={profil}
      navigasi={navigasi}
      notifikasiItems={notifikasiItems}
      jumlahBelumDibaca={jumlahBelumDibaca}
      sedangMemuatNotifikasi={sedangMemuatNotifikasi}
      onTandaiSatuNotifikasiDibaca={tandaiSatuNotifikasiDibaca}
      onTandaiSemuaNotifikasiDibaca={tandaiSemuaNotifikasiDibaca}
      onPilihMenuTerkunci={(item) => setMenuTerkunciTerpilih(item)}
      onKeluarSesi={() => setDialogKeluarTerbuka(true)}
    >
      {sedangMemuatSesi ? (
        <LoadingState judul="Memeriksa sesi dan izin Administrator..." />
      ) : !profil || profil.peran !== "administrator" ? (
        <div className="space-y-3">
          <PermissionDeniedState
            pesan="Anda tidak memiliki izin untuk tindakan ini."
            detailKonteks="Halaman Konfigurasi Operasional & Jejak Audit hanya dapat diakses oleh peran Administrator (AB-032)."
          />
          <Link
            href="/login"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <SemanticIcon nama="ArrowLeft" className="size-4" />
            Kembali ke Halaman Masuk
          </Link>
        </div>
      ) : (
        <>
          {toastInfo ? (
            <MinimalToastBanner
              jenis={toastInfo.jenis}
              pesan={toastInfo.pesan}
              onTutup={() => setToastInfo(null)}
            />
          ) : null}

          {galatUmum ? (
            <ErrorState
              pesanAman={galatUmum.pesan}
              kodeLaporan={galatUmum.kodeLaporan}
              onCobaLagi={() => void muatKonfigurasiDanAudit()}
            />
          ) : null}

          {/* Bagian 1: Konfigurasi Master Operasional Berversi */}
          <section
            aria-labelledby="judul-konfig-master"
            className="rounded-lg border border-border bg-card p-5 space-y-4"
          >
            <div className="border-b border-border pb-3">
              <h2
                id="judul-konfig-master"
                className="text-sm font-bold text-foreground"
              >
                1. Konfigurasi Master Operasional (Berversi — AB-030)
              </h2>
              <p className="text-xs text-muted-foreground">
                Hanya mengatur parameter teknis/operasional umum. Dilarang
                mengubah ambang klinis atau mematikan aturan keselamatan
                verifikasi dua identitas pasien (AB-001, AB-020).
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {konfigurasiList.map((item) => (
                <article
                  key={item.kunci}
                  className="flex flex-col justify-between gap-3 rounded-md border border-border bg-slate-50/70 p-3.5 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-foreground">
                        {item.kunci}
                      </span>
                      <StatusBadge
                        varian="netral"
                        label={`Versi v${item.versi}`}
                      />
                    </div>
                    <p className="text-muted-foreground">{item.deskripsi}</p>
                    <p className="pt-1">
                      Nilai aktif:{" "}
                      <code className="rounded border border-blue-800/30 bg-blue-50 px-1.5 py-0.5 font-mono font-semibold text-blue-950">
                        {item.nilai}
                      </code>
                    </p>
                  </div>

                  <div className="flex items-center justify-between border-t border-border pt-2.5 text-[11px] text-muted-foreground">
                    <span>Diperbarui oleh: {item.diperbaruiOleh}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => pilihKonfigUntukDiedit(item)}
                      className="min-h-7 rounded px-2.5 text-xs"
                    >
                      <SemanticIcon nama="Pencil" className="mr-1 size-3.5" />
                      Ubah Nilai
                    </Button>
                  </div>
                </article>
              ))}
            </div>

            {konfigDiedit ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setDialogKonfirmasiKonfig(true);
                }}
                className="mt-4 rounded-md border-2 border-blue-700/40 bg-white p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-foreground">
                    Perbarui Konfigurasi:{" "}
                    <code className="font-mono">{konfigDiedit.kunci}</code>{" "}
                    (Versi Saat Ini: v{konfigDiedit.versi})
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => setKonfigDiedit(null)}
                    className="min-h-7 rounded px-2 text-xs"
                  >
                    Batal
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormFieldMolecule
                    id="input-nilai-konfig"
                    label="Nilai Baru"
                    wajib
                  >
                    <input
                      id="input-nilai-konfig"
                      type="text"
                      required
                      value={nilaiBaruKonfig}
                      onChange={(e) => setNilaiBaruKonfig(e.target.value)}
                      className="h-9 rounded-md border border-input bg-white px-3 text-xs text-foreground"
                    />
                  </FormFieldMolecule>

                  <FormFieldMolecule
                    id="input-alasan-konfig"
                    label="Alasan Perubahan (Wajib untuk Riwayat AB-030)"
                    wajib
                  >
                    <input
                      id="input-alasan-konfig"
                      type="text"
                      required
                      minLength={5}
                      value={alasanKonfig}
                      onChange={(e) => setAlasanKonfig(e.target.value)}
                      placeholder="Contoh: Penyesuaian parameter operasional instalasi"
                      className="h-9 rounded-md border border-input bg-white px-3 text-xs text-foreground"
                    />
                  </FormFieldMolecule>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    className="min-h-8 rounded-md px-3.5 text-xs font-semibold"
                  >
                    <SemanticIcon nama="Save" className="mr-1.5 size-4" />
                    Tinjau & Simpan Konfigurasi
                  </Button>
                </div>
              </form>
            ) : null}

            {/* Riwayat Versi Perubahan Konfigurasi (AB-030) */}
            {riwayatKonfigurasiList.length > 0 ? (
              <div className="border-t border-border pt-3 space-y-2">
                <h3 className="text-xs font-bold text-foreground">
                  Riwayat Perubahan Konfigurasi (AB-030):
                </h3>
                <div className="space-y-1.5">
                  {riwayatKonfigurasiList.map((r) => (
                    <div
                      key={r.id}
                      className="rounded border border-border bg-slate-50 px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-2"
                    >
                      <div>
                        <span className="font-mono font-semibold">
                          {r.kunciKonfigurasi}
                        </span>{" "}
                        (v{r.versiSebelum} → v{r.versiSesudah}):{" "}
                        <code className="font-mono text-red-900">
                          {r.nilaiSebelum}
                        </code>{" "}
                        →{" "}
                        <code className="font-mono text-emerald-900 font-semibold">
                          {r.nilaiSesudah}
                        </code>
                        <p className="text-[11px] text-muted-foreground">
                          Alasan: {r.alasanPerubahan} • Oleh: {r.diubahOleh}
                        </p>
                      </div>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {r.correlationId}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          {/* Bagian 2: Tabel Jejak Audit Akses & Perubahan */}
          <DataTableFoundation
            judulTabel="2. Jejak Audit Akses & Perubahan Sistem (AB-032, AB-034)"
            deskripsiTabel="Menampilkan seluruh peristiwa autentikasi, penolakan otorisasi, perubahan pengguna, dan konfigurasi. Kata sandi, token, dan data klinis disensor otomatis."
            kolom={kolomAudit}
            data={auditItems}
            ambilKunciBaris={(b) => b.id}
            kataKunciCari={kataKunciAudit}
            onUbahKataKunciCari={(nilai) => {
              setKataKunciAudit(nilai);
              setHalamanAudit(1);
            }}
            placeholderCari="Cari tindakan, ID objek, alasan, atau correlationId..."
            slotFilterTambahan={
              <>
                <label htmlFor="filter-status-audit" className="sr-only">
                  Filter Status Hasil Audit
                </label>
                <select
                  id="filter-status-audit"
                  value={filterStatusAudit}
                  onChange={(e) => {
                    setFilterStatusAudit(e.target.value);
                    setHalamanAudit(1);
                  }}
                  className="h-8 rounded-md border border-input bg-white px-2.5 text-xs text-foreground"
                >
                  <option value="">Semua Hasil Audit</option>
                  <option value="berhasil">Berhasil</option>
                  <option value="ditolak">Ditolak (Pelanggaran Akses)</option>
                  <option value="gagal">Gagal</option>
                </select>
              </>
            }
            sedangMemuat={sedangMemuatAudit}
            halamanSaatIni={halamanAudit}
            totalHalaman={totalHalamanAudit}
            totalData={totalAudit}
            onUbahHalaman={setHalamanAudit}
          />
        </>
      )}

      {/* Dialog Konfirmasi Perubahan Konfigurasi Penting */}
      <ConfirmDialog
        terbuka={dialogKonfirmasiKonfig}
        onPerubahanTerbuka={setDialogKonfirmasiKonfig}
        judul={
          konfigDiedit
            ? `Simpan perubahan konfigurasi "${konfigDiedit.kunci}"?`
            : "Simpan perubahan konfigurasi?"
        }
        deskripsiDampak="Nilai konfigurasi lama tetap disimpan dalam riwayat versi (AB-030) dan perubahan ini langsung dicatat ke dalam jejak audit."
        labelKonfirmasi="Simpan Konfigurasi"
        labelBatal="Kembali"
        varianTindakan="primer"
        sedangMemproses={sedangMenyimpanKonfig}
        onKonfirmasi={eksekusiSimpanKonfigurasi}
      />

      {/* Dialog Konfirmasi Keluar Sesi */}
      <ConfirmDialog
        terbuka={dialogKeluarTerbuka}
        onPerubahanTerbuka={setDialogKeluarTerbuka}
        judul="Akhiri sesi Administrator saat ini?"
        deskripsiDampak="Sesi aktif Anda akan dicabut di server dan cookie HttpOnly dihapus."
        labelKonfirmasi="Keluar Sesi"
        labelBatal="Kembali"
        varianTindakan="destruktif"
        onKonfirmasi={async () => {
          await keluarSesi();
          setDialogKeluarTerbuka(false);
        }}
      />

      {/* Dialog Informasi Pembatasan Akses Lintas Peran (AB-032) */}
      <ConfirmDialog
        terbuka={menuTerkunciTerpilih !== null}
        onPerubahanTerbuka={(buka) => {
          if (!buka) {
            setMenuTerkunciTerpilih(null);
          }
        }}
        judul={
          menuTerkunciTerpilih
            ? `Pembatasan Akses Peran: ${menuTerkunciTerpilih.label}`
            : "Pembatasan Akses Peran"
        }
        deskripsiDampak="Sesuai BRD Bab III dan aturan keselamatan AB-032, Administrator hanya berwenang mengelola akun, peran, konfigurasi teknis, serta audit akses, dan tidak memiliki akses ke modul klinis maupun operasional gizi."
        labelKonfirmasi="Mengerti"
        labelBatal="Tutup"
        varianTindakan="primer"
        onKonfirmasi={() => setMenuTerkunciTerpilih(null)}
      />
    </AppShellTemplate>
  );
}
