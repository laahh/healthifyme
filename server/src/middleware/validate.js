import { ValidationError } from "../domain/errors/AppError.js";

/**
 * @param {import('zod').ZodSchema} schema
 */
export function validateBody(schema) {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join("; ");
      next(new ValidationError(msg || "Invalid body"));
      return;
    }
    req.body = parsed.data;
    next();
  };
}
