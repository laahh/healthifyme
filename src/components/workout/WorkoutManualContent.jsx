import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/** Redirect lama /workout/manual → hub dengan modal manual. */
export default function WorkoutManualContent() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/workout", { replace: true, state: { openManual: true } });
  }, [navigate]);

  return (
    <div className="flex h-dvh items-center justify-center bg-slate-50 text-sm text-slate-500">
      Membuka form manual…
    </div>
  );
}
