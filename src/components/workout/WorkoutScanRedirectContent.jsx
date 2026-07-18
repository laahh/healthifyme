import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Scan olahraga: arahkan ke Home dengan state buka capture activity.
 */
export default function WorkoutScanRedirectContent() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/home", {
      replace: true,
      state: { openActivityCapture: true },
    });
  }, [navigate]);

  return (
    <div className="flex h-dvh items-center justify-center bg-slate-50 text-sm text-slate-500">
      Membuka kamera olahraga…
    </div>
  );
}
