/**
 * @fileoverview Halaman Next.js App Router untuk Peran Ahli Gizi / Dietisien (`/ahli-gizi`).
 * Menyediakan ruang kerja asuhan gizi klinis terstandar: Asesmen ADIME & target gizi (AB-009, AB-020, AB-027),
 * penyusunan & pengesahan rencana menu individual aman alergen (AB-007, AB-011, AB-014), dan monitoring/evaluasi berkala (AB-026, AB-028).
 */

import { DietitianWorkspace } from "@/features/dietitian/components/dietitian-workspace";

export default function WorkspacePage() {
  return <DietitianWorkspace />;
}

