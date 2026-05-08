import { z } from "zod";

/** Login: username = SID (kode_sid), password = SID (disimpan bcrypt di DB). */
export const loginBodySchema = z.preprocess(
  (raw) => {
    if (!raw || typeof raw !== "object") return raw;
    const username = String(
      raw.username ?? raw.usernameOrEmail ?? ""
    ).trim();
    return { username, password: raw.password };
  },
  z.object({
    username: z.string().min(1, "Isi SID."),
    password: z.string().min(1, "Isi password (SID)."),
  })
);

export const profileBodySchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.record(z.unknown()).nullable().optional(),
});

export const historyListQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(500).optional(),
});

export const exerciseListQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(30),
  offset: z.coerce.number().min(0).max(50_000).optional().default(0),
});

export const exerciseIdParamSchema = z.object({
  exerciseId: z.coerce.number().int().positive(),
});

/** Sinkron hasil PVT dari aplikasi (localStorage entry). */
export const cognitivePvtBodySchema = z
  .object({
    id: z.string().min(1).max(64),
    at: z.string().optional(),
    sessionId: z.string().max(64).nullable().optional(),
    trials: z.coerce.number().int().min(0),
    validTrials: z.coerce.number().int().min(0),
    meanRtMs: z.coerce.number().int(),
    medianRtMs: z.coerce.number().int(),
    lapses: z.coerce.number().int().min(0),
    falseStarts: z.coerce.number().int().min(0),
    passed: z.boolean().optional(),
    evaluationLabel: z.string().max(512).optional(),
  })
  .passthrough();

export const cognitiveMemoryBodySchema = z
  .object({
    id: z.string().min(1).max(64),
    at: z.string().optional(),
    sessionId: z.string().max(64).nullable().optional(),
    rounds: z.coerce.number().int().min(0),
    roundsCorrect: z.coerce.number().int().min(0),
    maxSpan: z.coerce.number().int().min(0),
    sumCorrectLengths: z.coerce.number().int().min(0),
    score: z.coerce.number().int(),
    passed: z.boolean().optional(),
    evaluationLabel: z.string().max(512).optional(),
  })
  .passthrough();

export const cognitiveSessionBodySchema = z
  .object({
    sessionId: z.string().min(1).max(64),
    at: z.string().optional(),
    overall: z
      .object({
        level: z.string().max(64),
        title: z.string().max(1024),
        subtitle: z.string().max(4096),
        color: z.string().max(32).optional(),
        recommendations: z.array(z.string()).optional(),
      })
      .passthrough(),
    pvt: z.object({ raw: z.unknown().optional(), evaluation: z.unknown().optional() }).passthrough().optional(),
    memory: z.object({ raw: z.unknown().optional(), evaluation: z.unknown().optional() }).passthrough().optional(),
  })
  .passthrough();
