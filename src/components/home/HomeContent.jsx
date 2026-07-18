import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getSessionUser, mergeSessionUser } from "../../auth/auth";
import { apiRequest, getAuthToken, isApiBackendEnabled } from "../../lib/apiClient";
import { compressDataUrlForAi } from "../../lib/imageCompressForAi";
import { isNativeApp } from "../../lib/nativePlatform";
import { fetchGeminiFoodAnalysis } from "../../lib/foodAnalysisGemini";
import {
  canUseGeminiBackend,
  fetchGeminiFoodViaBackend,
  fetchGeminiWorkoutViaBackend,
} from "../../lib/geminiBackend";
import { getGeminiApiKeyConfigError } from "../../lib/geminiEnv";
import { hydrateUserDataFromCloud } from "../../services/supabaseDataService";
import { parseWorkoutTimeStringToMinutes } from "../../lib/workoutDurationMinutes";
import { showError } from "../../lib/appAlert";
import { buildWeekUploadCells, summarizeWeekConsistency } from "../../utils/weeklyUploadConsistency";
import PopularCommunitiesSection from "../community/PopularCommunitiesSection";
import { fetchTodayHealthAlerts, hasHealthAlerts } from "../../lib/healthAlertApi";
import HealthAlertBanner from "../health/HealthAlertBanner";

function localTodayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const QUICK_ACTIONS_STORAGE_KEY = "health_quick_actions_v5";

const QUICK_ACTION_CATALOG = [
  { key: "makanan", label: "Makanan", icon: "restaurant", iconWrap: "bg-amber-100 text-amber-600", to: "/food" },
  { key: "olahraga", label: "Olahraga", icon: "exercise", iconWrap: "bg-blue-100 text-blue-600", to: "/workout" },
  { key: "nutrisi", label: "Nutrisi", icon: "nutrition", iconWrap: "bg-primary/10 text-primary", to: "/nutrition/insight" },
  { key: "workout", label: "Workout", icon: "fitness_center", iconWrap: "bg-emerald-100 text-emerald-700", to: "/workout/insight" },
  { key: "komunitas", label: "Komunitas", icon: "groups", iconWrap: "bg-indigo-100 text-indigo-600", to: "/community" },
  { key: "main_bareng", label: "Main Bareng", icon: "sports_tennis", iconWrap: "bg-orange-100 text-orange-600", to: "/open-play" },
  { key: "strava", label: "Strava", icon: "directions_run", iconWrap: "bg-orange-100 text-orange-700", to: "/strava" },
  { key: "mcu", label: "MCU", icon: "medical_information", iconWrap: "bg-cyan-100 text-cyan-700", to: "/mcu" },
  { key: "riwayat", label: "Riwayat", icon: "history", iconWrap: "bg-slate-100 text-slate-600", to: "/history" },
  { key: "lari", label: "Lari", icon: "directions_run", iconWrap: "bg-sky-100 text-sky-600", to: "/activity/run" },
  { key: "kognitif", label: "Tes Kognitif", icon: "psychology", iconWrap: "bg-rose-100 text-rose-600", to: "/cognitive-tests" },
  { key: "latihan", label: "Latihan", icon: "list_alt", iconWrap: "bg-teal-100 text-teal-700", to: "/workout/exercises" },
  { key: "profil", label: "Profil", icon: "person", iconWrap: "bg-violet-100 text-violet-600", to: "/profile" },
  { key: "kesehatan", label: "Kesehatan", icon: "monitor_heart", iconWrap: "bg-red-100 text-red-600", to: "/health" },
];

/** 7 menu default + tombol Custom = 8 slot (grid 2×4). */
const DEFAULT_QUICK_ACTION_KEYS = [
  "makanan",
  "olahraga",
  "nutrisi",
  "mcu",
  "komunitas",
  "main_bareng",
  "riwayat",
];

function loadQuickActionKeys() {
  try {
    const raw = localStorage.getItem(QUICK_ACTIONS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed)) return [...DEFAULT_QUICK_ACTION_KEYS];
    const valid = parsed.filter((key) => QUICK_ACTION_CATALOG.some((item) => item.key === key));
    return valid.length ? valid : [...DEFAULT_QUICK_ACTION_KEYS];
  } catch {
    return [...DEFAULT_QUICK_ACTION_KEYS];
  }
}

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
  /** Memicu pembacaan ulang riwayat dari localStorage (sinkron DB). */
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [isQuickActionsCustomOpen, setIsQuickActionsCustomOpen] = useState(false);
  const [quickActionKeys, setQuickActionKeys] = useState(loadQuickActionKeys);
  const [draftQuickActionKeys, setDraftQuickActionKeys] = useState(loadQuickActionKeys);
  const [healthAlert, setHealthAlert] = useState(null);
  /** Kalori olahraga hari ini dari API (workout_analyses + Strava), jika tersedia. */
  const [todayExerciseCaloriesApi, setTodayExerciseCaloriesApi] = useState(null);
  /** Target kalori harian dari goal aktif (null = pakai default). */
  const [goalCalorieTarget, setGoalCalorieTarget] = useState(null);
  const [insightSlideIndex, setInsightSlideIndex] = useState(0);
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);
  const insightSliderRef = useRef(null);

  const HISTORY_KEY = "health_upload_history_v1";
  const TEMP_ANALYSIS_KEY = "health_food_analysis_temp_v1";
  const TEMP_WORKOUT_KEY = "health_workout_analysis_temp_v1";
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
  const DAILY_CALORIE_TARGET_DEFAULT = 2350;
  const DAILY_ACTIVITY_MINUTES_TARGET = 60;

  const sessionUser = getSessionUser();
  const rawName = String(sessionUser?.nama || sessionUser?.name || "").trim();
  const sidValue = String(sessionUser?.sid || sessionUser?.username || "").trim().toLowerCase();
  const greetingName =
    rawName && rawName.toLowerCase() !== sidValue
      ? rawName
      : "Pengguna";
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
  }, [location.pathname, location.key, isCaptureOpen, historyRefresh]);

  const fullHistoryItems = useMemo(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [historyRefresh, location.key, location.pathname, isCaptureOpen]);

  const weekUploadCells = useMemo(() => buildWeekUploadCells(fullHistoryItems), [fullHistoryItems]);
  const weekConsistency = useMemo(() => summarizeWeekConsistency(weekUploadCells), [weekUploadCells]);
  const weekDoneCount = weekConsistency.combinedDays;
  const weekConsistencyPct = weekConsistency.progressPct;
  const weekFoodDays = weekConsistency.foodDays;
  const weekActivityDays = weekConsistency.activityDays;

  /** Maksimal 3 item upload hari ini (terbaru dulu). */
  const todayHistoryItems = useMemo(() => todayHistoryAllItems.slice(0, 3), [todayHistoryAllItems]);

  /** Kkal makanan hari ini (sinkron DB → localStorage), selaras halaman nutrisi. */
  const todayFoodCalories = useMemo(
    () =>
      todayHistoryAllItems.reduce(
        (total, it) => (it?.type === "food" ? total + parseCaloriesValue(it?.calories) : total),
        0
      ),
    [todayHistoryAllItems]
  );
  const todayFoodCaloriesRounded = Math.max(0, Math.round(todayFoodCalories));

  /** Kkal olahraga dari riwayat aktivitas lokal (fallback jika API belum ada). */
  const todayExerciseCaloriesLocal = useMemo(
    () =>
      todayHistoryAllItems.reduce((total, it) => {
        if (it?.type !== "activity") return total;
        return total + parseCaloriesValue(it?.calories);
      }, 0),
    [todayHistoryAllItems]
  );
  const todayExerciseCaloriesRounded = Math.max(
    0,
    Math.round(
      todayExerciseCaloriesApi != null ? todayExerciseCaloriesApi : todayExerciseCaloriesLocal
    )
  );

  const baseCalorieGoal =
    goalCalorieTarget != null && Number.isFinite(goalCalorieTarget) && goalCalorieTarget > 0
      ? Math.round(goalCalorieTarget)
      : DAILY_CALORIE_TARGET_DEFAULT;
  const remainingCalories = Math.round(baseCalorieGoal - todayFoodCaloriesRounded + todayExerciseCaloriesRounded);
  const todayFoodCalorieProgressPercentRaw = Math.max(
    0,
    Math.round((todayFoodCaloriesRounded / baseCalorieGoal) * 100)
  );
  const todayFoodCalorieProgressPercent = Math.min(todayFoodCalorieProgressPercentRaw, 100);
  const isOverDailyFoodCalorieTarget = todayFoodCaloriesRounded > baseCalorieGoal;
  const formatKcal = (n) => Math.round(Number(n) || 0).toLocaleString("id-ID");

  /** Total menit olahraga tercatat hari ini (dari riwayat type activity). */
  const todayActivityMinutesTotal = useMemo(
    () =>
      todayHistoryAllItems.reduce((total, it) => {
        if (it?.type !== "activity") return total;
        const wt = it?.workoutMetrics?.workoutTime ?? it?.workoutTime ?? "";
        return total + parseWorkoutTimeStringToMinutes(wt);
      }, 0),
    [todayHistoryAllItems]
  );
  const todayActivityMinutesRounded = Math.max(0, Math.round(todayActivityMinutesTotal));
  const todayActivityProgressPercentRaw = Math.max(
    0,
    Math.round((todayActivityMinutesRounded / DAILY_ACTIVITY_MINUTES_TARGET) * 100)
  );
  const todayActivityProgressPercent = Math.min(todayActivityProgressPercentRaw, 100);
  const todayActivityMinutesText = todayActivityMinutesRounded.toLocaleString("id-ID");
  const isOverDailyActivityTarget = todayActivityMinutesRounded > DAILY_ACTIVITY_MINUTES_TARGET;
  const remainingActivityMinutes = Math.max(
    0,
    DAILY_ACTIVITY_MINUTES_TARGET - todayActivityMinutesRounded
  );
  const insightSlideCount = 4;

  const handleInsightSliderScroll = () => {
    const el = insightSliderRef.current;
    if (!el) return;
    const slideWidth = el.clientWidth;
    if (!slideWidth) return;
    const next = Math.round(el.scrollLeft / slideWidth);
    setInsightSlideIndex(Math.max(0, Math.min(insightSlideCount - 1, next)));
  };

  const scrollInsightTo = (index) => {
    const el = insightSliderRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(insightSlideCount - 1, index));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
    setInsightSlideIndex(clamped);
  };

  const defaultActivityCards = [
   
    {
      key: "default-breakfast",
      to: "/activity/run?preset=sarapan",
      title: "Tidak Ada Aktivitas Hari Ini",
      subtitle: "Hari ini",
      calories: "- kkal",
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
    const st = location.state;
    if (!st?.openFoodCapture) return;
    const meal =
      ["breakfast", "lunch", "dinner", "snack"].includes(st.mealType) ? st.mealType : null;
    if (meal) {
      try {
        sessionStorage.setItem("food_log_meal_type_v1", meal);
      } catch {
        /* ignore */
      }
    }
    setCaptureType("food");
    setIsCaptureOpen(true);
    navigate("/home", { replace: true, state: {} });
  }, [location.state, navigate]);

  useEffect(() => {
    const st = location.state;
    if (!st?.openActivityCapture) return;
    setCaptureType("activity");
    setIsCaptureOpen(true);
    navigate("/home", { replace: true, state: {} });
  }, [location.state, navigate]);

  useEffect(() => {
    const bump = () => setHistoryRefresh((x) => x + 1);
    window.addEventListener("focus", bump);
    return () => window.removeEventListener("focus", bump);
  }, []);

  useEffect(() => {
    if (!isApiBackendEnabled() || !sessionUser?.id) return;
    let cancelled = false;
    (async () => {
      try {
        if (!sessionUser?.mcu) {
          const mcuRes = await apiRequest("/me/mcu");
          if (!cancelled && mcuRes?.mcu) {
            mergeSessionUser({ mcu: mcuRes.mcu });
          }
        }
        const alert = await fetchTodayHealthAlerts();
        if (!cancelled) setHealthAlert(hasHealthAlerts(alert) ? alert : null);
      } catch {
        if (!cancelled) setHealthAlert(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [location.pathname, location.key, sessionUser?.id, historyRefresh]);

  useEffect(() => {
    if (location.pathname !== "/home") return;
    let cancelled = false;
    (async () => {
      const uid = sessionUser?.id;
      if (isApiBackendEnabled() && uid) {
        await hydrateUserDataFromCloud(uid);
      }
      if (!cancelled) setHistoryRefresh((x) => x + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [location.pathname, location.key, sessionUser?.id]);

  useEffect(() => {
    if (!isApiBackendEnabled() || !sessionUser?.id) {
      setTodayExerciseCaloriesApi(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const date = localTodayYmd();
        const data = await apiRequest(
          `/me/workouts/weekly-summary?date=${encodeURIComponent(date)}`
        );
        if (cancelled) return;
        if (data?.user_id != null && String(data.user_id) !== String(sessionUser.id)) {
          setTodayExerciseCaloriesApi(null);
          return;
        }
        const today = Array.isArray(data?.days) ? data.days.find((d) => d.date === date) : null;
        const kcal = today?.calories_kcal != null ? Number(today.calories_kcal) : null;
        setTodayExerciseCaloriesApi(Number.isFinite(kcal) ? kcal : 0);
      } catch {
        if (!cancelled) setTodayExerciseCaloriesApi(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [location.pathname, location.key, sessionUser?.id, historyRefresh]);

  useEffect(() => {
    if (!isApiBackendEnabled() || !sessionUser?.id) {
      setGoalCalorieTarget(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const date = localTodayYmd();
        const data = await apiRequest(`/me/goals/dashboard?date=${encodeURIComponent(date)}`);
        if (cancelled) return;
        if (data?.user_id != null && String(data.user_id) !== String(sessionUser.id)) {
          setGoalCalorieTarget(null);
          return;
        }
        const target = data?.daily_target?.calorie_target;
        const n = target != null ? Number(target) : null;
        setGoalCalorieTarget(Number.isFinite(n) && n > 0 ? n : null);
      } catch {
        if (!cancelled) setGoalCalorieTarget(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [location.pathname, location.key, sessionUser?.id, historyRefresh]);

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

  const handleAnalyzeAI = async () => {
    if (!capturedImage) return;
    const useGeminiBackend = canUseGeminiBackend();

    if (isNativeApp() && !useGeminiBackend) {
      if (!isApiBackendEnabled()) {
        setAnalysisError(
          "Analisis AI di aplikasi memerlukan API server: pastikan VITE_API_URL di-set saat build, lalu rebuild APK."
        );
        return;
      }
      if (!getAuthToken()) {
        setAnalysisError(
          "Silakan login terlebih dahulu. Di aplikasi Android, analisis foto memakai server (bukan kunci Gemini dari perangkat)."
        );
        return;
      }
    }

    const keyErr = useGeminiBackend ? "" : getGeminiApiKeyConfigError(GEMINI_API_KEY);
    if (keyErr) {
      setAnalysisError(keyErr);
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError("");
    setAnalysisResult(null);

    const isWorkout = captureType === "activity";
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    try {
      /** APK: payload JSON base64 besar — kompresi agresif (WebView/Cloudflare lebih sensitif dari desktop). */
      const compressOpts = isNativeApp()
        ? { maxEdge: 640, quality: 0.6 }
        : {};
      const imageForAi = await compressDataUrlForAi(capturedImage, compressOpts);
      const parsedImage = parseDataUrl(imageForAi);
      if (!parsedImage) {
        setAnalysisError("Format gambar tidak valid.");
        return;
      }

      if (isWorkout) {
        const prompt = `Ini screenshot ringkasan olahraga dari aplikasi fitness (mis. Apple Fitness, Strava, Garmin, dll).
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
Gunakan string kosong "" jika field tidak terbaca. summaryText wajib berisi ringkasan lengkap yang bisa dibaca manusia.`;

        let parsed;
        if (useGeminiBackend) {
          parsed = await fetchGeminiWorkoutViaBackend(parsedImage);
        } else {
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
          parsed = JSON.parse(textResult);
        }

        const workoutPayload = {
          type: "activity",
          image: imageForAi,
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

      const result = useGeminiBackend
        ? await fetchGeminiFoodViaBackend(parsedImage)
        : await fetchGeminiFoodAnalysis(GEMINI_API_KEY, parsedImage);

      setAnalysisResult(result);
      let mealType = "lunch";
      try {
        const stored = sessionStorage.getItem("food_log_meal_type_v1");
        if (["breakfast", "lunch", "dinner", "snack"].includes(stored)) mealType = stored;
      } catch {
        /* ignore */
      }
      localStorage.setItem(
        TEMP_ANALYSIS_KEY,
        JSON.stringify({
          type: "food",
          image: imageForAi,
          ...result,
          meal_type: mealType,
          mealType,
          source_type: "photo",
          sourceType: "photo",
          createdAt: Date.now(),
        })
      );
      closeCapture();
      navigate("/food-analysis/result");
    } catch (error) {
      console.error("AI analyze failed:", error);
      const status = Number(error?.status);
      const raw = typeof error?.message === "string" ? error.message.trim() : "";
      showError(
        "Analisis AI gagal",
        status === 429
          ? "Kuota Gemini sedang penuh. Coba lagi sebentar lagi."
          : "Foto gagal dianalisis. Detail ada di layar, coba lagi."
      );
      if (status === 429) {
        setAnalysisError(
          "Kuota Gemini sedang penuh (429). Tunggu sebentar lalu coba lagi, atau cek quota/billing API key."
        );
      } else if (raw) {
        const netFail =
          raw === "Failed to fetch" ||
          raw.includes("NetworkError") ||
          raw.includes("Load failed") ||
          raw.includes("network");
        if (netFail) {
          setAnalysisError(
            isWorkout
              ? "Koneksi ke server putus saat upload/analisis gambar. Di VPS: naikkan client_max_body_size (mis. 25m), proxy_read_timeout dan proxy_send_timeout (mis. 180–300s) untuk lokasi /api/. Coba foto lebih ringan."
              : "Jaringan ke server putus saat kirim foto untuk AI (bukan masalah login). Umumnya: body terlalu besar untuk Nginx (default ~1m) atau timeout saat server memanggil Gemini. Set client_max_body_size 25m; proxy_read_timeout / proxy_send_timeout 180–300s; pastikan VITE_API_URL di build APK = origin API production (HTTPS). Lalu reload Nginx dan rebuild APK jika URL berubah."
          );
        } else {
          setAnalysisError(raw.length > 360 ? `${raw.slice(0, 360)}…` : raw);
        }
      } else {
        setAnalysisError(
          isWorkout ? "Gagal membaca screenshot workout. Coba foto lebih jelas." : "Gagal analisis AI. Coba lagi."
        );
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

        {hasHealthAlerts(healthAlert) ? (
          <section className="px-4 pb-2">
            <HealthAlertBanner healthAlert={healthAlert} compact />
          </section>
        ) : null}

        <section className="px-4 py-2">
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Konsistensi mingguan</h3>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Gabungan hari aktif: makanan atau olahraga
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold tabular-nums text-primary">
                {weekDoneCount}/7
              </span>
            </div>
            <div className="flex justify-between items-center gap-1">
              {weekUploadCells.map((cell) => {
                const both = cell.food && cell.activity;
                const onlyFood = cell.food && !cell.activity;
                const onlyAct = cell.activity && !cell.food;
                let title = `${cell.title} · belum ada upload`;
                if (both) title = `${cell.title} · makanan + olahraga`;
                else if (onlyFood) title = `${cell.title} · makanan`;
                else if (onlyAct) title = `${cell.title} · olahraga`;
                return (
                  <div key={cell.dateKey} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                    <span
                      className="w-full truncate text-center text-[10px] font-medium text-slate-400"
                      title={cell.title}
                    >
                      {cell.label}
                    </span>
                    <div
                      title={title}
                      className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                        both
                          ? "bg-primary text-white"
                          : onlyFood
                            ? "bg-emerald-500 text-white"
                            : onlyAct
                              ? "bg-sky-500 text-white"
                              : "border-2 border-slate-200 bg-slate-50"
                      }`}
                    >
                      {cell.done ? (
                        <span className="material-symbols-outlined text-[14px] font-bold leading-none">
                          {both ? "done_all" : onlyFood ? "restaurant" : "exercise"}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-2.5 text-[10px] text-slate-500">
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-emerald-500" /> Makanan {weekFoodDays}h
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-sky-500" /> Olahraga {weekActivityDays}h
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-primary" /> Gabungan {weekDoneCount}h
              </span>
            </div>
          </div>
        </section>

        <section className="pt-4 pb-3">
          <div
            ref={insightSliderRef}
            onScroll={handleInsightSliderScroll}
            className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {/* Slide 1: Kalori / Nutrisi */}
            <div className="w-full shrink-0 snap-center px-4">
              <Link
                to="/nutrition/insight"
                className="block bg-white border border-slate-100 p-4 rounded-2xl shadow-sm active:scale-[0.99] transition-transform"
              >
                <div className="mb-3">
                  <p className="text-base font-bold text-slate-900">Nutrisi Hari Ini</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Sisa = Target − Makanan + Olahraga
                  </p>
                </div>
                <div className="flex items-center gap-5">
                  <div className="relative size-28 shrink-0">
                    <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-slate-100"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeDasharray="100, 100"
                        strokeWidth="2.8"
                      />
                      <path
                        className={isOverDailyFoodCalorieTarget ? "text-amber-500" : "text-sky-500"}
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeDasharray={`${todayFoodCalorieProgressPercent}, 100`}
                        strokeLinecap="round"
                        strokeWidth="2.8"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-black tabular-nums leading-none text-slate-900">
                        {formatKcal(remainingCalories)}
                      </span>
                      <span className="text-[11px] text-slate-400 mt-1">Sisa</span>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="material-symbols-outlined text-[20px] text-slate-400">flag</span>
                        <span className="text-sm text-slate-600 truncate">
                          {goalCalorieTarget != null ? "Target Goal" : "Target Dasar"}
                        </span>
                      </div>
                      <span className="text-sm font-bold tabular-nums text-slate-900">
                        {formatKcal(baseCalorieGoal)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="material-symbols-outlined text-[20px] text-sky-500">restaurant</span>
                        <span className="text-sm text-slate-600 truncate">Makanan</span>
                      </div>
                      <span className="text-sm font-bold tabular-nums text-slate-900">
                        {formatKcal(todayFoodCaloriesRounded)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="material-symbols-outlined text-[20px] text-orange-500">local_fire_department</span>
                        <span className="text-sm text-slate-600 truncate">Olahraga</span>
                      </div>
                      <span className="text-sm font-bold tabular-nums text-slate-900">
                        {formatKcal(todayExerciseCaloriesRounded)}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </div>

            {/* Slide 2: Olahraga menit */}
            <div className="w-full shrink-0 snap-center px-4">
              <Link
                to="/workout/insight"
                className="block bg-white border border-slate-100 p-4 rounded-2xl shadow-sm active:scale-[0.99] transition-transform"
              >
                <div className="mb-3">
                  <p className="text-base font-bold text-slate-900">Olahraga Hari Ini</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Sisa = Target − Selesai
                  </p>
                </div>
                <div className="flex items-center gap-5">
                  <div className="relative size-28 shrink-0">
                    <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-slate-100"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeDasharray="100, 100"
                        strokeWidth="2.8"
                      />
                      <path
                        className={isOverDailyActivityTarget ? "text-amber-500" : "text-primary"}
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeDasharray={`${todayActivityProgressPercent}, 100`}
                        strokeLinecap="round"
                        strokeWidth="2.8"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-black tabular-nums leading-none text-slate-900">
                        {remainingActivityMinutes}
                      </span>
                      <span className="text-[11px] text-slate-400 mt-1">Sisa menit</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="material-symbols-outlined text-[20px] text-slate-400">flag</span>
                        <span className="text-sm text-slate-600 truncate">Target</span>
                      </div>
                      <span className="text-sm font-bold tabular-nums text-slate-900">
                        {DAILY_ACTIVITY_MINUTES_TARGET} mnt
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="material-symbols-outlined text-[20px] text-primary">exercise</span>
                        <span className="text-sm text-slate-600 truncate">Selesai</span>
                      </div>
                      <span className="text-sm font-bold tabular-nums text-slate-900">
                        {todayActivityMinutesText} mnt
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="material-symbols-outlined text-[20px] text-orange-500">local_fire_department</span>
                        <span className="text-sm text-slate-600 truncate">Kalori</span>
                      </div>
                      <span className="text-sm font-bold tabular-nums text-slate-900">
                        {formatKcal(todayExerciseCaloriesRounded)}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </div>

            {/* Slide 3: Kalori olahraga detail */}
            <div className="w-full shrink-0 snap-center px-4">
              <Link
                to="/strava"
                className="block bg-white border border-slate-100 p-4 rounded-2xl shadow-sm active:scale-[0.99] transition-transform"
              >
                <div className="mb-3">
                  <p className="text-base font-bold text-slate-900">Kalori Olahraga</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Dari workout upload + Strava hari ini
                  </p>
                </div>
                <div className="flex items-center gap-5">
                  <div className="relative size-28 shrink-0">
                    <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-slate-100"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeDasharray="100, 100"
                        strokeWidth="2.8"
                      />
                      <path
                        className="text-orange-500"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeDasharray={`${Math.min(100, Math.round((todayExerciseCaloriesRounded / 500) * 100))}, 100`}
                        strokeLinecap="round"
                        strokeWidth="2.8"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-black tabular-nums leading-none text-slate-900">
                        {formatKcal(todayExerciseCaloriesRounded)}
                      </span>
                      <span className="text-[11px] text-slate-400 mt-1">kkal</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="material-symbols-outlined text-[20px] text-slate-400">flag</span>
                        <span className="text-sm text-slate-600 truncate">Acuan</span>
                      </div>
                      <span className="text-sm font-bold tabular-nums text-slate-900">500</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="material-symbols-outlined text-[20px] text-orange-500">local_fire_department</span>
                        <span className="text-sm text-slate-600 truncate">Terbakar</span>
                      </div>
                      <span className="text-sm font-bold tabular-nums text-slate-900">
                        {formatKcal(todayExerciseCaloriesRounded)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="material-symbols-outlined text-[20px] text-primary">timer</span>
                        <span className="text-sm text-slate-600 truncate">Durasi</span>
                      </div>
                      <span className="text-sm font-bold tabular-nums text-slate-900">
                        {todayActivityMinutesText} mnt
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </div>

            {/* Slide 4: Konsistensi minggu (makanan + olahraga) */}
            <div className="w-full shrink-0 snap-center px-4">
              <Link
                to="/history"
                className="block bg-white border border-slate-100 p-4 rounded-2xl shadow-sm active:scale-[0.99] transition-transform"
              >
                <div className="mb-3">
                  <p className="text-base font-bold text-slate-900">Konsistensi Minggu</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Hari aktif gabungan · makanan atau olahraga
                  </p>
                </div>
                <div className="flex items-center gap-5">
                  <div className="relative size-28 shrink-0">
                    <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-slate-100"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeDasharray="100, 100"
                        strokeWidth="2.8"
                      />
                      <path
                        className="text-indigo-500"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeDasharray={`${weekConsistencyPct}, 100`}
                        strokeLinecap="round"
                        strokeWidth="2.8"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-black tabular-nums leading-none text-slate-900">
                        {weekDoneCount}
                      </span>
                      <span className="text-[11px] text-slate-400 mt-1">dari 7</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="material-symbols-outlined text-[20px] text-emerald-500">
                          restaurant
                        </span>
                        <span className="text-sm text-slate-600 truncate">Makanan</span>
                      </div>
                      <span className="text-sm font-bold tabular-nums text-slate-900">
                        {weekFoodDays} hari
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="material-symbols-outlined text-[20px] text-sky-500">
                          exercise
                        </span>
                        <span className="text-sm text-slate-600 truncate">Olahraga</span>
                      </div>
                      <span className="text-sm font-bold tabular-nums text-slate-900">
                        {weekActivityDays} hari
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="material-symbols-outlined text-[20px] text-indigo-500">
                          check_circle
                        </span>
                        <span className="text-sm text-slate-600 truncate">Gabungan</span>
                      </div>
                      <span className="text-sm font-bold tabular-nums text-slate-900">
                        {weekDoneCount} hari · {weekConsistencyPct}%
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-center gap-1.5">
            {Array.from({ length: insightSlideCount }).map((_, i) => (
              <button
                key={`insight-dot-${i}`}
                type="button"
                aria-label={`Slide ${i + 1}`}
                onClick={() => scrollInsightTo(i)}
                className={`h-1.5 rounded-full transition-all ${
                  insightSlideIndex === i ? "w-4 bg-sky-500" : "w-1.5 bg-slate-300"
                }`}
              />
            ))}
          </div>
        </section>

        <section className="px-4 pt-5 pb-2">
          <h3 className="text-sm font-bold mb-3.5">Aksi Cepat</h3>
          <div className="grid grid-cols-4 gap-x-3 gap-y-4">
            {quickActionKeys
              .map((key) => QUICK_ACTION_CATALOG.find((item) => item.key === key))
              .filter(Boolean)
              .map((action) => {
                const content = (
                  <>
                    <div
                      className={`size-12 rounded-xl flex items-center justify-center border border-slate-100 shadow-sm ${action.iconWrap}`}
                    >
                      <span className="material-symbols-outlined text-[22px]">{action.icon}</span>
                    </div>
                    <span className="text-[11px] font-semibold text-on-surface text-center leading-tight">
                      {action.label}
                    </span>
                  </>
                );
                const className =
                  "flex flex-col items-center gap-2 active:scale-[0.98] transition-transform";

                if (action.to) {
                  return (
                    <Link key={action.key} to={action.to} className={className}>
                      {content}
                    </Link>
                  );
                }

                return (
                  <button
                    key={action.key}
                    type="button"
                    onClick={() => {
                      if (action.action === "capture-food") {
                        setCaptureType("food");
                        setIsCaptureOpen(true);
                      } else if (action.action === "capture-activity") {
                        setCaptureType("activity");
                        setIsCaptureOpen(true);
                      }
                    }}
                    className={className}
                  >
                    {content}
                  </button>
                );
              })}

            {/* Custom selalu ada di akhir dan tidak ikut digeser */}
            <button
              type="button"
              onClick={() => {
                setDraftQuickActionKeys([...quickActionKeys]);
                setIsQuickActionsCustomOpen(true);
              }}
              className="flex flex-col items-center gap-2 active:scale-[0.98] transition-transform"
            >
              <div className="size-12 rounded-xl flex items-center justify-center border border-dashed border-primary/40 bg-primary/5 text-primary shadow-sm">
                <span className="material-symbols-outlined text-[22px]">tune</span>
              </div>
              <span className="text-[11px] font-semibold text-on-surface text-center leading-tight">
                Custom
              </span>
            </button>
          </div>
        </section>

        <section className="px-4 pt-16 pb-4">
          <div className="flex justify-between items-center mb-3.5">
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

        <PopularCommunitiesSection title="Popular Communities" className="px-4 pt-8 pb-6" />

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

      {isQuickActionsCustomOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 space-y-4 max-h-[85dvh] flex flex-col">
            <div className="flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Custom Aksi Cepat</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Pilih menu yang ingin ditampilkan. Tombol Custom selalu tetap ada.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickActionsCustomOpen(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto space-y-2 pr-0.5">
              {QUICK_ACTION_CATALOG.map((item) => {
                const checked = draftQuickActionKeys.includes(item.key);
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setDraftQuickActionKeys((prev) =>
                        checked ? prev.filter((key) => key !== item.key) : [...prev, item.key]
                      );
                    }}
                    className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                      checked
                        ? "border-primary/40 bg-primary/5"
                        : "border-slate-100 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div
                      className={`size-11 rounded-xl flex items-center justify-center shrink-0 ${item.iconWrap}`}
                    >
                      <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-on-surface">{item.label}</p>
                      <p className="text-[11px] text-slate-500">
                        {checked ? "Ditampilkan di Aksi Cepat" : "Disembunyikan"}
                      </p>
                    </div>
                    <span
                      className={`material-symbols-outlined text-[22px] ${
                        checked ? "text-primary" : "text-slate-300"
                      }`}
                      style={checked ? { fontVariationSettings: "'FILL' 1" } : undefined}
                    >
                      {checked ? "check_circle" : "radio_button_unchecked"}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2 shrink-0 pt-1">
              <button
                type="button"
                onClick={() => setDraftQuickActionKeys([...DEFAULT_QUICK_ACTION_KEYS])}
                className="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-xl text-sm font-semibold"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = draftQuickActionKeys.filter((key) =>
                    QUICK_ACTION_CATALOG.some((item) => item.key === key)
                  );
                  setQuickActionKeys(next);
                  try {
                    localStorage.setItem(QUICK_ACTIONS_STORAGE_KEY, JSON.stringify(next));
                  } catch {
                    /* ignore quota */
                  }
                  setIsQuickActionsCustomOpen(false);
                }}
                className="flex-[1.4] bg-primary text-white py-2.5 rounded-xl text-sm font-semibold"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
