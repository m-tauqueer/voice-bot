/**
 * One signed-in user must never reach another user's conversation, including
 * the read API. Runs against the real HTTP handlers with two session cookies.
 */
import { randomUUID } from "node:crypto";
import { Writable } from "node:stream";
import pino from "pino";
import { createGatewayApp } from "../app.js";
import { persistAuthSession, signSessionCookieValue } from "../auth/session.js";
import { createPostgres, createRedis } from "../clients.js";
import {
  isOwnerEmail,
  loadGatewayConfig,
  rateLimitEnabled,
} from "../config.js";
import {
  decodeSessionCursor,
  encodeSessionCursor,
  resolveRangeId,
} from "../insights/parse.js";
import {
  ownerLatency,
  ownerOverview,
  personalSessionDetail,
} from "../insights/queries.js";
import { SESSION_CHANNEL } from "../schema.js";

let failed = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    console.log(`${name}=ok${detail ? ` ${detail}` : ""}`);
    return;
  }
  console.error(`${name}=FAIL${detail ? ` ${detail}` : ""}`);
  failed += 1;
}

const config = loadGatewayConfig();
const sql = createPostgres(config);
const redis = createRedis(config);
const logLines: string[] = [];
const logger = pino(
  { level: "info" },
  new Writable({
    write(chunk, _encoding, callback) {
      logLines.push(chunk.toString());
      callback();
    },
  }),
);
const app = await createGatewayApp({
  config,
  sql,
  redis,
  loggerInstance: logger,
});

function logged(message: string): boolean {
  return logLines.some((line) => line.includes(message));
}

try {
  const defaultRange = resolveRangeId(config, undefined);
  check("default_range_resolves", defaultRange.ok);
  check("unknown_range_rejected", !resolveRangeId(config, "not-a-range").ok);
  if (defaultRange.ok) {
    try {
      await ownerLatency(sql, config, defaultRange.id);
      check("owner_latency_sql_ok", true);
    } catch (error) {
      check(
        "owner_latency_sql_ok",
        false,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
  const cursor = encodeSessionCursor({
    started_at: new Date("2026-01-01T00:00:00.000Z"),
    id: "11111111-1111-1111-1111-111111111111",
  });
  const decoded = decodeSessionCursor(cursor);
  check(
    "session_cursor_roundtrip",
    decoded?.id === "11111111-1111-1111-1111-111111111111",
  );
  check("session_cursor_rejects_garbage", decodeSessionCursor("nope") === null);

  const users = await sql<
    { id: string; email: string; engram_user_id: string }[]
  >`
    SELECT id, email, engram_user_id FROM users ORDER BY created_at
  `;
  const owner = users.find((user) => isOwnerEmail(user.email, config)) ?? null;
  const other =
    users.find((user) => !isOwnerEmail(user.email, config)) ??
    users.find((user) => user.id !== owner?.id) ??
    null;

  const cookieFor = async (userId: string) => {
    const id = await persistAuthSession(redis, config, userId);
    return `${config.SESSION_COOKIE_NAME}=${signSessionCookieValue(config, id)}`;
  };

  const get = (path: string, cookie?: string) =>
    app.inject({
      method: "GET",
      url: path,
      headers: cookie ? { cookie } : {},
    });

  const post = (path: string, cookie: string, body: Record<string, unknown>) =>
    app.inject({
      method: "POST",
      url: path,
      headers: {
        cookie,
        "content-type": "application/json",
      },
      payload: JSON.stringify(body),
    });

  const anonymous = await get("/api/me");
  check(
    "anonymous_refused",
    anonymous.statusCode === 401,
    `${anonymous.statusCode}`,
  );
  const anonymousAdmin = await get("/api/admin/overview");
  check(
    "anonymous_admin_refused",
    anonymousAdmin.statusCode === 401,
    `${anonymousAdmin.statusCode}`,
  );

  if (rateLimitEnabled(config)) {
    check(
      "rate_limit_active",
      anonymous.headers["x-ratelimit-limit"] !== undefined,
      String(anonymous.headers["x-ratelimit-limit"] ?? ""),
    );
  } else {
    console.log("rate_limit_active=SKIP (RATE_LIMIT_ENABLED=false)");
  }

  const corsOk = await app.inject({
    method: "OPTIONS",
    url: "/api/me",
    headers: {
      origin: config.FRONTEND_ORIGIN,
      "access-control-request-method": "GET",
    },
  });
  check(
    "cors_allows_frontend_origin",
    corsOk.headers["access-control-allow-origin"] === config.FRONTEND_ORIGIN,
    String(corsOk.headers["access-control-allow-origin"] ?? ""),
  );
  check(
    "cors_allows_credentials",
    corsOk.headers["access-control-allow-credentials"] === "true",
  );
  const foreignOrigin = new URL(config.FRONTEND_ORIGIN);
  foreignOrigin.host = `not-${foreignOrigin.host}`;
  const corsForeign = await app.inject({
    method: "OPTIONS",
    url: "/api/me",
    headers: {
      origin: foreignOrigin.origin,
      "access-control-request-method": "GET",
    },
  });
  check(
    "cors_rejects_other_origin",
    corsForeign.headers["access-control-allow-origin"] !== foreignOrigin.origin,
  );

  if (!owner || !other || owner.id === other.id) {
    console.log("isolation=SKIP (needs an owner and a second app user)");
  } else {
    const ownerCookie = await cookieFor(owner.id);
    const otherCookie = await cookieFor(other.id);
    console.log(`owner=${owner.email}`);
    console.log(`other=${other.email}`);

    const meOwner = await get("/api/me", ownerCookie);
    const meOther = await get("/api/me", otherCookie);
    const ownerBody = meOwner.json() as Record<string, unknown>;
    const otherBody = meOther.json() as Record<string, unknown>;
    check(
      "separate_identities",
      meOwner.statusCode === 200 &&
        meOther.statusCode === 200 &&
        ownerBody.id === owner.id &&
        otherBody.id === other.id &&
        ownerBody.id !== otherBody.id,
    );
    check(
      "me_omits_engram_user_id",
      !Object.hasOwn(ownerBody, "engram_user_id"),
    );
    check("me_omits_google_sub", !Object.hasOwn(ownerBody, "google_sub"));

    const ownerMem = await get("/api/me/memories", ownerCookie);
    const otherMem = await get("/api/me/memories", otherCookie);

    if (ownerMem.statusCode === 404 || otherMem.statusCode === 404) {
      console.log("memories_panel_probe=SKIP (MEMORY_PANEL_ENABLED is off)");
    } else {
      check(
        "memory_panel_owner_ok",
        ownerMem.statusCode === 200,
        `${ownerMem.statusCode}`,
      );
      check(
        "memory_panel_other_ok",
        otherMem.statusCode === 200,
        `${otherMem.statusCode}`,
      );

      if (ownerMem.statusCode !== 200 || otherMem.statusCode !== 200) {
        console.log("memory_panel_probe=SKIP (non-200 response)");
      } else {
        function privateEngramUserId(tenant: unknown): string | null {
          if (typeof tenant !== "string") return null;
          const parts = tenant.split(":");
          // Engram private tenant is `{org}:{persona}:{user}`.
          if (parts.length !== 3) return null;
          return parts[2] ?? null;
        }

        const ownerPanel = ownerMem.json() as {
          memories?: { tenant?: string | null }[];
        };
        const otherPanel = otherMem.json() as {
          memories?: { tenant?: string | null }[];
        };

        const ownerPrivateTenants = new Set(
          (ownerPanel.memories ?? [])
            .map((m) => privateEngramUserId(m.tenant))
            .filter((v): v is string => typeof v === "string" && v.length > 0),
        );
        const otherPrivateTenants = new Set(
          (otherPanel.memories ?? [])
            .map((m) => privateEngramUserId(m.tenant))
            .filter((v): v is string => typeof v === "string" && v.length > 0),
        );

        check(
          "memory_panel_owner_never_leaks_other_private_tenant",
          !ownerPrivateTenants.has(other.engram_user_id),
        );
        check(
          "memory_panel_other_never_leaks_owner_private_tenant",
          !otherPrivateTenants.has(owner.engram_user_id),
        );
      }
    }

    const [ownerSession] = await sql<{ id: string }[]>`
      SELECT s.id FROM sessions s
      WHERE s.user_id = ${owner.id}
        AND EXISTS (SELECT 1 FROM turns t WHERE t.session_id = s.id)
      ORDER BY s.started_at DESC LIMIT 1
    `;
    if (!ownerSession) {
      console.log("session_read=SKIP (owner has no session with turns)");
    } else {
      const mine = await get(
        `/api/chat?session_id=${ownerSession.id}`,
        ownerCookie,
      );
      const mineBody = mine.json() as { turns?: unknown[] };
      check(
        "owner_reads_own_session",
        mine.statusCode === 200 && (mineBody.turns?.length ?? 0) > 0,
        `${mine.statusCode}, ${mineBody.turns?.length ?? 0} turns`,
      );

      const stolen = await get(
        `/api/chat?session_id=${ownerSession.id}`,
        otherCookie,
      );
      const stolenBody = stolen.json() as { turns?: unknown[] };
      const leaked = (stolenBody.turns?.length ?? 0) > 0;
      check(
        "other_user_reads_nothing",
        stolen.statusCode === 404 && !leaked,
        `${stolen.statusCode}, ${stolenBody.turns?.length ?? 0} turns returned`,
      );
      check("other_user_chat_read_logged", logged("chat session not found"));

      const posted = await post("/api/chat", otherCookie, {
        text: "reading someone else's thread",
        session_id: ownerSession.id,
      });
      check(
        "other_user_cannot_write",
        posted.statusCode >= 400,
        `HTTP ${posted.statusCode}`,
      );
      check("other_user_chat_write_logged", logged("chat session not found"));

      const [audio] = await sql<{ n: string }[]>`
        SELECT count(*)::text AS n
        FROM audio_assets a
        INNER JOIN turns t ON t.id = a.turn_id
        INNER JOIN sessions s ON s.id = t.session_id
        WHERE s.user_id <> ${owner.id} AND t.session_id = ${ownerSession.id}
      `;
      check(
        "audio_scoped_to_owner",
        audio?.n === "0",
        `${audio?.n ?? "?"} rows reachable from another user`,
      );

      const stolenInsight = await get(
        `/api/me/sessions/${ownerSession.id}`,
        otherCookie,
      );
      check(
        "other_user_insight_session_404",
        stolenInsight.statusCode === 404,
        `${stolenInsight.statusCode}`,
      );
      const stolenJson = stolenInsight.json() as { error?: string };
      check(
        "other_user_insight_session_no_confirm",
        stolenJson.error === config.INSIGHTS_ERROR_NOT_FOUND,
      );
      check(
        "other_user_insight_session_no_email",
        !JSON.stringify(stolenJson).includes(owner.email),
      );
      check(
        "other_user_insight_session_logged",
        logged("personal session not found"),
      );

      const ownInsight = await get(
        `/api/me/sessions/${ownerSession.id}`,
        ownerCookie,
      );
      check(
        "owner_insight_session_ok",
        ownInsight.statusCode === 200,
        `${ownInsight.statusCode}`,
      );
    }

    const adminPaths = [
      "/api/admin/overview",
      "/api/admin/activity",
      "/api/admin/latency",
      "/api/admin/sessions",
      "/api/admin/users",
      "/api/admin/persona",
      "/api/admin/quota",
    ];
    for (const path of adminPaths) {
      const refused = await get(path, otherCookie);
      check(
        `other_user_forbidden_${path}`,
        refused.statusCode === 403,
        `${refused.statusCode}`,
      );
    }
    check("other_user_admin_logged", logged("owner route refused"));
    if (ownerSession) {
      const adminStolen = await get(
        `/api/admin/sessions/${ownerSession.id}`,
        otherCookie,
      );
      check(
        "other_user_forbidden_admin_session",
        adminStolen.statusCode === 403,
        `${adminStolen.statusCode}`,
      );
    }

    const meSessions = await get("/api/me/sessions", otherCookie);
    check("other_user_lists_own_sessions", meSessions.statusCode === 200);
    if (meSessions.statusCode === 200) {
      const listed = meSessions.json() as { sessions?: { user_id?: string }[] };
      const leakedList = (listed.sessions ?? []).some(
        (session) => session.user_id !== other.id,
      );
      check("other_user_session_list_scoped", !leakedList);
    }

    const meOverview = await get("/api/me/overview", otherCookie);
    check("other_user_personal_overview", meOverview.statusCode === 200);

    if (defaultRange.ok) {
      const overviewHttp = await get(
        `/api/admin/overview?range=${encodeURIComponent(defaultRange.id)}`,
        ownerCookie,
      );
      check(
        "owner_overview_ok",
        overviewHttp.statusCode === 200,
        `${overviewHttp.statusCode}`,
      );
      if (overviewHttp.statusCode === 200) {
        const fromHttp = overviewHttp.json() as Awaited<
          ReturnType<typeof ownerOverview>
        >;
        const fromSql = await ownerOverview(sql, config, defaultRange.id);
        check(
          "owner_overview_matches_sql",
          fromHttp.sessions === fromSql.sessions &&
            fromHttp.turns === fromSql.turns &&
            fromHttp.active_users === fromSql.active_users &&
            fromHttp.median_first_word_ms === fromSql.median_first_word_ms &&
            fromHttp.p90_first_word_ms === fromSql.p90_first_word_ms &&
            fromHttp.error_rate === fromSql.error_rate &&
            JSON.stringify(fromHttp.brain_mode_split) ===
              JSON.stringify(fromSql.brain_mode_split),
        );
      }

      const latencyHttp = await get(
        `/api/admin/latency?range=${encodeURIComponent(defaultRange.id)}`,
        ownerCookie,
      );
      check(
        "owner_latency_ok",
        latencyHttp.statusCode === 200,
        `${latencyHttp.statusCode}`,
      );

      const badRange = await get(
        "/api/admin/overview?range=not-a-range",
        ownerCookie,
      );
      check(
        "unknown_range_is_400",
        badRange.statusCode === 400,
        `${badRange.statusCode}`,
      );
    }
  }

  const [persona] = await sql<{ id: string }[]>`
    SELECT id FROM personas ORDER BY created_at LIMIT 1
  `;
  const scopeUser = other ?? owner ?? users[0] ?? null;
  if (persona && scopeUser) {
    const marker = randomUUID();
    const [tempUser] = await sql<{ id: string }[]>`
      INSERT INTO users (google_sub, email, engram_user_id)
      VALUES (${`probe-${marker}`}, ${`probe-${marker}@example.test`}, ${marker})
      RETURNING id
    `;
    if (tempUser) {
      const [tempSession] = await sql<{ id: string }[]>`
        INSERT INTO sessions (user_id, persona_id, channel)
        VALUES (${tempUser.id}, ${persona.id}, ${SESSION_CHANNEL.TEXT})
        RETURNING id
      `;
      try {
        if (tempSession) {
          const leaked = await personalSessionDetail(
            sql,
            tempSession.id,
            scopeUser.id,
          );
          check("query_hides_other_session", leaked === null);
          const own = await personalSessionDetail(
            sql,
            tempSession.id,
            tempUser.id,
          );
          check(
            "query_returns_own_session",
            own !== null && own.id === tempSession.id,
          );
        }
      } finally {
        if (tempSession) {
          await sql`DELETE FROM sessions WHERE id = ${tempSession.id}`;
        }
        await sql`DELETE FROM users WHERE id = ${tempUser.id}`;
      }
    }
  }
} finally {
  await app.close();
  await redis.quit();
  await sql.end({ timeout: 5 });
}

if (failed) {
  console.error(`FAIL: ${failed} check(s)`);
  process.exit(1);
}
console.log("PROBE_OK");
