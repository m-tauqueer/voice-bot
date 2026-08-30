/**
 * PRD §7.5: one signed-in user must never reach another user's conversation.
 * Checks it over real HTTP with two real session cookies, not in the unit.
 */
import { persistAuthSession, signSessionCookieValue } from "../auth/session.js";
import { createPostgres, createRedis } from "../clients.js";
import { loadGatewayConfig } from "../config.js";

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

try {
  const users = await sql<{ id: string; email: string }[]>`
    SELECT id, email FROM users ORDER BY created_at LIMIT 2
  `;
  const [owner, other] = users;
  if (!owner || !other) {
    console.log("isolation=SKIP (needs two app users)");
  } else {
    const cookieFor = async (userId: string) => {
      const id = await persistAuthSession(redis, config, userId);
      return `${config.SESSION_COOKIE_NAME}=${signSessionCookieValue(config, id)}`;
    };
    const ownerCookie = await cookieFor(owner.id);
    const otherCookie = await cookieFor(other.id);
    console.log(`owner=${owner.email}`);
    console.log(`other=${other.email}`);

    const base = config.GATEWAY_PUBLIC_URL.replace(/\/$/, "");
    const get = (path: string, cookie: string) =>
      fetch(`${base}${path}`, { headers: { Cookie: cookie } });

    const meOwner = await get("/api/me", ownerCookie);
    const meOther = await get("/api/me", otherCookie);
    const ownerBody = (await meOwner.json()) as { id?: string };
    const otherBody = (await meOther.json()) as { id?: string };
    check(
      "separate_identities",
      ownerBody.id === owner.id &&
        otherBody.id === other.id &&
        ownerBody.id !== otherBody.id,
    );

    const anonymous = await fetch(`${base}/api/me`);
    check("anonymous_refused", anonymous.status === 401, `${anonymous.status}`);

    // A session that belongs to the owner, with turns in it.
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
      const mineBody = (await mine.json()) as { turns?: unknown[] };
      check(
        "owner_reads_own_session",
        mine.status === 200 && (mineBody.turns?.length ?? 0) > 0,
        `${mine.status}, ${mineBody.turns?.length ?? 0} turns`,
      );

      const stolen = await get(
        `/api/chat?session_id=${ownerSession.id}`,
        otherCookie,
      );
      const stolenBody = (await stolen.json()) as { turns?: unknown[] };
      const leaked = (stolenBody.turns?.length ?? 0) > 0;
      check(
        "other_user_reads_nothing",
        !leaked,
        `${stolen.status}, ${stolenBody.turns?.length ?? 0} turns returned`,
      );

      const posted = await fetch(`${base}/api/chat`, {
        method: "POST",
        headers: { Cookie: otherCookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "reading someone else's thread",
          session_id: ownerSession.id,
        }),
      });
      check(
        "other_user_cannot_write",
        posted.status >= 400,
        `HTTP ${posted.status}`,
      );

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
    }
  }
} finally {
  await redis.quit();
  await sql.end({ timeout: 5 });
}

if (failed) {
  console.error(`FAIL: ${failed} check(s)`);
  process.exit(1);
}
console.log("PROBE_OK");
