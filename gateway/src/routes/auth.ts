import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Redis } from "ioredis";
import type postgres from "postgres";
import { z } from "zod";
import { SignInError } from "../auth/errors.js";
import {
  buildGoogleAuthorizationUrl,
  createOauthSecrets,
  exchangeAuthorizationCode,
  verifyGoogleIdToken,
} from "../auth/google.js";
import { createRequireAppUser } from "../auth/guard.js";
import {
  createSession,
  destroySession,
  storeOauthPending,
  takeOauthPending,
} from "../auth/session.js";
import { subscribeUserToActivePersona } from "../auth/subscribe.js";
import { upsertGoogleUser } from "../auth/users.js";
import {
  type GatewayConfig,
  frontendPathRedirect,
  googleCallbackPath,
  isOwnerEmail,
  postLoginRedirectUrl,
} from "../config.js";

type Sql = ReturnType<typeof postgres>;

const callbackQuerySchema = z.object({
  code: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  error: z.string().optional(),
});

const googleStartQuerySchema = z.object({
  next: z.string().optional(),
});

export async function registerAuthRoutes(
  app: FastifyInstance,
  deps: {
    config: GatewayConfig;
    sql: Sql;
    redis: Redis;
  },
): Promise<void> {
  const { config, sql, redis } = deps;
  const requireAppUser = createRequireAppUser(deps);

  app.get("/auth/google", async (request, reply) => {
    const start = googleStartQuerySchema.parse(request.query);
    const secrets = createOauthSecrets(config);
    await storeOauthPending(redis, config, secrets.state, {
      nonce: secrets.nonce,
      code_verifier: secrets.codeVerifier,
      next: frontendPathRedirect(config, start.next),
    });
    const url = await buildGoogleAuthorizationUrl(config, {
      state: secrets.state,
      nonce: secrets.nonce,
      codeChallenge: secrets.codeChallenge,
    });
    return reply.redirect(url);
  });

  app.get(googleCallbackPath(config), async (request, reply) => {
    try {
      const query = callbackQuerySchema.parse(request.query);
      if (query.error || !query.code || !query.state) {
        throw new SignInError(query.error ?? "missing code or state");
      }
      const pending = await takeOauthPending(redis, config, query.state);
      if (!pending) {
        throw new SignInError("state mismatch");
      }
      const idToken = await exchangeAuthorizationCode(config, {
        code: query.code,
        codeVerifier: pending.code_verifier,
      });
      const identity = await verifyGoogleIdToken(
        config,
        idToken,
        pending.nonce,
      );
      const user = await upsertGoogleUser(sql, identity);
      await subscribeUserToActivePersona(sql, config, user, request.log);
      await createSession(redis, reply, config, user.id);
      const next = frontendPathRedirect(config, pending.next);
      if (next) {
        return reply.redirect(new URL(next, config.FRONTEND_ORIGIN).toString());
      }
      return reply.redirect(postLoginRedirectUrl(config));
    } catch (error) {
      if (error instanceof SignInError) {
        request.log.warn({ reason: error.reason }, "google sign-in failed");
        return reply.code(401).send({ error: "Sign-in failed" });
      }
      request.log.error(error, "google sign-in error");
      return reply.code(500).send({ error: "Sign-in failed" });
    }
  });

  async function logout(request: FastifyRequest, reply: FastifyReply) {
    await destroySession(redis, request, reply, config);
    if (request.method === "GET") {
      const next = frontendPathRedirect(
        config,
        googleStartQuerySchema.parse(request.query).next,
      );
      if (next) {
        return reply.redirect(new URL(next, config.FRONTEND_ORIGIN).toString());
      }
      return reply.redirect(postLoginRedirectUrl(config));
    }
    return reply.code(204).send();
  }

  app.get("/auth/logout", logout);
  app.post("/auth/logout", logout);

  app.addHook("preHandler", async (request, reply) => {
    const path = request.url.split("?")[0] ?? "";
    if (path !== "/api" && !path.startsWith("/api/")) {
      return;
    }
    await requireAppUser(request, reply);
  });

  app.get("/api/me", async (request, reply) => {
    const user = request.appUser;
    if (!user) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    return {
      id: user.id,
      email: user.email,
      owner: isOwnerEmail(user.email, config),
    };
  });
}
