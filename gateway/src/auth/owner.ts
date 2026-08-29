import type { FastifyReply, FastifyRequest } from "fastify";
import { type GatewayConfig, isOwnerEmail } from "../config.js";

export function createRequireOwner(config: GatewayConfig) {
  return async function requireOwner(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const user = request.appUser;
    if (!user || !isOwnerEmail(user.email, config)) {
      return reply.code(403).send({ error: "forbidden" });
    }
  };
}
