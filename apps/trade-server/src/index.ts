import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authMiddleware } from "./middleware/auth";
import { tradingRoutes } from "./routes/trading";
import { webhookRoutes } from "./routes/webhooks";
import { healthRoutes } from "./routes/health";

const app = new Hono();

// Global middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: [
      "http://localhost:3000",
      "https://app.snoball.com",
      process.env.FRONTEND_URL || "http://localhost:3000",
    ].filter(Boolean),
    credentials: true,
  }),
);

// Health check endpoint (no auth required)
app.route("/health", healthRoutes);

// Webhook endpoints (no auth required, signature validation instead)
app.route("/api/webhooks", webhookRoutes);

// Protected API routes
app.use("/api/trading/*", authMiddleware);
app.route("/api/trading", tradingRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not found" }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error("Server error:", err);
  return c.json(
    {
      error: "Internal server error",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    },
    500,
  );
});

const port = parseInt(process.env.PORT || "9090");

console.log(`🚀 Trade server starting on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};

