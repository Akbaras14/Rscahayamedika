/**
 * @fileoverview Route Handler tipis Next.js (`/api/v1/[...slug]`) yang meneruskan permintaan
 * ke API Gateway HPNMS dengan tetap mempertahankan header korelasi, cookie HttpOnly, dan status HTTP.
 */

import { type NextRequest, NextResponse } from "next/server";
import { ambilGatewayAppBff } from "@/lib/server-gateway";

async function teruskanKeGateway(
  request: NextRequest,
  context: { params: Promise<{ slug: string[] }> },
): Promise<NextResponse> {
  const { slug } = await context.params;
  let app;
  try {
    app = await ambilGatewayAppBff();
  } catch {
    return NextResponse.json({ sukses: false, galat: { kode: "ERR_GANGGUAN_INTERNAL", pesan: "Database lokal belum tersedia. Periksa koneksi MySQL dan konfigurasi .env, lalu coba lagi.", kodeLaporan: "DB-LOCAL" } }, { status: 503 });
  }

  const pathTarget = `/v1/${slug.join("/")}${request.nextUrl.search}`;
  const metode = request.method as
    | "GET"
    | "POST"
    | "PATCH"
    | "PUT"
    | "DELETE";

  const headers: Record<string, string> = {};
  request.headers.forEach((nilai, kunci) => {
    headers[kunci] = nilai;
  });

  let payload: string | undefined;
  if (metode !== "GET" && metode !== "DELETE") {
    const teksBody = await request.text();
    payload = teksBody.length > 0 ? teksBody : undefined;
  }

  const hasil = await app.inject({
    method: metode,
    url: pathTarget,
    headers,
    payload,
  });

  const responseHeaders = new Headers();
  for (const [kunci, nilai] of Object.entries(hasil.headers)) {
    if (nilai === undefined) {
      continue;
    }
    if (Array.isArray(nilai)) {
      for (const item of nilai) {
        responseHeaders.append(kunci, String(item));
      }
    } else {
      responseHeaders.set(kunci, String(nilai));
    }
  }

  return new NextResponse(hasil.body, {
    status: hasil.statusCode,
    headers: responseHeaders,
  });
}

export const GET = teruskanKeGateway;
export const POST = teruskanKeGateway;
export const PATCH = teruskanKeGateway;
export const PUT = teruskanKeGateway;
export const DELETE = teruskanKeGateway;

