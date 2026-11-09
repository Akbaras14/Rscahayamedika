/**
 * @fileoverview Titik masuk native (tanpa Docker) untuk API Gateway HPNMS.
 */

import { bangunGatewayMySql } from "./database/mysql-gateway.ts";

async function mulaiServerGateway(): Promise<void> {
  const host = process.env.API_GATEWAY_HOST ?? "127.0.0.1";
  const port = Number(process.env.API_GATEWAY_PORT ?? 4000);
  const { app } = await bangunGatewayMySql();

  await app.listen({ host, port });
  app.log.info(`API Gateway berjalan secara native di http://${host}:${port}`);
}

const dijalankanLangsung =
  typeof process.argv[1] === "string" &&
  process.argv[1].includes("api-gateway");

if (dijalankanLangsung) {
  mulaiServerGateway().catch((galat: unknown) => {
    console.error("Gagal menjalankan API Gateway:", galat);
    process.exit(1);
  });
}
