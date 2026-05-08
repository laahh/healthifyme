import { AppError } from "../domain/errors/AppError.js";
import { env } from "../config/env.js";

/**
 * @type {import('express').ErrorRequestHandler}
 */
export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError && err.isOperational) {
    res.status(err.statusCode).json({
      error: err.message,
    });
    return;
  }

  console.error(err);
  const message =
    env.NODE_ENV === "production" ? "Terjadi kesalahan server." : err.message;
  res.status(500).json({ error: message });
}
