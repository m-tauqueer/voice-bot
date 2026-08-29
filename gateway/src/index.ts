import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import pino from "pino";
import { loadGatewayConfig } from "./config.js";

const config = loadGatewayConfig();

const logger = pino({
  level: config.LOG_LEVEL,
  ...(config.NODE_ENV === "development"
    ? { transport: { target: "pino-pretty" } }
    : {}),
});

const app = Fastify({ logger });

await app.register(cors, {
  origin: config.FRONTEND_ORIGIN,
});
await app.register(websocket);

app.get("/health", async () => ({
  ok: true,
  service: "gateway",
}));

await app.listen({
  host: config.GATEWAY_HOST,
  port: config.GATEWAY_PORT,
});
