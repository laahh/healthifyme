import { UnauthorizedError } from "../domain/errors/AppError.js";
import { verifyAccessToken } from "../utils/jwt.js";

export function requireAuth(req, _res, next) {
  try {
    const h = req.headers.authorization;
    if (!h || !String(h).startsWith("Bearer ")) {
      throw new UnauthorizedError("Sesi tidak valid.");
    }
    const token = String(h).slice(7).trim();
    if (!token) {
      throw new UnauthorizedError("Sesi tidak valid.");
    }
    const { sub, email } = verifyAccessToken(token);
    req.auth = { userId: sub, email };
    next();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      next(e);
      return;
    }
    next(new UnauthorizedError("Sesi tidak valid."));
  }
}
