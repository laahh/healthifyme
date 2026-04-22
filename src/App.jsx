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
  GetStartedPage,
  HealthPage,
  HistoryPage,
  HistoryItemDetailPage,
  HomePage,
  LoginPage,
  MenuPage,
  ProfilePage,
  SplashPage,
  WelcomePage,
} from "./pages/SimplerPages";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/welcome" replace />} />
      <Route path="/splash" element={<SplashPage />} />
      <Route path="/get-started" element={<GetStartedPage />} />
      <Route path="/welcome" element={<WelcomePage />} />
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route path="/home" element={<HomePage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/history/:id" element={<HistoryItemDetailPage />} />
        <Route path="/activity/run" element={<ActivityRunPage />} />
        <Route path="/activity/capture" element={<ActivityCapturePage />} />
        <Route path="/food-analysis/result" element={<FoodAnalysisResultPage />} />
        <Route path="/activity/analysis/result" element={<WorkoutAnalysisResultPage />} />
        <Route path="/nutrition/insight" element={<NutritionInsightPage />} />
        <Route path="/workout/insight" element={<WorkoutInsightPage />} />
        <Route path="/health" element={<HealthPage />} />
        <Route path="/menu" element={<MenuPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/welcome" replace />} />
    </Routes>
  );
}
