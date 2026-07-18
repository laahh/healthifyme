import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getStoredMealType } from "../../lib/foodLogApi";

/**
 * Meal scan entry: arahkan ke Home dengan state buka capture food + meal_type.
 * HomeContent sudah punya modal kamera/AI.
 */
export default function FoodScanRedirectContent() {
  const navigate = useNavigate();

  useEffect(() => {
    const meal = getStoredMealType();
    navigate("/home", {
      replace: true,
      state: { openFoodCapture: true, mealType: meal, sourceType: "photo" },
    });
  }, [navigate]);

  return (
    <div className="flex h-dvh items-center justify-center bg-slate-50 text-sm text-slate-500">
      Membuka kamera makanan…
    </div>
  );
}
