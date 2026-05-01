import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getSessionUser } from "../../auth/auth";

export default function HomeContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState("");
  const [captureType, setCaptureType] = useState("food"); // "food" | "activity"
  const [cameraFacing, setCameraFacing] = useState("environment"); // environment | user
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [analysisResult, setAnalysisResult] = useState(null);
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);

  const HISTORY_KEY = "health_upload_history_v1";
  const TEMP_ANALYSIS_KEY = "health_food_analysis_temp_v1";
  const TEMP_WORKOUT_KEY = "health_workout_analysis_temp_v1";
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
  const DAILY_CALORIE_TARGET = 2550;

  const sessionUser = getSessionUser();
  const greetingName = sessionUser?.name?.trim().split(/\s+/)[0] || "Pengguna";
  const avatarPhoto =
    sessionUser?.photo ||
    "https://lh3.googleusercontent.com/aida-public/AB6AXuB7uwxn84_hs7oaiFQKLbY8Y-f6y693VmByLqOGrcuA-6v64TcopIAZDvqqRbuzbrkuxM-pg1MkjTwcvsrU3tvYgiBkKItP0qtNqqx-sailK7sQv4jDejfx1_ni-xcQ-frac1FsVCI7bOn9-1fejw0U6l9C01hDLQZ6psZ2La1RnaOfkp8bI9vr2jEd_l3nE7QULFkpC3rdsEBOsNTajMnpxUadnp1jj199t_1nXryacDVai90wtEXEjWZ84YSz4vgyLw0E3pTlJD3H";

  const isCreatedAtToday = (ts) => {
    if (ts == null) return false;
    const d = new Date(ts);
    const n = new Date();
    return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  };

  const parseCaloriesValue = (value) => {
    if (value == null || value === "") return 0;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (typeof value === "string") {
      const normalized = value.replace(/\./g, "").replace(",", ".").replace(/[^0-9.]/g, "");
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };

  const todayHistoryAllItems = useMemo(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((it) => it && it.id && it.createdAt != null && isCreatedAtToday(it.createdAt))
        .sort((a, b) => b.createdAt - a.createdAt);
    } catch {
      return [];
    }
  }, [location.pathname, location.key, isCaptureOpen]);

  /** Maksimal 3 item upload hari ini (terbaru dulu). */
  const todayHistoryItems = useMemo(() => todayHistoryAllItems.slice(0, 3), [todayHistoryAllItems]);

  const todayCalories = useMemo(
    () => todayHistoryAllItems.reduce((total, it) => total + parseCaloriesValue(it?.calories), 0),
    [todayHistoryAllItems]
  );
  const todayCaloriesRounded = Math.max(0, Math.round(todayCalories));
  const todayCalorieProgressPercentRaw = Math.max(0, Math.round((todayCaloriesRounded / DAILY_CALORIE_TARGET) * 100));
  const todayCalorieProgressPercent = Math.min(todayCalorieProgressPercentRaw, 100);
  const todayCalorieText = todayCaloriesRounded.toLocaleString("id-ID");
  const isOverDailyCalorieTarget = todayCaloriesRounded > DAILY_CALORIE_TARGET;

  const defaultActivityCards = [
    {
      key: "default-run",
      to: "/activity/run?preset=lari",
      title: "Lari Pagi",
      subtitle: "Kemarin • 10.2 km",
      calories: "540 kkal",
      icon: "directions_run",
      iconWrap: "bg-blue-100 text-blue-600",
    },
    {
      key: "default-yoga",
      to: "/activity/run?preset=yoga",
      title: "Yoga Meditasi",
      subtitle: "Selasa • 30 menit",
      calories: "120 kkal",
      icon: "self_improvement",
      iconWrap: "bg-green-100 text-green-600",
    },
    {
      key: "default-breakfast",
      to: "/activity/run?preset=sarapan",
      title: "Sarapan Oatmeal & Buah",
      subtitle: "Hari ini • 07:30",
      calories: "320 kkal",
      icon: "restaurant",
      iconWrap: "bg-amber-100 text-amber-600",
    },
  ];

  const addHistoryItem = (type, imageDataUrl, analysis = null) => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const items = raw ? JSON.parse(raw) : [];
      const next = [
        {
          id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
          type,
          image: imageDataUrl,
          foodName: analysis?.foodName || "",
          calories: analysis?.calories ?? null,
          nutritionNotes: analysis?.nutritionNotes || "",
          createdAt: Date.now(),
        },
        ...items,
      ].slice(0, 100);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const capture = params.get("capture");
    if (capture === "food" || capture === "activity") {
      setCaptureType(capture);
      setIsCaptureOpen(true);
      navigate("/home", { replace: true });
    }
  }, [location.search, navigate]);

  useEffect(() => {
    const openCamera = async () => {
      if (!isCaptureOpen) return;
      try {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        let stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: cameraFacing } },
          audio: false,
        });

        const devices = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "videoinput");
        const rearCamera = devices.find((device) => /back|rear|environment/i.test(device.label));
        const frontCamera = devices.find((device) => /front|user|face/i.test(device.label));
        const preferredDevice = cameraFacing === "environment" ? rearCamera : frontCamera;

        if (preferredDevice?.deviceId) {
          stream.getTracks().forEach((track) => track.stop());
          stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: preferredDevice.deviceId } },
            audio: false,
          });
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error("Unable to access camera:", error);
      }
    };

    openCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [isCaptureOpen, cameraFacing]);

  const handleCapture = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg");
    setCapturedImage(dataUrl);
    setAnalysisResult(null);
    setAnalysisError("");
  };

  const handleUploadImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCapturedImage(reader.result);
        setAnalysisResult(null);
        setAnalysisError("");
      }
    };
    reader.readAsDataURL(file);
  };

  const closeCapture = () => {
    setIsCaptureOpen(false);
    setCapturedImage("");
    setAnalysisResult(null);
    setAnalysisError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const parseDataUrl = (dataUrl) => {
    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) return null;
    return { mimeType: match[1], base64Data: match[2] };
  };

  /** Normalisasi respons JSON analisis makanan (makro + mikro + daftar item). */
  const normalizeFoodAnalysis = (parsed) => {
    const num = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    const numOrNull = (v) => {
      if (v === null || v === undefined || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const rawItems = parsed.items ?? parsed.foodItems ?? [];
    const foodItems = Array.isArray(rawItems)
      ? rawItems
          .map((it) => {
            const name = String(it?.name ?? it?.label ?? "").trim();
            let detail = String(it?.detail ?? it?.portionAndCalories ?? "").trim();
            if (!detail && (it?.portion != null || it?.calories != null)) {
              const p = it?.portion != null ? String(it.portion) : "";
              const c = it?.calories != null ? `${it.calories} kkal` : "";
              detail = [p, c].filter(Boolean).join(" • ");
            }
            return { name, detail };
          })
          .filter((it) => it.name || it.detail)
      : [];

    const totalCalories = num(parsed.totalCalories ?? parsed.energyKkal ?? parsed.totalCal ?? parsed.calories);

    return {
      foodName: String(parsed.foodName || "").trim() || "Makanan tidak diketahui",
      calories: totalCalories,
      totalCalories,
      energyKkal: totalCalories,
      proteinG: numOrNull(parsed.proteinG ?? parsed.protein),
      fatsG: numOrNull(parsed.fatsG ?? parsed.fatG ?? parsed.fats ?? parsed.lemakG),
      carbsG: numOrNull(parsed.carbsG ?? parsed.carbohydratesG ?? parsed.carbs ?? parsed.karbohidratG),
      fiberG: numOrNull(parsed.fiberG ?? parsed.fiber ?? parsed.seratG),
      waterMl: numOrNull(parsed.waterMl ?? parsed.airMl ?? parsed.air),
      vitA_RE: numOrNull(parsed.vitA_RE ?? parsed.vitA),
      vitD_mcg: numOrNull(parsed.vitD_mcg ?? parsed.vitD),
      vitE_mg: numOrNull(parsed.vitE_mg ?? parsed.vitE),
      vitK_mcg: numOrNull(parsed.vitK_mcg ?? parsed.vitK),
      vitC_mg: numOrNull(parsed.vitC_mg ?? parsed.vitC),
      nutritionNotes: String(parsed.nutritionNotes || "").trim(),
      foodItems,
    };
  };

  const handleAnalyzeAI = async () => {
    if (!capturedImage) return;
    if (!GEMINI_API_KEY) {
      setAnalysisError("API key Gemini belum diset. Tambahkan VITE_GEMINI_API_KEY di environment.");
      return;
    }

    const parsedImage = parseDataUrl(capturedImage);
    if (!parsedImage) {
      setAnalysisError("Format gambar tidak valid.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError("");

    const isWorkout = captureType === "activity";
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    try {
      const prompt = isWorkout
        ? `Ini screenshot ringkasan olahraga dari aplikasi fitness (mis. Apple Fitness, Strava, Garmin, dll).
Baca semua teks dan angka yang terlihat di gambar (tanggal, jenis aktivitas, rentang waktu, lokasi, dan blok "Workout Details" / metrik).

Balas HANYA JSON valid (tanpa markdown), dengan struktur persis:
{
  "activityType": "string",
  "dateLine": "string",
  "timeRange": "string",
  "location": "string",
  "workoutTime": "string",
  "distance": "string",
  "activeKilocalories": "string",
  "totalKilocalories": "string",
  "elevationGain": "string",
  "avgPower": "string",
  "avgCadence": "string",
  "avgPace": "string",
  "avgHeartRate": "string",
  "summaryText": "string multiline: salin/gabungkan informasi penting seperti contoh berikut (gunakan \\n untuk baris baru):\\nSat, 14 Feb\\nOutdoor Run\\n06.34-08.03\\n📍 Kabupaten Berau\\nWorkout Details\\nWorkout Time: 1:28:47\\nDistance: 10,06KM\\n..."
}
Gunakan string kosong "" jika field tidak terbaca. summaryText wajib berisi ringkasan lengkap yang bisa dibaca manusia.`
        : `Analisis gambar makanan ini secara detail. Estimasi nutrisi untuk SELURUH piring dan daftar tiap komponen.

Balas HANYA JSON valid (tanpa markdown), dengan struktur:
{
  "foodName": "judul singkat hidangan (boleh Bahasa Indonesia)",
  "totalCalories": 1442,
  "proteinG": 45,
  "fatsG": 60,
  "carbsG": 180,
  "fiberG": 23,
  "waterMl": 350,
  "vitA_RE": 400,
  "vitD_mcg": 2.5,
  "vitE_mg": 5,
  "vitK_mcg": 15,
  "vitC_mg": 30,
  "nutritionNotes": "1-2 kalimat saran konsumsi yang actionable dalam Bahasa Indonesia (contoh: kurangi gorengan/berminyak, tambah sayur, atur porsi, batasi santan/gula/garam sesuai konteks makanan)",
  "items": [
    { "name": "Nasi putih", "detail": "1 mangkuk • 200 kkal" },
    { "name": "Ikan goreng", "detail": "1 porsi • 310 kkal" }
  ]
}

Aturan:
- totalCalories = estimasi TOTAL energi (kilokalori) seluruh makanan.
- proteinG, fatsG, carbsG = gram; fiberG = gram; waterMl = mililiter air perkiraan dari makanan/minuman dalam gambar.
- vitA_RE = Retinol Ekuivalen (RE); vitD_mcg, vitK_mcg, vitC_mcg, vitE_mg sesuai satuan di kunci (perkirakan jika tidak ada data pasti).
- Gunakan null untuk angka yang benar-benar tidak bisa diperkirakan (bukan 0 sembarangan).
- nutritionNotes WAJIB berupa saran praktis konsumsi, bukan disclaimer umum.
- items: WAJIB gunakan Bahasa Indonesia untuk "name" dan "detail". Contoh detail: "1 sendok makan • 45 kkal" (pisahkan porsi dan kkal dengan " • ").
- Jika komponen tidak jelas, perkirakan porsi wajar dari tampilan foto.`;

      let response = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: prompt.trim() },
                    {
                      inline_data: {
                        mime_type: parsedImage.mimeType,
                        data: parsedImage.base64Data,
                      },
                    },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.2,
                responseMimeType: "application/json",
              },
            }),
          }
        );

        if (response.ok) break;
        if (response.status === 429 && attempt < 2) {
          await wait(800 * (attempt + 1));
          continue;
        }

        const detail = await response.text().catch(() => "");
        const requestError = new Error(
          `Gemini request failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`
        );
        requestError.status = response.status;
        throw requestError;
      }

      if (!response || !response.ok) {
        const fallbackError = new Error("Gemini request failed (unknown)");
        fallbackError.status = 0;
        throw fallbackError;
      }

      const data = await response.json();
      const textResult = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      const parsed = JSON.parse(textResult);

      if (isWorkout) {
        const workoutPayload = {
          type: "activity",
          image: capturedImage,
          createdAt: Date.now(),
          activityType: String(parsed.activityType || "").trim() || "Workout",
          dateLine: String(parsed.dateLine || "").trim(),
          timeRange: String(parsed.timeRange || "").trim(),
          location: String(parsed.location || "").trim(),
          workoutTime: String(parsed.workoutTime || "").trim(),
          distance: String(parsed.distance || "").trim(),
          activeKilocalories: String(parsed.activeKilocalories || "").trim(),
          totalKilocalories: String(parsed.totalKilocalories || "").trim(),
          elevationGain: String(parsed.elevationGain || "").trim(),
          avgPower: String(parsed.avgPower || "").trim(),
          avgCadence: String(parsed.avgCadence || "").trim(),
          avgPace: String(parsed.avgPace || "").trim(),
          avgHeartRate: String(parsed.avgHeartRate || "").trim(),
          summaryText: String(parsed.summaryText || "").trim(),
        };
        localStorage.setItem(TEMP_WORKOUT_KEY, JSON.stringify(workoutPayload));
        closeCapture();
        navigate("/activity/analysis/result");
        return;
      }

      const result = normalizeFoodAnalysis(parsed);

      setAnalysisResult(result);
      localStorage.setItem(
        TEMP_ANALYSIS_KEY,
        JSON.stringify({
          type: captureType,
          image: capturedImage,
          ...result,
          createdAt: Date.now(),
        })
      );
      closeCapture();
      navigate("/food-analysis/result");
    } catch (error) {
      console.error("AI analyze failed:", error);
      const status = Number(error?.status);
      if (status === 429) {
        setAnalysisError("Kuota Gemini sedang penuh (429). Tunggu sebentar lalu coba lagi, atau cek quota/billing API key.");
      } else {
        setAnalysisError(isWorkout ? "Gagal membaca screenshot workout. Coba foto lebih jelas." : "Gagal analisis AI. Coba lagi.");
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="bg-surface font-['Public_Sans',sans-serif] text-on-surface h-dvh min-h-dvh overflow-hidden">
      <div className="max-w-md mx-auto bg-surface-container-lowest h-full shadow-xl flex flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] bg-emerald-50/80 backdrop-blur-md z-10">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <span className="material-symbols-outlined text-primary">health_metrics</span>
          </div>
          <h1 className="text-lg font-bold flex-1 text-center">My Health Summary</h1>
          <button className="flex size-10 items-center justify-center rounded-xl bg-slate-100">
            <span className="material-symbols-outlined text-slate-600">notifications</span>
          </button>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
        <section className="p-4 flex items-center gap-4">
          <div className="relative">
            <div className="size-20 rounded-full border-2 border-primary p-1 overflow-hidden bg-slate-100">
              <img
                src={avatarPhoto}
                alt=""
                className="size-full rounded-full object-cover"
              />
            </div>
            <div className="absolute bottom-0 right-0 size-6 bg-green-500 border-2 border-white rounded-full" />
          </div>
          <div>
            <h2 className="text-2xl font-bold leading-tight">Halo, {greetingName}!</h2>
            <p className="text-slate-500 text-sm">Ayo capai target kesehatanmu hari ini.</p>
          </div>
        </section>

        <section className="px-4 py-2">
          <div className="bg-primary/5 rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3 uppercase tracking-wider text-primary">Konsistensi Mingguan</h3>
            <div className="flex justify-between items-center">
              {["M", "S", "S", "R"].map((day, idx) => (
                <div key={`${day}-${idx}`} className="flex flex-col items-center gap-2">
                  <span className="text-xs font-medium text-slate-400">{day}</span>
                  <div className="size-8 rounded-full bg-primary text-white flex items-center justify-center">
                    <span className="material-symbols-outlined text-sm font-bold">check</span>
                  </div>
                </div>
              ))}
              {["K", "J", "S"].map((day, idx) => (
                <div key={`${day}-${idx}`} className="flex flex-col items-center gap-2">
                  <span className="text-xs font-medium text-slate-400">{day}</span>
                  <div className="size-8 rounded-full border-2 border-primary/30 flex items-center justify-center" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="p-4 grid grid-cols-2 gap-4">
          <Link to="/nutrition/insight" className="bg-white border border-slate-100 p-4 rounded-xl flex flex-col items-center shadow-sm active:scale-[0.99] transition-transform">
            <div className="relative size-24 mb-3">
              <svg className="size-full" viewBox="0 0 36 36">
                <path className="text-slate-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeDasharray="100, 100" strokeWidth="3" />
                <path
                  className={isOverDailyCalorieTarget ? "text-amber-500" : "text-primary"}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeDasharray={`${todayCalorieProgressPercent}, 100`}
                  strokeLinecap="round"
                  strokeWidth="3"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold">{todayCalorieText}</span>
                <span className="text-[10px] text-slate-400">kkal</span>
              </div>
            </div>
            <p className="text-sm font-bold">Nutrisi Hari Ini</p>
            <p className="text-xs text-center text-slate-500">{todayCalorieProgressPercentRaw}% dari target <br></br> {DAILY_CALORIE_TARGET.toLocaleString("id-ID")} kkal</p>
          </Link>
          <div className="bg-white border border-slate-100 p-4 rounded-xl flex flex-col items-center shadow-sm">
            <div className="relative size-24 mb-3">
              <svg className="size-full" viewBox="0 0 36 36">
                <path className="text-slate-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeDasharray="100, 100" strokeWidth="3" />
                <path className="text-primary" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeDasharray="50, 100" strokeLinecap="round" strokeWidth="3" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold">30</span>
                {/* <span className="material-symbols-outlined text-primary text-sm">steps</span> */}
                <p className="text-xs text-slate-500">Menit</p>
              </div>
            </div>
            <p className="text-sm font-bold">Olahraga Hari Ini</p>
            <p className="text-xs text-center text-slate-500">50% dari target <br></br> 60 Menit</p>
          </div>
        </section>

        <section className="px-4 py-2">
          <h3 className="text-sm font-bold mb-3">Aksi Cepat</h3>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setCaptureType("food");
                setIsCaptureOpen(true);
              }}
              className="flex-1 bg-primary text-white py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
            >
              <span className="material-symbols-outlined">restaurant</span>
              Makanan
            </button>
            <button
              onClick={() => {
                setCaptureType("activity");
                setIsCaptureOpen(true);
              }}
              className="flex-1 bg-slate-900 text-white py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">exercise</span>
              Olahraga
            </button>
          </div>
        </section>

        <section className="px-4 py-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold">Aktivitas Terakhir</h3>
            <Link to="/history" className="text-xs font-semibold text-primary">
              Lihat Semua
            </Link>
          </div>
          <div className="space-y-3">
            {todayHistoryItems.length === 0
              ? defaultActivityCards.map((card) => (
                  <Link
                    key={card.key}
                    to={card.to}
                    className="w-full text-left flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm active:scale-[0.99] transition-transform"
                  >
                    <div className={`size-12 rounded-lg flex items-center justify-center ${card.iconWrap}`}>
                      <span className="material-symbols-outlined">{card.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold">{card.title}</p>
                      <p className="text-xs text-slate-500 truncate">{card.subtitle}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-primary">{card.calories}</p>
                    </div>
                  </Link>
                ))
              : todayHistoryItems.map((it) => {
                  const title =
                    (it.type === "activity" ? it.activityType || it.foodName : it.foodName)?.trim() ||
                    (it.type === "food" ? "Upload makanan" : "Upload olahraga");
                  const timeStr = new Date(it.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
                  const desc =
                    (it.type === "activity" ? it.workoutSummary || it.nutritionNotes : it.nutritionNotes)?.trim() ||
                    (it.type === "food"
                      ? "Foto konsumsi makanan untuk tracking nutrisi."
                      : "Foto aktivitas untuk tracking latihan.");
                  const subtitle = `Hari ini • ${timeStr} • ${desc.length > 42 ? `${desc.slice(0, 42)}…` : desc}`;
                  const calStr = it.calories != null && it.calories !== "" ? `${it.calories} kkal` : "—";
                  const isFood = it.type === "food";
                  return (
                    <Link
                      key={it.id}
                      to={`/history/${it.id}`}
                      className="w-full text-left flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm active:scale-[0.99] transition-transform"
                    >
                      <div
                        className={`size-12 rounded-lg flex items-center justify-center shrink-0 overflow-hidden ${
                          isFood ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"
                        }`}
                      >
                        {it.image ? (
                          <img src={it.image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="material-symbols-outlined">{isFood ? "restaurant" : "exercise"}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{title}</p>
                        <p className="text-xs text-slate-500 line-clamp-2">{subtitle}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-primary">{calStr}</p>
                      </div>
                    </Link>
                  );
                })}
          </div>
        </section>
        </main>

        <nav className="absolute bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-100 px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex justify-between items-center z-20">
          <Link to="/home" className="flex flex-col items-center gap-1 text-primary" href="#">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              grid_view
            </span>
            <span className="text-[10px] font-bold">Dashboard</span>
          </Link>
          <Link className="flex flex-col items-center gap-1 text-slate-400" to="/nutrition/insight">
            <span className="material-symbols-outlined">restaurant</span>
            <span className="text-[10px] font-medium">Makanan</span>
          </Link>
          <div className="relative -top-8">
            <Link to="/activity/capture" className="size-14 bg-primary rounded-full text-white shadow-xl shadow-primary/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl">add</span>
            </Link>
          </div>
          <Link className="flex flex-col items-center gap-1 text-slate-400" to="/workout/insight">
            <span className="material-symbols-outlined">exercise</span>
            <span className="text-[10px] font-medium">Olahraga</span>
          </Link>
          <Link className="flex flex-col items-center gap-1 text-slate-400" to="/profile">
            <span className="material-symbols-outlined">person</span>
            <span className="text-[10px] font-medium">Profil</span>
          </Link>
        </nav>
      </div>

      {isCaptureOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                {captureType === "activity" ? "Foto ringkasan workout" : "Foto / Upload makanan"}
              </h3>
              <button onClick={closeCapture} className="text-slate-500 hover:text-slate-700">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
              {capturedImage ? (
                <img src={capturedImage} alt="Hasil foto" className="w-full aspect-video object-cover" />
              ) : (
                <video ref={videoRef} autoPlay playsInline muted className="w-full aspect-video object-cover" />
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCapture}
                className="flex-1 bg-primary text-white py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined">photo_camera</span>
                Ambil Foto
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined">upload</span>
                Upload Foto
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUploadImage} className="hidden" />
            </div>
            <button
              onClick={() => setCameraFacing((prev) => (prev === "environment" ? "user" : "environment"))}
              className="w-full bg-slate-100 text-slate-700 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">flip_camera_android</span>
              Switch Kamera ({cameraFacing === "environment" ? "Belakang" : "Depan"})
            </button>

            {capturedImage && (
              <>
                {isAnalyzing && (
                  <div className="w-full rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex flex-col items-center gap-3">
                    <div className="size-9 rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin" />
                    <p className="text-sm font-semibold text-emerald-700">
                      {captureType === "activity"
                        ? "AI membaca screenshot workout…"
                        : "AI sedang menganalisis makanan…"}
                    </p>
                    <div className="flex items-center gap-1">
                      <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="size-2 rounded-full bg-emerald-500 animate-pulse [animation-delay:150ms]" />
                      <span className="size-2 rounded-full bg-emerald-500 animate-pulse [animation-delay:300ms]" />
                    </div>
                  </div>
                )}
                <button
                  onClick={handleAnalyzeAI}
                  disabled={isAnalyzing}
                  className="w-full bg-primary text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <span className="material-symbols-outlined">analytics</span>
                  {isAnalyzing ? "Memproses…" : captureType === "activity" ? "Ekstrak data workout" : "Analisis AI"}
                </button>
                {analysisError && <p className="text-xs text-red-500">{analysisError}</p>}
                {analysisResult && captureType === "food" && (
                  <div className="w-full rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-left">
                    <p className="text-sm font-bold text-emerald-700">{analysisResult.foodName}</p>
                    <p className="text-xs text-emerald-700 mt-1">Total: {analysisResult.totalCalories ?? analysisResult.calories} Cal</p>
                    {analysisResult.foodItems?.length ? (
                      <p className="text-[10px] text-emerald-600 mt-1">{analysisResult.foodItems.length} item terdeteksi</p>
                    ) : null}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
