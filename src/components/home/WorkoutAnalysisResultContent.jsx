import { Link, useNavigate } from "react-router-dom";
import { getSessionUser } from "../../auth/auth";
import { saveHistoryLocalWithCap, upsertHistoryItemToCloud } from "../../services/supabaseDataService";

const TEMP_WORKOUT_KEY = "health_workout_analysis_temp_v1";

function extractKcalFromString(s) {
  if (s == null || s === "") return null;
  const m = String(s).match(/(\d[\d.,]*)/);
  if (!m) return null;
  const n = Number(String(m[1]).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n) : null;
}

export default function WorkoutAnalysisResultContent() {
  const navigate = useNavigate();
  const raw = localStorage.getItem(TEMP_WORKOUT_KEY);
  const data = raw ? JSON.parse(raw) : null;
  const sessionUser = getSessionUser();

  const handleSave = () => {
    if (!data) return navigate("/home");
    try {
      const kcal =
        extractKcalFromString(data.totalKilocalories) ??
        extractKcalFromString(data.activeKilocalories) ??
        null;
      const savedItem = {
        id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
        type: "activity",
        image: data.image || "",
        foodName: data.activityType || "Workout",
        activityType: data.activityType || "",
        calories: kcal,
        nutritionNotes: (data.summaryText || "").slice(0, 280),
        workoutSummary: data.summaryText || "",
        workoutMetrics: {
          dateLine: data.dateLine || "",
          timeRange: data.timeRange || "",
          location: data.location || "",
          workoutTime: data.workoutTime || "",
          distance: data.distance || "",
          activeKilocalories: data.activeKilocalories || "",
          totalKilocalories: data.totalKilocalories || "",
          elevationGain: data.elevationGain || "",
          avgPower: data.avgPower || "",
          avgCadence: data.avgCadence || "",
          avgPace: data.avgPace || "",
          avgHeartRate: data.avgHeartRate || "",
        },
        createdAt: data.createdAt || Date.now(),
      };
      saveHistoryLocalWithCap(savedItem, 100);
      if (sessionUser?.id) {
        upsertHistoryItemToCloud(sessionUser.id, savedItem).catch(() => {});
      }
      localStorage.removeItem(TEMP_WORKOUT_KEY);
      navigate("/history");
    } catch {
      navigate("/home");
    }
  };

  const handleRetake = () => {
    localStorage.removeItem(TEMP_WORKOUT_KEY);
    navigate("/home?capture=activity");
  };

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-6">
        <div className="text-center">
          <p className="mb-4 text-sm text-on-surface-variant">Belum ada hasil ekstraksi workout.</p>
          <Link to="/home" className="rounded-full bg-primary px-5 py-2 font-semibold text-white">
            Kembali
          </Link>
        </div>
      </div>
    );
  }

  const rows = [
    ["Waktu latihan", data.workoutTime],
    ["Jarak", data.distance],
    ["Aktif kkal", data.activeKilocalories],
    ["Total kkal", data.totalKilocalories],
    ["Elevasi", data.elevationGain],
    ["Avg power", data.avgPower],
    ["Avg cadence", data.avgCadence],
    ["Avg pace", data.avgPace],
    ["Avg heart rate", data.avgHeartRate],
  ].filter(([, v]) => v && String(v).trim());

  return (
    <div className="relative mx-auto max-w-[375px] min-h-screen bg-surface pb-32 text-on-surface antialiased">
      <header className="fixed left-0 right-0 top-0 z-50 mx-auto flex max-w-[375px] items-center justify-between bg-emerald-50/80 px-6 py-4 backdrop-blur-xl">
        <Link to="/home" className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-emerald-100/50">
          <span className="material-symbols-outlined text-emerald-700">arrow_back</span>
        </Link>
        <span className="text-2xl font-black tracking-tighter text-emerald-800">Ringkasan Workout</span>
        <span className="w-10" aria-hidden />
      </header>

      <main className="pt-20">
        <div className="relative h-[280px] w-full overflow-hidden">
          <img alt="Screenshot workout" className="h-full w-full object-cover" src={data.image} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>

        <section className="relative z-10 -mt-8 rounded-t-[32px] bg-surface px-6 pt-8">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <h1 className="max-w-[85%] text-2xl font-extrabold leading-tight tracking-tight text-on-surface">
              {data.activityType || "Workout"}
            </h1>
            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">AI OCR</span>
          </div>
          {(data.dateLine || data.timeRange || data.location) && (
            <div className="mb-6 space-y-1 text-sm text-on-surface-variant">
              {data.dateLine ? <p>{data.dateLine}</p> : null}
              {data.timeRange ? <p>{data.timeRange}</p> : null}
              {data.location ? <p>{data.location}</p> : null}
            </div>
          )}

          <div className="mb-6 rounded-2xl bg-slate-900 p-4 text-slate-100">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Teks dari gambar</p>
            <pre className="max-h-[320px] overflow-y-auto whitespace-pre-wrap font-sans text-[13px] leading-relaxed">
              {data.summaryText || "(Tidak ada ringkasan teks)"}
            </pre>
          </div>

          {rows.length > 0 ? (
            <div className="mb-8 space-y-2">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-on-surface-variant">Detail terstruktur</p>
              <div className="grid gap-2">
                {rows.map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3 rounded-xl bg-surface-container-low px-3 py-2.5 text-sm">
                    <span className="text-on-surface-variant">{label}</span>
                    <span className="font-semibold text-on-surface">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-[375px] border-t border-zinc-100/10 bg-white/85 px-6 pb-8 pt-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRetake}
            className="flex h-14 items-center justify-center gap-2 rounded-full bg-surface-container-low px-5 font-bold text-on-surface"
          >
            <span className="material-symbols-outlined">refresh</span>
            Foto ulang
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-br from-slate-800 to-slate-950 text-lg font-bold text-white shadow-[0_8px_24px_rgba(15,23,42,0.35)]"
          >
            <span className="material-symbols-outlined">save</span>
            Simpan
          </button>
        </div>
      </footer>
    </div>
  );
}
