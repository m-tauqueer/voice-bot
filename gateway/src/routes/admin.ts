import type { FastifyInstance, FastifyReply } from "fastify";
import { createRequireOwner } from "../auth/owner.js";
import { callWorker } from "../clients/worker.js";
import type { GatewayConfig } from "../config.js";

async function sendWorker(reply: FastifyReply, response: Response) {
  const text = await response.text();
  let body: unknown = null;
  if (text.length > 0) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = { error: "worker_error" };
    }
  }
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (detail && typeof detail === "object") {
      body = detail;
    } else if (typeof detail === "string") {
      body = { error: detail };
    }
  }
  return reply.code(response.status).send(body);
}

export async function registerAdminRoutes(
  app: FastifyInstance,
  deps: { config: GatewayConfig },
): Promise<void> {
  const { config } = deps;
  const requireOwner = createRequireOwner(config);

  await app.register(
    async (admin) => {
      admin.addHook("preHandler", requireOwner);

      admin.get("/persona", async (_request, reply) => {
        const response = await callWorker(config, "/internal/admin/persona");
        return sendWorker(reply, response);
      });

      admin.put("/persona", async (request, reply) => {
        const response = await callWorker(config, "/internal/admin/persona", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(request.body ?? {}),
        });
        return sendWorker(reply, response);
      });

      admin.post("/teach", async (request, reply) => {
        const response = await callWorker(config, "/internal/admin/teach", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(request.body ?? {}),
        });
        return sendWorker(reply, response);
      });

      admin.get("/questions", async (_request, reply) => {
        const response = await callWorker(config, "/internal/admin/questions");
        return sendWorker(reply, response);
      });

      admin.post("/answer", async (request, reply) => {
        const response = await callWorker(config, "/internal/admin/answer", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(request.body ?? {}),
        });
        return sendWorker(reply, response);
      });

      admin.post("/ingest", async (request, reply) => {
        const uploaded = await request.file();
        if (!uploaded) {
          return reply.code(400).send({ error: "file required" });
        }
        const buffer = await uploaded.toBuffer();
        if (buffer.byteLength > config.ADMIN_INGEST_MAX_BYTES) {
          return reply.code(413).send({ error: "file too large" });
        }
        const form = new FormData();
        form.append(
          "file",
          new Blob([buffer], { type: uploaded.mimetype }),
          uploaded.filename,
        );
        const response = await callWorker(config, "/internal/admin/ingest", {
          method: "POST",
          body: form,
        });
        return sendWorker(reply, response);
      });

      admin.post("/subscribe", async (request, reply) => {
        const response = await callWorker(config, "/internal/admin/subscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(request.body ?? {}),
        });
        return sendWorker(reply, response);
      });
    },
    { prefix: "/api/admin" },
  );
}
