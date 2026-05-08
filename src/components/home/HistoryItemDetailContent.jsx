import { Link, useNavigate, useParams } from "react-router-dom";
import { buildNutritionRows } from "../../utils/foodNutritionRows";
import { getSessionUser } from "../../auth/auth";
import { deleteHistoryItemFromCloud } from "../../services/supabaseDataService";

const HISTORY_KEY = "health_upload_history_v1";

export default function HistoryItemDetailContent() {
  const navigate = useNavigate();
  const { id } = useParams();
  const sessionUser = getSessionUser();

  let item = null;
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      item = parsed.find((it) => String(it.id) === String(id)) || null;
    }
  } catch {
    item = null;
  }

  const handleDelete = () => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const next = Array.isArray(parsed) ? parsed.filter((it) => String(it.id) !== String(id)) : [];
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore storage issues
    }
    if (sessionUser?.id) {
      deleteHistoryItemFromCloud(sessionUser.id, id).catch(() => {});
    }
    navigate("/history");
  };

  if (!item) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-on-surface-variant mb-4">Item history tidak ditemukan.</p>
          <Link to="/history" className="px-5 py-2 rounded-full bg-primary text-white font-semibold">
            Kembali ke History
          </Link>
        </div>
      </div>
    );
  }

  const title =
    (item.type === "activity" ? item.activityType || item.foodName : item.foodName) ||
    (item.type === "food" ? "Upload makanan" : "Upload olahraga");
  const subtitle =
    (item.type === "activity" ? item.workoutSummary || item.nutritionNotes : item.nutritionNotes) ||
    (item.type === "food" ? "Foto konsumsi makanan untuk tracking nutrisi." : "Foto aktivitas untuk tracking latihan.");
  const workoutSummaryLines =
    item.type === "activity" && item.workoutSummary
      ? item.workoutSummary
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
      : [];

  return (
    <div className="bg-surface text-on-surface antialiased max-w-[375px] mx-auto min-h-screen relative pb-32">
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-6 py-4 bg-emerald-50/80 backdrop-blur-xl no-border shadow-none max-w-[375px] mx-auto">
        <Link to="/history" className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-emerald-100/50 transition-colors active:scale-95 duration-150">
          <span className="material-symbols-outlined text-emerald-700">arrow_back</span>
        </Link>
        <span className="text-2xl font-black tracking-tighter text-emerald-800">Detail</span>
        <button className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-emerald-100/50 transition-colors active:scale-95 duration-150">
          <span className="material-symbols-outlined text-emerald-700">notifications</span>
        </button>
      </header>

      <main className="pt-20">
        <div className="relative w-full h-[320px] overflow-hidden bg-black">
          <img src={item.image} alt={title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>

        <section className="px-6 -mt-8 relative z-10 bg-surface rounded-t-[32px] pt-8">
          <div className="flex justify-between items-start mb-4">
            <h1 className="text-2xl font-extrabold text-on-surface tracking-tight leading-tight max-w-[72%]">{title}</h1>
            <span className={`text-xs font-bold uppercase tracking-widest px-2 py-1 rounded-full ${item.type === "food" ? "bg-primary/10 text-primary" : "bg-tertiary/10 text-tertiary"}`}>
              {item.type === "food" ? "Makanan" : "Olahraga"}
            </span>
          </div>
          <p className="text-on-surface-variant body-md leading-relaxed mb-4 line-clamp-4">{subtitle}</p>
          {item.type === "food" ? (
            <div className="mb-6 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Ringkasan nutrisi</p>
                <div className="grid grid-cols-1 gap-2 text-sm">
                  {buildNutritionRows(item).map((row) => (
                    <div key={row.label} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                      <span className="text-[13px] font-medium text-slate-600">{row.label}</span>
                      <span className="shrink-0 font-bold text-slate-900">{row.text}</span>
                    </div>
                  ))}
                </div>
              </div>
              {Array.isArray(item.foodItems) && item.foodItems.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Komponen</p>
                  <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
                    {item.foodItems.map((row, idx) => (
                      <li key={`${row.name}-${idx}`} className="px-4 py-3">
                        <p className="font-bold text-slate-900">{row.name || "Item"}</p>
                        {row.detail ? <p className="mt-0.5 text-sm text-slate-600">{row.detail}</p> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
          {item.type === "activity" && workoutSummaryLines.length > 0 ? (
            <div className="mb-6 space-y-2">
              {workoutSummaryLines.map((line, idx) => (
                <div key={`${line}-${idx}`} className="rounded-2xl bg-surface-container-low p-3">
                  <p className="text-sm font-semibold text-on-surface">{line}</p>
                </div>
              ))}
            </div>
          ) : null}
          <div className="space-y-2 pb-12">
            <div className="rounded-2xl bg-surface-container-low p-3">
              <p className="text-[11px] text-on-surface-variant">Waktu Upload</p>
              <p className="text-sm font-semibold text-on-surface">{new Date(item.createdAt).toLocaleString()}</p>
            </div>
            {item.calories && item.type === "activity" ? (
              <div className="rounded-2xl bg-surface-container-low p-3">
                <p className="text-[11px] text-on-surface-variant">Kalori (dari ringkasan)</p>
                <p className="text-sm font-semibold text-on-surface">{item.calories} kkal</p>
              </div>
            ) : null}
          </div>
        </section>
      </main>

      <footer className="fixed bottom-0 left-0 w-full z-50 bg-white/80 backdrop-blur-xl px-6 pb-8 pt-4 border-t border-zinc-100/10 max-w-[375px] mx-auto">
        <div className="flex items-center justify-between gap-3">
          <Link to="/history" className="h-14 px-5 rounded-full bg-surface-container-low text-on-surface font-bold flex items-center justify-center gap-2">
            <span className="material-symbols-outlined">history</span>
            History
          </Link>
          <button onClick={handleDelete} className="flex-1 h-14 rounded-full bg-gradient-to-br from-red-400 to-red-600 text-white font-bold text-lg flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(220,38,38,0.35)] active:scale-95 duration-150">
            <span className="material-symbols-outlined">delete</span>
            Hapus
          </button>
        </div>
      </footer>
    </div>
  );
}
