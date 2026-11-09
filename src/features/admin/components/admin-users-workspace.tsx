"use client";

/**
 * @fileoverview Ruang Kerja Peran Administrator:
 * Pengelolaan Akun Pengguna, Peran & Izin, Penugasan Bangsal, dan Pencabutan Sesi.
 * Acuan: BRD Bab III & XVII (AB-030, AB-032, AB-034), UI_UX.md Bagian 6.1, 8, 9, & 10.
 *
 * Prinsip Kewenangan (AB-032):
 * - Administrator hanya mengelola akun, peran, penugasan bangsal, dan sesi.
 * - Administrator TIDAK memiliki akses untuk melihat maupun mengubah data/keputusan klinis pasien.
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
import {
  type DefinisiPeranMaster,
  MATRIKS_PERAN_MASTER,
} from "../../../../packages/contracts/src/index.ts";
import {
  PERAN_PENGGUNA,
  type ItemNavigasiPeran,
  type PeranPengguna,
  type ResponsApi,
} from "../../../../packages/shared-types/src/index.ts";
import type {
  DaftarPenggunaAdminRespons,
  RingkasanPenggunaAdminDto,
} from "../../../../services/identity-service/src/model/identity.model.ts";

export function AdminUsersWorkspace() {
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

  const [daftarPengguna, setDaftarPengguna] = useState<
    RingkasanPenggunaAdminDto[]
  >([]);
  const [totalPengguna, setTotalPengguna] = useState(0);
  const [halaman, setHalaman] = useState(1);
  const ukuranHalaman = 8;
  const [kataKunci, setKataKunci] = useState("");
  const [filterPeran, setFilterPeran] = useState<string>("");
  const [filterAktif, setFilterAktif] = useState<string>("");
  const [sedangMemuatTabel, setSedangMemuatTabel] = useState(false);

  const [matriksPeran, setMatriksPeran] = useState<DefinisiPeranMaster[]>([]);

  // Umpan balik aman
  const [toastInfo, setToastInfo] = useState<{
    jenis: "berhasil" | "kesalahan";
    pesan: string;
  } | null>(null);
  const [galatUmum, setGalatUmum] = useState<{
    pesan: string;
    kodeLaporan?: string;
  } | null>(null);

  // State formulir buat pengguna baru
  const [namaPenggunaBaru, setNamaPenggunaBaru] = useState("");
  const [namaLengkapBaru, setNamaLengkapBaru] = useState("");
  const [kataSandiBaru, setKataSandiBaru] = useState("");
  const [peranBaru, setPeranBaru] = useState<PeranPengguna>(
    "petugas_pendaftaran",
  );
  const [bangsalInputBaru, setBangsalInputBaru] = useState("");
  const [alasanBuat, setAlasanBuat] = useState("");
  const [galatFieldBuat, setGalatFieldBuat] = useState<Record<string, string>>(
    {},
  );
  const [sedangMenyimpanBaru, setSedangMenyimpanBaru] = useState(false);

  // State formulir ubah pengguna terpilih
  const [penggunaDiedit, setPenggunaDiedit] =
    useState<RingkasanPenggunaAdminDto | null>(null);
  const [editNamaLengkap, setEditNamaLengkap] = useState("");
  const [editPeran, setEditPeran] = useState<PeranPengguna>("perawat");
  const [editBangsalInput, setEditBangsalInput] = useState("");
  const [editAktif, setEditAktif] = useState(true);
  const [editAlasan, setEditAlasan] = useState("");
  const [sedangMenyimpanEdit, setSedangMenyimpanEdit] = useState(false);

  // State dialog konfirmasi destruktif (nonaktifkan / cabut sesi / keluar)
  const [targetCabutSesi, setTargetCabutSesi] =
    useState<RingkasanPenggunaAdminDto | null>(null);
  const [sedangProsesCabut, setSedangProsesCabut] = useState(false);
  const [dialogKeluarTerbuka, setDialogKeluarTerbuka] = useState(false);
  const [menuTerkunciTerpilih, setMenuTerkunciTerpilih] =
    useState<ItemNavigasiPeran | null>(null);

  const muatDataPenggunaDanPeran = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        halaman: String(halaman),
        ukuranHalaman: String(ukuranHalaman),
      });
      if (kataKunci.trim()) {
        params.set("kataKunci", kataKunci.trim());
      }
      if (filterPeran) {
        params.set("peran", filterPeran);
      }
      if (filterAktif) {
        params.set("aktif", filterAktif);
      }

      const [resUsers, resRoles] = await Promise.all([
        fetch(`/api/v1/admin/users?${params.toString()}`, {
          cache: "no-store",
        }),
        fetch("/api/v1/admin/roles", { cache: "no-store" }),
      ]);

      const jsonUsers =
        (await resUsers.json()) as ResponsApi<DaftarPenggunaAdminRespons>;
      if (!jsonUsers.sukses) {
        setGalatUmum({
          pesan: jsonUsers.galat.pesan,
          kodeLaporan: jsonUsers.galat.kodeLaporan,
        });
        return;
      }

      setGalatUmum(null);
      setDaftarPengguna(jsonUsers.data.items);
      setTotalPengguna(jsonUsers.data.totalItem);

      const jsonRoles = (await resRoles.json()) as ResponsApi<{
        items: DefinisiPeranMaster[];
      }>;
      if (jsonRoles.sukses) {
        setMatriksPeran(jsonRoles.data.items);
      }
    } catch {
      setGalatUmum({
        pesan: "Koneksi terputus. Periksa jaringan dan coba kembali.",
      });
    } finally {
      setSedangMemuatTabel(false);
    }
  }, [halaman, kataKunci, filterPeran, filterAktif]);

  useEffect(() => {
    if (!profil || profil.peran !== "administrator") {
      return;
    }
    let aktif = true;
    async function sinkronisasi() {
      await Promise.resolve();
      if (aktif) {
        await muatDataPenggunaDanPeran();
      }
    }
    void sinkronisasi();
    return () => {
      aktif = false;
    };
  }, [profil, muatDataPenggunaDanPeran]);

  function bukaFormEdit(baris: RingkasanPenggunaAdminDto): void {
    setPenggunaDiedit(baris);
    setEditNamaLengkap(baris.namaLengkap);
    setEditPeran(baris.peran);
    setEditBangsalInput(baris.daftarBangsalId.join(", "));
    setEditAktif(baris.aktif);
    setEditAlasan("");
  }

  async function tanganiBuatPenggunaBaru(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setGalatFieldBuat({});
    setToastInfo(null);
    setGalatUmum(null);

    const daftarBangsalId = bangsalInputBaru
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s.length > 0);

    setSedangMenyimpanBaru(true);
    try {
      const res = await fetch("/api/v1/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": `create-user-${namaPenggunaBaru.trim()}-${Date.now()}`,
        },
        body: JSON.stringify({
          namaPengguna: namaPenggunaBaru.trim(),
          namaLengkap: namaLengkapBaru.trim(),
          kataSandi: kataSandiBaru,
          peran: peranBaru,
          daftarBangsalId,
          aktif: true,
          alasan: alasanBuat.trim(),
        }),
      });

      const json =
        (await res.json()) as ResponsApi<RingkasanPenggunaAdminDto>;
      if (!json.sukses) {
        if (json.galat.rincianValidasi) {
          const peta: Record<string, string> = {};
          for (const item of json.galat.rincianValidasi) {
            peta[item.field] = item.pesan;
          }
          setGalatFieldBuat(peta);
        }
        setGalatUmum({
          pesan: json.galat.pesan,
          kodeLaporan: json.galat.kodeLaporan,
        });
        return;
      }

      setNamaPenggunaBaru("");
      setNamaLengkapBaru("");
      setBangsalInputBaru("");
      setAlasanBuat("");
      setToastInfo({
        jenis: "berhasil",
        pesan: `Akun pengguna "${json.data.namaPengguna}" (${json.data.labelPeran}) berhasil dibuat dan dicatat dalam audit.`,
      });
      await muatDataPenggunaDanPeran();
    } finally {
      setSedangMenyimpanBaru(false);
    }
  }

  async function tanganiSimpanEditPengguna(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!penggunaDiedit) {
      return;
    }
    setToastInfo(null);
    setGalatUmum(null);

    const daftarBangsalId = editBangsalInput
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s.length > 0);

    setSedangMenyimpanEdit(true);
    try {
      const res = await fetch(`/api/v1/admin/users/${penggunaDiedit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          namaLengkap: editNamaLengkap.trim(),
          peran: editPeran,
          daftarBangsalId,
          aktif: editAktif,
          versi: penggunaDiedit.versi,
          alasanPerubahan: editAlasan.trim(),
        }),
      });

      const json =
        (await res.json()) as ResponsApi<RingkasanPenggunaAdminDto>;
      if (!json.sukses) {
        setGalatUmum({
          pesan: json.galat.pesan,
          kodeLaporan: json.galat.kodeLaporan,
        });
        return;
      }

      setPenggunaDiedit(null);
      setToastInfo({
        jenis: "berhasil",
        pesan: `Perubahan akun "${json.data.namaPengguna}" (versi v${json.data.versi}) berhasil disimpan.`,
      });
      await muatDataPenggunaDanPeran();
    } finally {
      setSedangMenyimpanEdit(false);
    }
  }

  async function tanganiKonfirmasiCabutSesi(): Promise<void> {
    if (!targetCabutSesi) {
      return;
    }
    setSedangProsesCabut(true);
    try {
      const res = await fetch(
        `/api/v1/admin/users/${targetCabutSesi.id}/revoke-sessions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            alasan: `Pencabutan paksa seluruh sesi aktif oleh Administrator untuk akun ${targetCabutSesi.namaPengguna}.`,
          }),
        },
      );
      const json = (await res.json()) as ResponsApi<{
        penggunaId: string;
        jumlahSesiDicabut: number;
      }>;
      if (json.sukses) {
        setToastInfo({
          jenis: "berhasil",
          pesan: `Berhasil mencabut ${json.data.jumlahSesiDicabut} sesi aktif milik ${targetCabutSesi.namaPengguna}.`,
        });
      } else {
        setGalatUmum({
          pesan: json.galat.pesan,
          kodeLaporan: json.galat.kodeLaporan,
        });
      }
    } finally {
      setSedangProsesCabut(false);
      setTargetCabutSesi(null);
    }
  }

  const totalHalaman = Math.max(1, Math.ceil(totalPengguna / ukuranHalaman));

  const kolomPengguna: readonly DefinisiKolomTabel<RingkasanPenggunaAdminDto>[] =
    [
      {
        id: "identitas",
        header: "Pengguna",
        renderSel: (baris) => (
          <div>
            <p className="font-semibold text-foreground">{baris.namaLengkap}</p>
            <p className="font-mono text-[11px] text-muted-foreground">
              @{baris.namaPengguna} • v{baris.versi}
            </p>
          </div>
        ),
      },
      {
        id: "peran",
        header: "Peran & Kewenangan",
        renderSel: (baris) => (
          <div className="space-y-1">
            <StatusBadge
              varian={baris.peran === "administrator" ? "netral" : "sesuai"}
              label={baris.labelPeran}
            />
            <p className="text-[11px] text-muted-foreground">
              {baris.daftarIzin.length} kode izin terdaftar
            </p>
          </div>
        ),
      },
      {
        id: "bangsal",
        header: "Penugasan Bangsal",
        renderSel: (baris) =>
          baris.daftarBangsalId.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {baris.daftarBangsalId.map((b) => (
                <span
                  key={b}
                  className="rounded border border-blue-800/30 bg-blue-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-blue-950"
                >
                  {b}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground">
              Lintas unit / Non-bangsal
            </span>
          ),
      },
      {
        id: "status",
        header: "Status Akun",
        renderSel: (baris) =>
          baris.aktif ? (
            <StatusBadge varian="sesuai" label="Aktif" />
          ) : (
            <StatusBadge varian="ditahan" label="Nonaktif" />
          ),
      },
      {
        id: "tindakan",
        header: "Tindakan",
        renderSel: (baris) => (
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => bukaFormEdit(baris)}
              className="min-h-7 rounded px-2 text-xs"
            >
              <SemanticIcon nama="Pencil" className="mr-1 size-3.5" />
              Ubah
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="xs"
              onClick={() => setTargetCabutSesi(baris)}
              className="min-h-7 rounded bg-red-700 px-2 text-xs text-white hover:bg-red-800"
            >
              <SemanticIcon nama="Trash2" className="mr-1 size-3.5" />
              Cabut Sesi
            </Button>
          </div>
        ),
      },
    ];

  return (
    <AppShellTemplate
      judulHalaman="Manajemen Pengguna, Peran, & Hak Akses"
      subjudulHalaman="Pengelolaan akun, penugasan bangsal, dan matriks izin tanpa akses ke keputusan klinis (AB-032)."
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
            detailKonteks="Halaman Manajemen Pengguna & Hak Akses hanya dapat diakses oleh pengguna dengan peran Administrator (AB-032)."
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
              onCobaLagi={() => void muatDataPenggunaDanPeran()}
            />
          ) : null}

          {/* Tabel Daftar Pengguna Aktif/Nonaktif */}
          <DataTableFoundation
            judulTabel="1. Daftar Akun Pengguna Rumah Sakit"
            deskripsiTabel="Kelola status akun, peran resmi BRD, dan cakupan bangsal. Setiap koreksi wajib disertai alasan audit (AB-030)."
            kolom={kolomPengguna}
            data={daftarPengguna}
            ambilKunciBaris={(b) => b.id}
            kataKunciCari={kataKunci}
            onUbahKataKunciCari={(nilai) => {
              setKataKunci(nilai);
              setHalaman(1);
            }}
            placeholderCari="Cari nama pengguna atau nama lengkap..."
            slotFilterTambahan={
              <>
                <label htmlFor="filter-peran" className="sr-only">
                  Filter Peran
                </label>
                <select
                  id="filter-peran"
                  value={filterPeran}
                  onChange={(e) => {
                    setFilterPeran(e.target.value);
                    setHalaman(1);
                  }}
                  className="h-8 rounded-md border border-input bg-white px-2.5 text-xs text-foreground"
                >
                  <option value="">Semua Peran (10 Peran)</option>
                  {PERAN_PENGGUNA.map((kode) => (
                    <option key={kode} value={kode}>
                      {MATRIKS_PERAN_MASTER[kode].nama}
                    </option>
                  ))}
                </select>

                <label htmlFor="filter-status-aktif" className="sr-only">
                  Filter Status Akun
                </label>
                <select
                  id="filter-status-aktif"
                  value={filterAktif}
                  onChange={(e) => {
                    setFilterAktif(e.target.value);
                    setHalaman(1);
                  }}
                  className="h-8 rounded-md border border-input bg-white px-2.5 text-xs text-foreground"
                >
                  <option value="">Semua Status</option>
                  <option value="true">Hanya Aktif</option>
                  <option value="false">Hanya Nonaktif</option>
                </select>
              </>
            }
            sedangMemuat={sedangMemuatTabel}
            halamanSaatIni={halaman}
            totalHalaman={totalHalaman}
            totalData={totalPengguna}
            onUbahHalaman={setHalaman}
          />

          {/* Panel Ubah Pengguna Terpilih (dengan Optimistic Concurrency Versi) */}
          {penggunaDiedit ? (
            <section
              aria-labelledby="judul-edit-pengguna"
              className="rounded-lg border-2 border-blue-700/40 bg-card p-5 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h2
                    id="judul-edit-pengguna"
                    className="text-sm font-bold text-foreground"
                  >
                    Ubah Akun Pengguna: @{penggunaDiedit.namaPengguna} (Versi v
                    {penggunaDiedit.versi})
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Perubahan memeriksa versi data saat ini untuk mencegah
                    tabrakan transaksi dan mencatat alasan ke log audit.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => setPenggunaDiedit(null)}
                  className="min-h-7 rounded px-2.5 text-xs"
                >
                  Batal Ubah
                </Button>
              </div>

              <form
                onSubmit={(e) => void tanganiSimpanEditPengguna(e)}
                className="grid grid-cols-1 gap-4 sm:grid-cols-2"
              >
                <FormFieldMolecule
                  id="edit-nama-lengkap"
                  label="Nama Lengkap Petugas"
                  wajib
                >
                  <input
                    id="edit-nama-lengkap"
                    type="text"
                    required
                    value={editNamaLengkap}
                    onChange={(e) => setEditNamaLengkap(e.target.value)}
                    className="h-9 rounded-md border border-input bg-white px-3 text-xs text-foreground"
                  />
                </FormFieldMolecule>

                <FormFieldMolecule
                  id="edit-peran"
                  label="Peran Resmi (BRD Bab III)"
                  wajib
                >
                  <select
                    id="edit-peran"
                    value={editPeran}
                    onChange={(e) =>
                      setEditPeran(e.target.value as PeranPengguna)
                    }
                    className="h-9 rounded-md border border-input bg-white px-3 text-xs text-foreground"
                  >
                    {PERAN_PENGGUNA.map((kode) => (
                      <option key={kode} value={kode}>
                        {MATRIKS_PERAN_MASTER[kode].nama}
                      </option>
                    ))}
                  </select>
                </FormFieldMolecule>

                <FormFieldMolecule
                  id="edit-bangsal"
                  label="Penugasan Bangsal (Pisahkan dengan koma)"
                  bantuan={
                    MATRIKS_PERAN_MASTER[editPeran].wajibBatasBangsal
                      ? "Wajib diisi minimal 1 bangsal untuk peran ini (contoh: BANGSAL-ANGGREK)."
                      : editPeran === "administrator"
                        ? "Wajib dikosongkan untuk Administrator (AB-032)."
                        : "Opsional untuk peran lintas unit."
                  }
                >
                  <input
                    id="edit-bangsal"
                    type="text"
                    value={editBangsalInput}
                    onChange={(e) => setEditBangsalInput(e.target.value)}
                    placeholder="Contoh: BANGSAL-ANGGREK, BANGSAL-MELATI"
                    className="h-9 rounded-md border border-input bg-white px-3 text-xs text-foreground"
                  />
                </FormFieldMolecule>

                <FormFieldMolecule
                  id="edit-status-aktif"
                  label="Status Keaktifan Akun"
                  bantuan="Menonaktifkan akun akan otomatis mencabut seluruh sesi aktif pengguna tersebut."
                >
                  <select
                    id="edit-status-aktif"
                    value={editAktif ? "true" : "false"}
                    onChange={(e) => setEditAktif(e.target.value === "true")}
                    className="h-9 rounded-md border border-input bg-white px-3 text-xs text-foreground"
                  >
                    <option value="true">Aktif (Diizinkan Masuk)</option>
                    <option value="false">
                      Nonaktif (Blokir & Cabut Sesi)
                    </option>
                  </select>
                </FormFieldMolecule>

                <FormFieldMolecule
                  id="edit-alasan"
                  label="Alasan Perubahan (Wajib untuk Audit AB-030)"
                  wajib
                  className="sm:col-span-2"
                >
                  <input
                    id="edit-alasan"
                    type="text"
                    required
                    minLength={5}
                    value={editAlasan}
                    onChange={(e) => setEditAlasan(e.target.value)}
                    placeholder="Contoh: Mutasi penugasan perawat ke Bangsal Melati sesuai SK Kepala Instalasi"
                    className="h-9 rounded-md border border-input bg-white px-3 text-xs text-foreground"
                  />
                </FormFieldMolecule>

                <div className="sm:col-span-2 flex justify-end gap-2">
                  <Button
                    type="submit"
                    disabled={sedangMenyimpanEdit}
                    className="min-h-9 rounded-md px-4 text-xs font-semibold"
                  >
                    <SemanticIcon nama="Save" className="mr-1.5 size-4" />
                    {sedangMenyimpanEdit
                      ? "Menyimpan..."
                      : "Simpan Perubahan Terverifikasi"}
                  </Button>
                </div>
              </form>
            </section>
          ) : null}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Formulir Buat Akun Pengguna Baru */}
            <section
              aria-labelledby="judul-buat-pengguna"
              className="rounded-lg border border-border bg-card p-5 space-y-4"
            >
              <div className="border-b border-border pb-3">
                <h2
                  id="judul-buat-pengguna"
                  className="text-sm font-bold text-foreground"
                >
                  2. Tambah Akun Pengguna Baru
                </h2>
                <p className="text-xs text-muted-foreground">
                  Buat akun petugas dengan peran resmi dan cakupan bangsal yang
                  sesuai.
                </p>
              </div>

              <form
                onSubmit={(e) => void tanganiBuatPenggunaBaru(e)}
                className="space-y-3"
              >
                <FormFieldMolecule
                  id="baru-nama-pengguna"
                  label="Nama Pengguna (Username)"
                  wajib
                  pesanGalat={galatFieldBuat.namaPengguna}
                >
                  <input
                    id="baru-nama-pengguna"
                    type="text"
                    required
                    value={namaPenggunaBaru}
                    onChange={(e) => setNamaPenggunaBaru(e.target.value)}
                    placeholder="Contoh: ahli.gizi.utama"
                    className="h-9 rounded-md border border-input bg-white px-3 text-xs text-foreground"
                  />
                </FormFieldMolecule>

                <FormFieldMolecule
                  id="baru-nama-lengkap"
                  label="Nama Lengkap Petugas (Data Sintetis)"
                  wajib
                  pesanGalat={galatFieldBuat.namaLengkap}
                >
                  <input
                    id="baru-nama-lengkap"
                    type="text"
                    required
                    value={namaLengkapBaru}
                    onChange={(e) => setNamaLengkapBaru(e.target.value)}
                    placeholder="Contoh: Ahli Gizi Klinis Bangsal Anggrek (Sintetis)"
                    className="h-9 rounded-md border border-input bg-white px-3 text-xs text-foreground"
                  />
                </FormFieldMolecule>

                <FormFieldMolecule
                  id="baru-kata-sandi"
                  label="Kata Sandi Awal"
                  wajib
                  pesanGalat={galatFieldBuat.kataSandi}
                >
                  <input
                    id="baru-kata-sandi"
                    type="password"
                    required
                    value={kataSandiBaru}
                    onChange={(e) => setKataSandiBaru(e.target.value)}
                    className="h-9 rounded-md border border-input bg-white px-3 text-xs text-foreground"
                  />
                </FormFieldMolecule>

                <FormFieldMolecule
                  id="baru-peran"
                  label="Peran Pengguna (10 Peran BRD)"
                  wajib
                  pesanGalat={galatFieldBuat.peran}
                >
                  <select
                    id="baru-peran"
                    value={peranBaru}
                    onChange={(e) =>
                      setPeranBaru(e.target.value as PeranPengguna)
                    }
                    className="h-9 rounded-md border border-input bg-white px-3 text-xs text-foreground"
                  >
                    {PERAN_PENGGUNA.map((kode) => (
                      <option key={kode} value={kode}>
                        {MATRIKS_PERAN_MASTER[kode].nama}
                      </option>
                    ))}
                  </select>
                </FormFieldMolecule>

                <FormFieldMolecule
                  id="baru-bangsal"
                  label="Kode Penugasan Bangsal"
                  bantuan={
                    MATRIKS_PERAN_MASTER[peranBaru].wajibBatasBangsal
                      ? "Wajib diisi untuk peran ini (contoh: BANGSAL-ANGGREK)."
                      : peranBaru === "administrator"
                        ? "Kosongkan untuk Administrator teknis (AB-032)."
                        : "Opsional untuk peran lintas bangsal."
                  }
                  pesanGalat={galatFieldBuat.daftarBangsalId}
                >
                  <input
                    id="baru-bangsal"
                    type="text"
                    value={bangsalInputBaru}
                    onChange={(e) => setBangsalInputBaru(e.target.value)}
                    placeholder="Contoh: BANGSAL-ANGGREK"
                    className="h-9 rounded-md border border-input bg-white px-3 text-xs text-foreground"
                  />
                </FormFieldMolecule>

                <FormFieldMolecule
                  id="baru-alasan"
                  label="Alasan Pembuatan Akun (Audit)"
                  wajib
                  pesanGalat={galatFieldBuat.alasan}
                >
                  <input
                    id="baru-alasan"
                    type="text"
                    required
                    value={alasanBuat}
                    onChange={(e) => setAlasanBuat(e.target.value)}
                    placeholder="Contoh: Penambahan petugas untuk uji operasional instalasi gizi"
                    className="h-9 rounded-md border border-input bg-white px-3 text-xs text-foreground"
                  />
                </FormFieldMolecule>

                <Button
                  type="submit"
                  disabled={sedangMenyimpanBaru}
                  className="min-h-9 rounded-md px-4 text-xs font-semibold"
                >
                  <SemanticIcon nama="Plus" className="mr-1.5 size-4" />
                  {sedangMenyimpanBaru
                    ? "Menyimpan..."
                    : "Buat Akun Pengguna"}
                </Button>
              </form>
            </section>

            {/* Matriks 10 Peran BRD & Pemisahan Kewenangan */}
            <section
              aria-labelledby="judul-matriks-peran"
              className="rounded-lg border border-border bg-card p-5 space-y-3"
            >
              <div className="border-b border-border pb-3">
                <h2
                  id="judul-matriks-peran"
                  className="text-sm font-bold text-foreground"
                >
                  3. Matriks 10 Peran BRD & Batas Kewenangan (AB-032)
                </h2>
                <p className="text-xs text-muted-foreground">
                  Administrator teknis dipisahkan dari izin klinis. Peran bangsal
                  dibatasi sesuai penugasan.
                </p>
              </div>

              <div className="max-h-[420px] overflow-y-auto divide-y divide-border pr-1">
                {matriksPeran.map((peran) => (
                  <article key={peran.kode} className="py-3 text-xs space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-foreground">
                        {peran.nama}{" "}
                        <span className="font-mono text-[11px] font-normal text-muted-foreground">
                          ({peran.kode})
                        </span>
                      </span>
                      <StatusBadge
                        varian={
                          peran.wajibBatasBangsal ? "menunggu" : "netral"
                        }
                        label={
                          peran.wajibBatasBangsal
                            ? "Wajib Batas Bangsal"
                            : "Lintas Unit"
                        }
                      />
                    </div>
                    <p className="text-muted-foreground">
                      {peran.deskripsiTanggungJawab}
                    </p>
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {peran.izinDefault.map((izin) => (
                        <span
                          key={izin}
                          className="rounded border border-border bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-700"
                        >
                          {izin}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </>
      )}

      {/* Dialog Konfirmasi Destruktif: Cabut Semua Sesi Pengguna */}
      <ConfirmDialog
        terbuka={targetCabutSesi !== null}
        onPerubahanTerbuka={(buka) => {
          if (!buka) {
            setTargetCabutSesi(null);
          }
        }}
        judul={
          targetCabutSesi
            ? `Cabut seluruh sesi aktif @${targetCabutSesi.namaPengguna}?`
            : "Cabut sesi pengguna?"
        }
        deskripsiDampak="Pengguna tersebut akan langsung dikeluarkan dari seluruh perangkat dan wajib melakukan autentikasi ulang. Tindakan ini dicatat dalam jejak audit."
        labelKonfirmasi="Cabut Seluruh Sesi"
        labelBatal="Kembali"
        varianTindakan="destruktif"
        sedangMemproses={sedangProsesCabut}
        onKonfirmasi={tanganiKonfirmasiCabutSesi}
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
