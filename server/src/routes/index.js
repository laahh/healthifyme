import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as authController from "../controllers/auth.controller.js";
import * as profileController from "../controllers/profile.controller.js";
import * as syncController from "../controllers/sync.controller.js";
import * as historyController from "../controllers/history.controller.js";
import * as exerciseController from "../controllers/exercise.controller.js";
import * as cognitiveTestController from "../controllers/cognitiveTest.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { validateBody } from "../middleware/validate.js";
import {
  loginBodySchema,
  profileBodySchema,
  cognitivePvtBodySchema,
  cognitiveMemoryBodySchema,
  cognitiveSessionBodySchema,
} from "../validation/schemas.js";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 80,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  "/auth/login",
  loginLimiter,
  validateBody(loginBodySchema),
  authController.login
);

/** Katalog latihan (read-only, tanpa auth). */
router.get("/exercises", exerciseController.listExercises);
router.get("/exercises/:exerciseId", exerciseController.getExercise);

router.get("/auth/me", requireAuth, authController.me);

router.get("/me/profile", requireAuth, profileController.getProfile);
router.put(
  "/me/profile",
  requireAuth,
  validateBody(profileBodySchema),
  profileController.putProfile
);

router.get("/me/sync", requireAuth, syncController.getSync);

router.get("/me/history", requireAuth, historyController.listHistory);
router.put("/me/history/:itemId", requireAuth, historyController.upsertHistoryItem);
router.delete("/me/history/:itemId", requireAuth, historyController.deleteHistoryItem);

router.post(
  "/me/cognitive-tests/pvt",
  requireAuth,
  validateBody(cognitivePvtBodySchema),
  cognitiveTestController.postPvtResult
);
router.post(
  "/me/cognitive-tests/memory",
  requireAuth,
  validateBody(cognitiveMemoryBodySchema),
  cognitiveTestController.postMemoryResult
);
router.post(
  "/me/cognitive-tests/session",
  requireAuth,
  validateBody(cognitiveSessionBodySchema),
  cognitiveTestController.postSessionSummary
);

export { router as apiRouter };
