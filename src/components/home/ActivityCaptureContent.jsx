import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchGeminiFoodAnalysis } from "../../lib/foodAnalysisGemini";
import { getGeminiApiKeyConfigError } from "../../lib/geminiEnv";

const TEMP_ANALYSIS_KEY = "health_food_analysis_temp_v1";

export default function ActivityCaptureContent() {
  const navigate = useNavigate();
  const [capturedImage, setCapturedImage] = useState("");
  const [captureType, setCaptureType] = useState("food");
  const [cameraFacing, setCameraFacing] = useState("environment"); // environment | user
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

  useEffect(() => {
    const openCamera = async () => {
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
      }
    };
  }, [cameraFacing]);

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
    setAnalysisError("");
  };

  const handleUploadImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCapturedImage(reader.result);
        setAnalysisError("");
      }
    };
    reader.readAsDataURL(file);
  };

  const parseDataUrl = (dataUrl) => {
    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) return null;
    return { mimeType: match[1], base64Data: match[2] };
  };

  const handleAnalyzeAI = async () => {
    if (!capturedImage) return;
    const keyErr = getGeminiApiKeyConfigError(GEMINI_API_KEY);
    if (keyErr) {
      setAnalysisError(keyErr);
      return;
    }

    const parsedImage = parseDataUrl(capturedImage);
    if (!parsedImage) {
      setAnalysisError("Format gambar tidak valid.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError("");
    try {
      const result = await fetchGeminiFoodAnalysis(GEMINI_API_KEY, parsedImage);

      localStorage.setItem(
        TEMP_ANALYSIS_KEY,
        JSON.stringify({
          type: "food",
          image: capturedImage,
          ...result,
          createdAt: Date.now(),
        })
      );
      navigate("/food-analysis/result");
    } catch (error) {
      console.error("AI analyze failed:", error);
      const status = Number(error?.status);
      if (status === 429) {
        setAnalysisError("Kuota Gemini sedang penuh (429). Tunggu sebentar lalu coba lagi, atau cek quota/billing API key.");
      } else {
        setAnalysisError("Gagal analisis AI. Coba lagi.");
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="bg-surface text-on-surface antialiased max-w-[375px] mx-auto min-h-screen relative pb-32">
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-6 py-4 bg-emerald-50/80 backdrop-blur-xl no-border shadow-none max-w-[375px] mx-auto">
        <Link to="/home" className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-emerald-100/50 transition-colors active:scale-95 duration-150">
          <span className="material-symbols-outlined text-emerald-700">arrow_back</span>
        </Link>
        <span className="text-2xl font-black tracking-tighter text-emerald-800">Take Foto</span>
        <button className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-emerald-100/50 transition-colors active:scale-95 duration-150">
          <span className="material-symbols-outlined text-emerald-700">notifications</span>
        </button>
      </header>

      <main className="pt-20">
        <div className="relative w-full h-[320px] overflow-hidden bg-black">
          {capturedImage ? (
            <img src={capturedImage} alt="Hasil foto" className="w-full h-full object-cover" />
          ) : (
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>

        <section className="px-6 -mt-8 relative z-10 bg-surface rounded-t-[32px] pt-8">
          <div className="flex justify-between items-start mb-4">
            <h1 className="text-2xl font-extrabold text-on-surface tracking-tight leading-tight max-w-[70%]">Ambil Foto Makanan / Aktivitas</h1>
            <p className="text-sm font-bold text-primary">Live</p>
          </div>
          <p className="text-on-surface-variant body-md leading-relaxed mb-6">
            Gunakan kamera untuk mengambil foto atau upload dari galeri, lalu lanjutkan ke proses analisis AI.
          </p>

          <div className="space-y-3 pb-12">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setCaptureType("food")}
                className={`p-4 rounded-2xl text-left border transition-colors ${
                  captureType === "food" ? "bg-primary/10 border-primary text-primary" : "bg-surface-container-lowest border-outline-variant/20 text-on-surface"
                }`}
              >
                <p className="font-bold">Makanan</p>
                <p className="text-xs opacity-80">Catat nutrisi harian</p>
              </button>
              <button
                onClick={() => setCaptureType("activity")}
                className={`p-4 rounded-2xl text-left border transition-colors ${
                  captureType === "activity" ? "bg-primary/10 border-primary text-primary" : "bg-surface-container-lowest border-outline-variant/20 text-on-surface"
                }`}
              >
                <p className="font-bold">Olahraga</p>
                <p className="text-xs opacity-80">Catat aktivitas fisik</p>
              </button>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-12 rounded-2xl bg-surface-container-low text-on-surface font-semibold flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">upload</span>
              Upload dari Galeri
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUploadImage} className="hidden" />
            <button
              onClick={() => setCameraFacing((prev) => (prev === "environment" ? "user" : "environment"))}
              className="w-full h-12 rounded-2xl bg-surface-container-low text-on-surface font-semibold flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">flip_camera_android</span>
              Switch Kamera ({cameraFacing === "environment" ? "Belakang" : "Depan"})
            </button>
          </div>
        </section>

        <section className="px-4 py-4 mb-24">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold">Aktivitas Terakhir</h3>
            <Link to="/history" className="text-xs font-semibold text-primary">
              Lihat Semua
            </Link>
          </div>
          <div className="space-y-3">
            <Link
              to="/activity/run"
              className="w-full text-left flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm active:scale-[0.99] transition-transform"
            >
              <div className="size-12 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                <span className="material-symbols-outlined">directions_run</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold">Lari Pagi</p>
                <p className="text-xs text-slate-500">Kemarin • 10.2 km</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-primary">540 kkal</p>
              </div>
            </Link>
            <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
              <div className="size-12 rounded-lg bg-green-100 flex items-center justify-center text-green-600">
                <span className="material-symbols-outlined">self_improvement</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold">Yoga Meditasi</p>
                <p className="text-xs text-slate-500">Selasa • 30 menit</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-primary">120 kkal</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
              <div className="size-12 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
                <span className="material-symbols-outlined">restaurant</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold">Sarapan Oatmeal &amp; Buah</p>
                <p className="text-xs text-slate-500">Hari ini • 07:30</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-primary">320 kkal</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="fixed bottom-0 left-0 w-full z-50 bg-white/80 backdrop-blur-xl px-6 pb-8 pt-4 border-t border-zinc-100/10 max-w-[375px] mx-auto">
        <div className="flex items-center justify-between gap-4">
          <button onClick={handleCapture} className="flex-1 h-14 rounded-full bg-gradient-to-br from-primary-container to-primary text-white font-bold text-lg flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(0,106,63,0.3)] active:scale-95 duration-150">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              photo_camera
            </span>
            Ambil Foto
          </button>
        </div>
        {capturedImage && (
          <div className="mt-3 space-y-2">
            {isAnalyzing && (
              <div className="w-full rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex flex-col items-center gap-3">
                <div className="size-9 rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin" />
                <p className="text-sm font-semibold text-emerald-700">AI sedang menganalisis makanan...</p>
              </div>
            )}
            <button
              onClick={handleAnalyzeAI}
              disabled={isAnalyzing}
              className="w-full h-12 rounded-xl bg-primary text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <span className="material-symbols-outlined">analytics</span>
              {isAnalyzing ? "Menganalisis..." : "Analisis AI (Makanan)"}
            </button>
            {analysisError && <p className="text-xs text-red-500">{analysisError}</p>}
          </div>
        )}
      </footer>
    </div>
  );
}
