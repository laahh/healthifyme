import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load server/.env then parent repo .env (API often started from server/).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../server/.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

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
  /**
   * Vertex AI (prioritas). Set VERTEX_PROJECT_ID + kredensial ADC/service account
   * (GOOGLE_APPLICATION_CREDENTIALS=path/ke/sa.json). Proxy `/me/ai/gemini-*`.
   */
  VERTEX_PROJECT_ID: z.string().optional().default(""),
  VERTEX_LOCATION: z.string().optional().default("us-central1"),
  /** Model publisher Google, mis. gemini-2.0-flash-001 / gemini-2.5-flash */
  VERTEX_MODEL: z.string().optional().default("gemini-2.0-flash-001"),
  /**
   * Fallback Google AI Studio (API key). Dipakai hanya jika VERTEX_PROJECT_ID kosong.
   */
  GEMINI_API_KEY: z.string().optional().default(""),
  /** Nama kolom urutan di `exercise_instructions` (mis. sort_order). Kosongkan untuk auto-deteksi. */
  EXERCISE_INSTRUCTION_ORDER_COLUMN: z.string().max(64).optional(),
  /** Nama kolom teks langkah di `exercise_instructions` (mis. body). Kosongkan untuk auto-deteksi. */
  EXERCISE_INSTRUCTION_TEXT_COLUMN: z.string().max(64).optional(),
  /** Strava OAuth (opsional — fitur nonaktif jika CLIENT_ID kosong). */
  STRAVA_CLIENT_ID: z.string().optional().default(""),
  STRAVA_CLIENT_SECRET: z.string().optional().default(""),
  STRAVA_REDIRECT_URI: z.string().optional().default("http://localhost:8787/api/v1/strava/callback"),
  STRAVA_SCOPES: z
    .string()
    .optional()
    .default("read,activity:read_all,profile:read_all"),
  STRAVA_FE_REDIRECT: z.string().optional().default("http://localhost:5173/strava"),
  /** SSH jump host untuk akses Postgres MCU (opsional — fitur off jika kosong). */
  SSH_HOST: z.string().optional().default(""),
  SSH_PORT: z.coerce.number().optional().default(22),
  SSH_USER: z.string().optional().default(""),
  SSH_PKEY: z.string().optional().default(""),
  /** Postgres OLAP MCU via tunnel lokal. */
  PG_HOST: z.string().optional().default(""),
  PG_PORT: z.coerce.number().optional().default(5432),
  PG_SSH_HOST: z.string().optional().default("127.0.0.1"),
  PG_SSH_LOCAL_PORT: z.coerce.number().optional().default(5433),
  PG_SSH_DATABASE: z.string().optional().default(""),
  PG_SSH_USER: z.string().optional().default(""),
  PG_SSH_PASSWORD: z.string().optional().default(""),
  /** Nama kolom SID di bcsid.mv_ftw_mcu (kosong = auto-deteksi). */
  MCU_PG_SID_COLUMN: z.string().max(64).optional().default(""),
  /** Nama kolom tanggal untuk ORDER BY (kosong = auto-deteksi). */
  MCU_PG_DATE_COLUMN: z.string().max(64).optional().default(""),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

/** True jika kredensial SSH + Postgres MCU lengkap. */
export function isMcuPostgresConfigured() {
  return Boolean(
    String(env.SSH_HOST || "").trim() &&
      String(env.SSH_USER || "").trim() &&
      String(env.SSH_PKEY || "").trim() &&
      String(env.PG_HOST || "").trim() &&
      String(env.PG_SSH_DATABASE || "").trim() &&
      String(env.PG_SSH_USER || "").trim()
  );
}

export function parseCorsOrigins(value) {
  const v = String(value || "").trim();
  if (!v || v === "*") return true;
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}
