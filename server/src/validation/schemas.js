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

export const changePasswordBodySchema = z
  .object({
    currentPassword: z.string().min(1, "Isi password lama."),
    newPassword: z.string().min(6, "Password baru minimal 6 karakter.").max(128),
    confirmPassword: z.string().min(1, "Ulangi password baru."),
  })
  .superRefine((val, ctx) => {
    if (val.newPassword !== val.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Konfirmasi password tidak cocok.",
        path: ["confirmPassword"],
      });
    }
    if (val.currentPassword === val.newPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Password baru harus berbeda dari password lama.",
        path: ["newPassword"],
      });
    }
  });

export const profileBodySchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.record(z.unknown()).nullable().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  height_cm: z.coerce.number().min(50).max(280).optional(),
  weight_kg: z.coerce.number().min(20).max(400).optional(),
  activity_level: z.enum(["low", "moderate", "high", "very_high"]).optional(),
  exercise_preferences: z.string().max(2000).optional(),
  food_restrictions: z.string().max(2000).optional(),
  timezone: z.string().max(64).optional(),
});

export const createGoalBodySchema = z.object({
  goal_type_code: z.string().min(1),
  goal_name: z.string().max(255).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_weight_kg: z.coerce.number(),
  target_weight_kg: z.coerce.number(),
  intensity_level: z.enum(["easy", "normal", "aggressive"]),
  activity_level: z.enum(["low", "moderate", "high", "very_high"]),
  exercise_preferences: z.string().max(2000).optional(),
  food_restrictions: z.string().max(2000).optional(),
  notes: z.string().max(4000).optional(),
  age_years: z.coerce.number().int().min(15).max(100).optional(),
  target_body_fat_percent: z.coerce.number().min(0).max(70).optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  height_cm: z.coerce.number().min(100).max(250).optional(),
  weight_kg: z.coerce.number().min(30).max(300).optional(),
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

/** Body untuk proxy Gemini (gambar base64). */
export const geminiImageBodySchema = z.object({
  mimeType: z.string().min(3).max(128),
  base64Data: z.string().min(10).max(14_000_000),
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

export const createCommunityBodySchema = z
  .object({
    name: z.string().min(1).max(255),
    sport_key: z.string().max(64).optional().nullable(),
    sport_custom: z.string().max(128).optional().nullable(),
    description: z.string().max(4000).optional(),
    banner_url: z.string().max(2_500_000).optional(),
    logo_url: z.string().max(2_500_000).optional(),
    city: z.string().max(255).optional(),
    company: z.string().max(255).optional(),
    slug: z.string().max(255).optional(),
  })
  .refine(
    (v) => {
      const key = String(v.sport_key || "").trim();
      const custom = String(v.sport_custom || "").trim();
      if (key && key !== "__other__" && key !== "other") return true;
      return Boolean(custom);
    },
    { message: "Pilih olahraga dari list atau isi manual.", path: ["sport_key"] }
  );

export const updateCommunityBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(4000).optional().nullable(),
  banner_url: z.string().max(2_500_000).optional().nullable(),
  logo_url: z.string().max(2_500_000).optional().nullable(),
  city: z.string().max(255).optional().nullable(),
  company: z.string().max(255).optional().nullable(),
});

export const createCommunityEventBodySchema = z
  .object({
    title: z.string().min(1).max(255),
    sport_key: z.string().max(64).optional().nullable(),
    sport_custom: z.string().max(128).optional().nullable(),
    starts_at: z.string().min(1),
    place: z.string().max(255).optional(),
    capacity: z.coerce.number().int().min(2).max(500).optional(),
    fee_note: z.string().max(255).optional(),
    event_type: z.enum(["open_play", "coaching"]).optional(),
  })
  .refine(
    (v) => {
      const key = String(v.sport_key || "").trim();
      const custom = String(v.sport_custom || "").trim();
      if (key && key !== "__other__" && key !== "other") return true;
      return Boolean(custom);
    },
    { message: "Pilih olahraga dari list atau isi manual.", path: ["sport_key"] }
  );

export const communityRsvpBodySchema = z.object({
  join: z.boolean().optional(),
});

export const createCommunityPostBodySchema = z.object({
  body: z.string().min(1).max(8000),
  image_url: z.string().max(2_500_000).optional(),
  sport_key: z.string().max(64).optional(),
});

export const communityCommentBodySchema = z.object({
  body: z.string().min(1).max(2000),
  parent_id: z.union([z.string(), z.number()]).optional().nullable(),
});

export const communityChatBodySchema = z.object({
  body: z.string().min(1).max(4000),
});

export const createSparringBodySchema = z.object({
  sport_key: z.string().min(1).max(64),
  proposed_at: z.string().min(1),
  place: z.string().max(255).optional(),
  from_community_id: z.union([z.string(), z.number()]).optional().nullable(),
  to_community_id: z.union([z.string(), z.number()]).optional().nullable(),
});

export const patchSparringBodySchema = z.object({
  status: z.enum(["pending", "accepted", "declined", "done"]).optional(),
  score_home: z.coerce.number().int().min(0).max(99).optional(),
  score_away: z.coerce.number().int().min(0).max(99).optional(),
});

export const createOpenPlayBodySchema = z.object({
  title: z.string().min(1).max(255),
  sport_key: z.string().min(1).max(64),
  starts_at: z.string().min(1),
  ends_at: z.string().optional().nullable(),
  place: z.string().max(255).optional(),
  city: z.string().max(128).optional(),
  address_note: z.string().max(512).optional(),
  capacity: z.coerce.number().int().min(2).max(500).optional(),
  skill_level: z.enum(["beginner", "intermediate", "all"]).optional(),
  fee_note: z.string().max(255).optional(),
  description: z.string().max(4000).optional(),
  cover_url: z.string().max(2_500_000).optional(),
});

export const patchOpenPlayBodySchema = z.object({
  title: z.string().min(1).max(255).optional(),
  sport_key: z.string().min(1).max(64).optional(),
  starts_at: z.string().min(1).optional(),
  ends_at: z.string().optional().nullable(),
  place: z.string().max(255).optional(),
  city: z.string().max(128).optional(),
  address_note: z.string().max(512).optional(),
  capacity: z.coerce.number().int().min(2).max(500).optional(),
  skill_level: z.enum(["beginner", "intermediate", "all"]).optional(),
  fee_note: z.string().max(255).optional(),
  description: z.string().max(4000).optional(),
  cover_url: z.string().max(2_500_000).optional(),
  status: z.enum(["open", "full", "cancelled", "done"]).optional(),
});

export const openPlayJoinBodySchema = z.object({
  note: z.string().max(255).optional(),
});

export const openPlayDecideBodySchema = z.object({
  decision: z.enum(["approved", "rejected"]),
});

export const openPlayChatBodySchema = z
  .object({
    body: z.string().max(4000).optional(),
    image_url: z.string().max(2_500_000).optional(),
  })
  .refine((v) => String(v.body || "").trim() || String(v.image_url || "").trim(), {
    message: "Isi pesan atau lampirkan foto.",
  });

export const foodLogBodySchema = z.object({
  food_name: z.string().min(1).max(512),
  calories: z.coerce.number().min(0).max(20000),
  protein_g: z.coerce.number().min(0).max(2000).optional().nullable(),
  fats_g: z.coerce.number().min(0).max(2000).optional().nullable(),
  carbs_g: z.coerce.number().min(0).max(2000).optional().nullable(),
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
  source_type: z.enum(["manual", "barcode"]).optional(),
  barcode: z.string().max(64).optional().nullable(),
  serving_label: z.string().max(128).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  image_url: z.string().max(2048).optional().nullable(),
  client_item_id: z.string().max(128).optional().nullable(),
});

export const workoutLogBodySchema = z.object({
  activity_type: z.string().min(1).max(512),
  calories: z.coerce.number().min(0).max(20000),
  duration_min: z.coerce.number().min(0).max(1440).optional().nullable(),
  workout_time: z.string().max(128).optional().nullable(),
  distance: z.string().max(128).optional().nullable(),
  avg_heart_rate: z.string().max(128).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  client_item_id: z.string().max(128).optional().nullable(),
});
