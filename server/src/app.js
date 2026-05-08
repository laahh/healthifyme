import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env, parseCorsOrigins } from "./config/env.js";
import { apiRouter } from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { pingDatabase } from "./config/database.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "2mb" }));

  const origins = parseCorsOrigins(env.CORS_ORIGIN);
  app.use(
    cors({
      origin: origins,
      credentials: true,
    })
  );

  app.get("/health", async (_req, res, next) => {
    try {
      await pingDatabase();
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  app.use("/api/v1", apiRouter);

  app.use(errorHandler);

  return app;
}
