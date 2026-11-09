/**
 * @fileoverview Halaman Rute Next.js untuk Portal Web Terpadu Berbasis Peran (/portal).
 * Menampilkan ruang kerja adaptif sesuai peran aktif pengguna (Administrator, Petugas Pendaftaran, Dokter DPJP, Perawat, dll).
 */

import { RolePortalWorkspace } from "@/features/portal/components/role-portal-workspace";

export default function PortalPage() {
  return <RolePortalWorkspace />;
}

