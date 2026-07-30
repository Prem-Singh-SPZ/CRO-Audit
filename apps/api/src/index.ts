import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import analyze from "./routes/analyze";
import mockup from "./routes/mockup";

const app = new Hono();

function parseCorsOrigins(): string[] | "*" {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (!raw || raw === "*") return "*";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const origins = parseCorsOrigins();

app.use(
  "*",
  cors({
    origin: origins === "*" ? "*" : origins,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    maxAge: 86400,
  })
);

app.get("/health", (c) =>
  c.json({ ok: true, service: "cro-audit-api", ts: new Date().toISOString() })
);

app.route("/api/analyze", analyze);
app.route("/api/mockup", mockup);

app.notFound((c) => c.json({ error: "Not found" }, 404));

const port = Number.parseInt(process.env.PORT ?? "4000", 10) || 4000;

console.log(`[api] listening on :${port}`);
serve({ fetch: app.fetch, port });

export default app;
