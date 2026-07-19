import { Navigate, Route, Routes } from "react-router-dom";
import CartPage from "./pages/CartPage";
import RequireAuth from "./components/auth/RequireAuth";
import {
  ActivityRunPage,
  ActivityCapturePage,
  FoodAnalysisResultPage,
  WorkoutAnalysisResultPage,
  NutritionInsightPage,
  WorkoutInsightPage,
  WorkoutExercisesListPage,
  WorkoutExerciseDetailPage,
  GetStartedPage,
  HealthPage,
  HistoryPage,
  HistoryItemDetailPage,
  HomePage,
  LoginPage,
  MenuPage,
  ProfilePage,
  CognitiveTestsHubPage,
  CognitiveTestSessionPage,
  PvtTestPage,
  WorkingMemoryTestPage,
  CognitiveTestResultsPage,
  SplashPage,
  WelcomePage,
  CommunityPage,
  CommunityCreatePage,
  CommunityManagePage,
  CommunitySportListPage,
  CommunityDetailPage,
  CommunityEventDetailPage,
  CommunitySparringPage,
  CommunityCoachingPage,
  CommunityCompetitionsPage,
  OpenPlayPage,
  OpenPlayCreatePage,
  OpenPlayMinePage,
  OpenPlayDetailPage,
  StravaPage,
  StravaActivityDetailPage,
  FoodLogPage,
  FoodManualPage,
  FoodBarcodePage,
  FoodScanPage,
  WorkoutLogPage,
  WorkoutManualPage,
  WorkoutScanPage,
  McuPage,
  SocialPage,
} from "./pages/SimplerPages";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/splash" replace />} />
      <Route path="/splash" element={<SplashPage />} />
      <Route path="/get-started" element={<GetStartedPage />} />
      <Route path="/welcome" element={<WelcomePage />} />
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route path="/home" element={<HomePage />} />
        <Route path="/social" element={<SocialPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/history/:id" element={<HistoryItemDetailPage />} />
        <Route path="/community" element={<CommunityPage />} />
        <Route path="/community/create" element={<CommunityCreatePage />} />
        <Route path="/community/manage" element={<CommunityManagePage />} />
        <Route path="/community/sparring" element={<CommunitySparringPage />} />
        <Route path="/community/coaching" element={<CommunityCoachingPage />} />
        <Route path="/community/competitions" element={<CommunityCompetitionsPage />} />
        <Route path="/community/leaderboard" element={<Navigate to="/community" replace />} />
        <Route path="/community/sports/:sportKey" element={<CommunitySportListPage />} />
        <Route path="/community/events/:eventId" element={<CommunityEventDetailPage />} />
        <Route path="/community/:communityId" element={<CommunityDetailPage />} />
        <Route path="/open-play" element={<OpenPlayPage />} />
        <Route path="/open-play/create" element={<OpenPlayCreatePage />} />
        <Route path="/open-play/mine" element={<OpenPlayMinePage />} />
        <Route path="/open-play/:eventId" element={<OpenPlayDetailPage />} />
        <Route path="/strava" element={<StravaPage />} />
        <Route path="/strava/activities/:activityId" element={<StravaActivityDetailPage />} />
        <Route path="/food" element={<FoodLogPage />} />
        <Route path="/food/manual" element={<FoodManualPage />} />
        <Route path="/food/barcode" element={<FoodBarcodePage />} />
        <Route path="/food/scan" element={<FoodScanPage />} />
        <Route path="/workout" element={<WorkoutLogPage />} />
        <Route path="/workout/manual" element={<WorkoutManualPage />} />
        <Route path="/workout/scan" element={<WorkoutScanPage />} />
        <Route path="/mcu" element={<McuPage />} />
        <Route path="/activity/run" element={<ActivityRunPage />} />
        <Route path="/activity/capture" element={<ActivityCapturePage />} />
        <Route path="/food-analysis/result" element={<FoodAnalysisResultPage />} />
        <Route path="/activity/analysis/result" element={<WorkoutAnalysisResultPage />} />
        <Route path="/nutrition/insight" element={<NutritionInsightPage />} />
        <Route path="/workout/insight" element={<WorkoutInsightPage />} />
        <Route path="/workout/exercises" element={<WorkoutExercisesListPage />} />
        <Route path="/workout/exercise/:id" element={<WorkoutExerciseDetailPage />} />
        <Route path="/health" element={<HealthPage />} />
        <Route path="/menu" element={<MenuPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/cognitive-tests" element={<CognitiveTestsHubPage />} />
        <Route path="/cognitive-tests/session" element={<CognitiveTestSessionPage />} />
        <Route path="/cognitive-tests/pvt" element={<PvtTestPage />} />
        <Route path="/cognitive-tests/memory" element={<WorkingMemoryTestPage />} />
        <Route path="/cognitive-tests/results" element={<CognitiveTestResultsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/splash" replace />} />
    </Routes>
  );
}
