import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as authController from "../controllers/auth.controller.js";
import * as profileController from "../controllers/profile.controller.js";
import * as syncController from "../controllers/sync.controller.js";
import * as historyController from "../controllers/history.controller.js";
import * as exerciseController from "../controllers/exercise.controller.js";
import * as cognitiveTestController from "../controllers/cognitiveTest.controller.js";
import * as goalController from "../controllers/goal.controller.js";
import * as workoutInsightController from "../controllers/workoutInsight.controller.js";
import * as nutritionInsightController from "../controllers/nutritionInsight.controller.js";
import * as geminiProxyController from "../controllers/geminiProxy.controller.js";
import * as communityController from "../controllers/community.controller.js";
import * as openPlayController from "../controllers/openPlay.controller.js";
import * as stravaController from "../controllers/strava.controller.js";
import * as foodLogController from "../controllers/foodLog.controller.js";
import * as workoutLogController from "../controllers/workoutLog.controller.js";
import * as mcuController from "../controllers/mcu.controller.js";
import * as healthRiskController from "../controllers/healthRisk.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { validateBody } from "../middleware/validate.js";
import {
  loginBodySchema,
  changePasswordBodySchema,
  profileBodySchema,
  createGoalBodySchema,
  cognitivePvtBodySchema,
  cognitiveMemoryBodySchema,
  cognitiveSessionBodySchema,
  geminiImageBodySchema,
  createCommunityBodySchema,
  updateCommunityBodySchema,
  createCommunityEventBodySchema,
  communityRsvpBodySchema,
  createCommunityPostBodySchema,
  communityCommentBodySchema,
  communityChatBodySchema,
  createSparringBodySchema,
  createOpenPlayBodySchema,
  patchOpenPlayBodySchema,
  openPlayJoinBodySchema,
  openPlayDecideBodySchema,
  openPlayChatBodySchema,
  patchSparringBodySchema,
  foodLogBodySchema,
  workoutLogBodySchema,
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
router.post(
  "/auth/change-password",
  requireAuth,
  loginLimiter,
  validateBody(changePasswordBodySchema),
  authController.changePassword
);

router.get("/me/profile", requireAuth, profileController.getProfile);
router.put(
  "/me/profile",
  requireAuth,
  validateBody(profileBodySchema),
  profileController.putProfile
);

router.get("/me/sync", requireAuth, syncController.getSync);

router.get("/me/workouts/weekly-summary", requireAuth, workoutInsightController.getWeeklySummary);
router.get("/me/workouts/daily-summary", requireAuth, workoutInsightController.getDailySummary);

router.get("/me/food/weekly-summary", requireAuth, nutritionInsightController.getWeeklySummary);
router.get("/me/mcu", requireAuth, mcuController.getMcu);
router.get("/me/health-alerts/today", requireAuth, healthRiskController.getTodayAlerts);
router.post("/me/health-alerts/evaluate", requireAuth, healthRiskController.postEvaluate);
router.get("/me/food/daily-summary", requireAuth, nutritionInsightController.getDailySummary);

router.post(
  "/me/ai/gemini-food",
  requireAuth,
  validateBody(geminiImageBodySchema),
  geminiProxyController.postGeminiFood
);
router.post(
  "/me/ai/gemini-workout",
  requireAuth,
  validateBody(geminiImageBodySchema),
  geminiProxyController.postGeminiWorkout
);

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

router.get("/me/goal-types", requireAuth, goalController.listGoalTypes);
router.get("/me/goals/dashboard", requireAuth, goalController.getDashboard);
router.get("/me/goals/progress", requireAuth, goalController.getProgress);
router.get("/me/goals", requireAuth, goalController.listGoals);
router.post("/me/goals", requireAuth, validateBody(createGoalBodySchema), goalController.createGoal);
router.post("/me/goals/:goalId/activate", requireAuth, goalController.activateGoal);
router.get("/me/goals/:goalId/summary", requireAuth, goalController.getGoalSummary);

/** Community (AYO-style) */
router.get("/community/sports", requireAuth, communityController.listSports);
router.get("/community/hub", requireAuth, communityController.getHub);
router.get("/community/mine", requireAuth, communityController.listMine);
router.get("/community/sparring", requireAuth, communityController.listSparring);
router.post(
  "/community/sparring",
  requireAuth,
  validateBody(createSparringBodySchema),
  communityController.createSparring
);
router.patch(
  "/community/sparring/:id",
  requireAuth,
  validateBody(patchSparringBodySchema),
  communityController.patchSparring
);
router.get("/community/coaching", requireAuth, communityController.listCoaching);
router.get("/community/competitions", requireAuth, communityController.listCompetitions);
router.get("/community/competitions/:id/standings", requireAuth, communityController.competitionStandings);
router.get("/community/leaderboard", requireAuth, communityController.leaderboard);
router.get("/community/badges/me", requireAuth, communityController.myBadges);
router.get("/community/events/:eventId", requireAuth, communityController.getEvent);
router.post(
  "/community/events/:eventId/rsvp",
  requireAuth,
  validateBody(communityRsvpBodySchema),
  communityController.rsvpEvent
);
router.post(
  "/community/posts/:postId/like",
  requireAuth,
  communityController.toggleLike
);
router.get("/community/posts/:postId/comments", requireAuth, communityController.listComments);
router.post(
  "/community/posts/:postId/comments",
  requireAuth,
  validateBody(communityCommentBodySchema),
  communityController.addComment
);
router.post(
  "/community",
  requireAuth,
  validateBody(createCommunityBodySchema),
  communityController.create
);
router.patch(
  "/community/:id",
  requireAuth,
  validateBody(updateCommunityBodySchema),
  communityController.update
);
router.get("/community/:id", requireAuth, communityController.getDetail);
router.get("/community/:id/leaderboard", requireAuth, communityController.communityLeaderboard);
router.post("/community/:id/join", requireAuth, communityController.join);
router.delete("/community/:id/leave", requireAuth, communityController.leave);
router.get("/community/:id/events", requireAuth, communityController.listCommunityEvents);
router.post(
  "/community/:id/events",
  requireAuth,
  validateBody(createCommunityEventBodySchema),
  communityController.createCommunityEvent
);
router.get("/community/:id/posts", requireAuth, communityController.listPosts);
router.post(
  "/community/:id/posts",
  requireAuth,
  validateBody(createCommunityPostBodySchema),
  communityController.createPost
);
router.get("/community/:id/chat/messages", requireAuth, communityController.listChat);
router.post(
  "/community/:id/chat/messages",
  requireAuth,
  validateBody(communityChatBodySchema),
  communityController.sendChat
);

/** Main Bareng (Open Play) */
router.get("/open-play/hub", requireAuth, openPlayController.getHub);
router.get("/open-play/mine", requireAuth, openPlayController.listMine);
router.post(
  "/open-play",
  requireAuth,
  validateBody(createOpenPlayBodySchema),
  openPlayController.create
);
router.get("/open-play/:id", requireAuth, openPlayController.getDetail);
router.patch(
  "/open-play/:id",
  requireAuth,
  validateBody(patchOpenPlayBodySchema),
  openPlayController.update
);
router.post(
  "/open-play/:id/join",
  requireAuth,
  validateBody(openPlayJoinBodySchema),
  openPlayController.join
);
router.delete("/open-play/:id/join", requireAuth, openPlayController.leave);
router.get("/open-play/:id/chat/messages", requireAuth, openPlayController.listChat);
router.post(
  "/open-play/:id/chat/messages",
  requireAuth,
  validateBody(openPlayChatBodySchema),
  openPlayController.sendChat
);
router.post(
  "/open-play/:id/participants/:userId/decide",
  requireAuth,
  validateBody(openPlayDecideBodySchema),
  openPlayController.decide
);

/** Strava */
router.get("/strava/status", requireAuth, stravaController.getStatus);
router.get("/strava/auth-url", requireAuth, stravaController.getAuthUrl);
router.get("/strava/callback", stravaController.callback);
router.post("/strava/sync", requireAuth, stravaController.sync);
router.delete("/strava/disconnect", requireAuth, stravaController.disconnect);
router.get("/strava/activities", requireAuth, stravaController.listActivities);
router.get("/strava/activities/:id", requireAuth, stravaController.getActivity);

/** Food log hub */
router.get("/food/catalog", requireAuth, foodLogController.getCatalog);
router.get("/food/recent", requireAuth, foodLogController.getRecent);
router.get("/food/barcode/:code", requireAuth, foodLogController.lookupBarcode);
router.post(
  "/food/log",
  requireAuth,
  validateBody(foodLogBodySchema),
  foodLogController.logFood
);

/** Workout log hub (manual + catalog quick-add; Strava tetap di /strava/*) */
router.get("/workout/catalog", requireAuth, workoutLogController.getCatalog);
router.get("/workout/recent", requireAuth, workoutLogController.getRecent);
router.post(
  "/workout/log",
  requireAuth,
  validateBody(workoutLogBodySchema),
  workoutLogController.logWorkout
);

export { router as apiRouter };
