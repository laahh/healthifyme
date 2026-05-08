import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(8787),
  MYSQL_HOST: z.string().min(1),
  MYSQL_PORT: z.coerce.number().default(3306),
  MYSQL_USER: z.string().min(1),
  MYSQL_PASSWORD: z.string().default(""),
  MYSQL_DATABASE: z.string().min(1),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  /** Nama kolom urutan di `exercise_instructions` (mis. sort_order). Kosongkan untuk auto-deteksi. */
  EXERCISE_INSTRUCTION_ORDER_COLUMN: z.string().max(64).optional(),
  /** Nama kolom teks langkah di `exercise_instructions` (mis. body). Kosongkan untuk auto-deteksi. */
  EXERCISE_INSTRUCTION_TEXT_COLUMN: z.string().max(64).optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export function parseCorsOrigins(value) {
  const v = String(value || "").trim();
  if (!v || v === "*") return true;
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}
