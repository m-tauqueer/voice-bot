import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import { createPostgres, createRedis } from "./clients.js";
import { loadGatewayConfig } from "./config.js";
import { registerAuthRoutes } from "./routes/auth.js";

const config = loadGatewayConfig();
const sql = createPostgres(config);
const redis = createRedis(config);

const app = Fastify({
  logger: {
    level: config.LOG_LEVEL,
    ...(config.NODE_ENV === "development"
      ? { transport: { target: "pino-pretty" } }
      : {}),
  },
});

await app.register(cors, {
  origin: config.FRONTEND_ORIGIN,
  credentials: true,
});
await app.register(cookie, {
  secret: config.SESSION_SECRET,
});
await app.register(websocket);
await registerAuthRoutes(app, { config, sql, redis });

app.get("/health", async () => ({
  ok: true,
  service: "gateway",
}));

app.addHook("onClose", async () => {
  await redis.quit();
  await sql.end({ timeout: 5 });
});

await app.listen({
  host: config.GATEWAY_HOST,
  port: config.GATEWAY_PORT,
});
