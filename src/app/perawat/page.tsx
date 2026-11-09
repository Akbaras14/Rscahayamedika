/**
 * @fileoverview Halaman Next.js App Router untuk Peran Perawat (`/perawat`).
 * Menyediakan ruang kerja asuhan keperawatan bangsal: verifikasi keamanan makanan (AB-003, AB-008, AB-020),
 * skrining risiko gizi Malnutrition Screening Tool / MST (BRD Bab V.5.2), dan observasi asupan Comstock (X.10.1).
 */

import { NursingWorkspace } from "@/features/nursing/components/nursing-workspace";

export default function WorkspacePage() {
  return <NursingWorkspace />;
}

