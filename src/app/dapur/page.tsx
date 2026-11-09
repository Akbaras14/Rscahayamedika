/**
 * @fileoverview Halaman Next.js App Router untuk Peran Petugas Dapur (`/dapur`).
 * Menyediakan ruang kerja perencanaan produksi H-1, kalkulasi kebutuhan bahan baku (AB-012, AB-014),
 * pengawasan batch memasak ber-CCP suhu >= 75 C (AB-018, AB-019), kontrol mutu organoleptik/suhu saji,
 * pengepakan & label porsi pasien (BRD 8.5), penahanan klinis (AB-010, AB-013), dan recall traceability (BRD 8.6).
 */

import { KitchenWorkspace } from "@/features/kitchen/components/kitchen-workspace";

export default function WorkspacePage() {
  return <KitchenWorkspace />;
}

