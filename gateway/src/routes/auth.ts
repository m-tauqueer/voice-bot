import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Redis } from "ioredis";
import type postgres from "postgres";
import { z } from "zod";
import { nextSignInAction } from "../access/decision.js";
import { meAccessLabels, resolveMeView } from "../access/me.js";
import {
  getAccessByGoogleSub,
  upsertActiveAccess,
  upsertWaitlistRequest,
} from "../access/store.js";
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
  createSessionFromRecord,
  destroySession,
  readSessionRecord,
  sessionAppUserId,
  sessionGoogleSub,
  sessionIdentityEmail,
  storeOauthPending,
  takeOauthPending,
} from "../auth/session.js";
import { subscribeUserToActivePersona } from "../auth/subscribe.js";
import {
  getUserByGoogleSub,
  getUserById,
  upsertGoogleUser,
} from "../auth/users.js";
import {
  type GatewayConfig,
  frontendPathRedirect,
  googleCallbackPath,
  isOwnerEmail,
  postLoginRedirectUrl,
  waitlistRedirectUrl,
} from "../config.js";
import { ACCESS_STATUS, SESSION_KIND } from "../schema.js";

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
      const existing = await getUserByGoogleSub(sql, identity.sub);
      const access = await getAccessByGoogleSub(sql, identity.sub);
      const action = nextSignInAction({
        owner: isOwnerEmail(identity.email, config),
        hasUser: existing !== null,
        requestStatus: access?.status ?? null,
      });
      if (action.type === "provision") {
        const user = await upsertGoogleUser(sql, identity);
        await upsertActiveAccess(sql, identity, user.id);
        await subscribeUserToActivePersona(sql, config, user, request.log);
        await createSession(redis, reply, config, user.id);
        const next = frontendPathRedirect(config, pending.next);
        if (next) {
          return reply.redirect(
            new URL(next, config.FRONTEND_ORIGIN).toString(),
          );
        }
        return reply.redirect(postLoginRedirectUrl(config));
      }
      if (action.type === "waitlist") {
        await upsertWaitlistRequest(sql, identity);
        await createSessionFromRecord(redis, reply, config, {
          kind: SESSION_KIND.WAITLIST,
          google_sub: identity.sub,
          email: identity.email,
          status: ACCESS_STATUS.REQUESTED,
        });
        return reply.redirect(waitlistRedirectUrl(config));
      }
      await createSessionFromRecord(redis, reply, config, {
        kind: SESSION_KIND.REFUSED,
        google_sub: identity.sub,
        email: identity.email,
        status: action.status,
      });
      return reply.redirect(waitlistRedirectUrl(config));
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
    if (path === "/api/me") {
      return;
    }
    await requireAppUser(request, reply);
  });

  app.get("/api/me", async (request, reply) => {
    const record = await readSessionRecord(redis, request, config);
    if (!record) {
      return reply.code(401).send({ error: config.ACCESS_ERROR_UNAUTHORIZED });
    }
    const appUserId = sessionAppUserId(record);
    const googleSub = sessionGoogleSub(record);
    const user = appUserId ? await getUserById(sql, appUserId) : null;
    const access = googleSub
      ? await getAccessByGoogleSub(sql, googleSub)
      : user
        ? await getAccessByGoogleSub(sql, user.googleSub)
        : null;
    const email = user?.email ?? access?.email ?? sessionIdentityEmail(record);
    const view = resolveMeView({
      hasMemberSession: appUserId !== null,
      user,
      requestStatus: access?.status ?? null,
      email,
      owner: email ? isOwnerEmail(email, config) : false,
      labels: meAccessLabels(config),
    });
    if (view.http === 401) {
      return reply.code(401).send({ error: config.ACCESS_ERROR_UNAUTHORIZED });
    }
    return view.body;
  });
}
