import { createGatewayApp } from "./app.js";
import { createPostgres, createRedis } from "./clients.js";
import { loadGatewayConfig } from "./config.js";

const config = loadGatewayConfig();
const sql = createPostgres(config);
const redis = createRedis(config);
const app = await createGatewayApp({ config, sql, redis });

app.addHook("onClose", async () => {
  await redis.quit();
  await sql.end({ timeout: 5 });
});

await app.listen({
  host: config.GATEWAY_HOST,
  port: config.GATEWAY_PORT,
});
