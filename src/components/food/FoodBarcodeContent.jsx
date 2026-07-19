import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BrowserMultiFormatReader } from "@zxing/browser";
import {
  getStoredMealType,
  logFoodItem,
  lookupFoodBarcode,
  setStoredMealType,
} from "../../lib/foodLogApi";
import { showError, showSuccess, showWarning, showToast } from "../../lib/appAlert";
import { hasHealthAlerts, healthAlertSeverity } from "../../lib/healthAlertApi";

const ACCENT = "#2563eb";

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

export default function FoodBarcodeContent() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const zxingControlsRef = useRef(null);
  const detectingRef = useRef(false);
  const [code, setCode] = useState("");
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const meal = getStoredMealType();

  const stopCamera = () => {
    try {
      zxingControlsRef.current?.stop?.();
    } catch {
      /* ignore */
    }
    zxingControlsRef.current = null;
    streamRef.current?.getTracks?.().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  };

  useEffect(() => {
    return () => {
      detectingRef.current = false;
      try {
        zxingControlsRef.current?.stop?.();
      } catch {
        /* ignore */
      }
      streamRef.current?.getTracks?.().forEach((t) => t.stop());
    };
  }, []);

  const onBarcodeFound = async (rawValue) => {
    const raw = digitsOnly(rawValue);
    if (!raw || detectingRef.current) return;
    detectingRef.current = true;
    stopCamera();
    setCode(raw);
    await lookup(raw);
  };

  const startWithNativeDetector = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
    });
    streamRef.current = stream;
    const video = videoRef.current;
    if (!video) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error("Video belum siap");
    }
    video.srcObject = stream;
    await video.play();
    setScanning(true);

    const detector = new window.BarcodeDetector({
      formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"],
    });

    const tick = async () => {
      if (!videoRef.current || !streamRef.current || detectingRef.current) return;
      try {
        const codes = await detector.detect(videoRef.current);
        if (codes?.[0]?.rawValue) {
          await onBarcodeFound(codes[0].rawValue);
          return;
        }
      } catch {
        /* keep scanning */
      }
      if (streamRef.current) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const startWithZxing = async () => {
    setScanning(true);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const video = videoRef.current;
    if (!video) throw new Error("Video belum siap");

    const reader = new BrowserMultiFormatReader();
    const controls = await reader.decodeFromVideoDevice(undefined, video, (result) => {
      if (result?.getText?.()) {
        onBarcodeFound(result.getText());
      }
    });
    zxingControlsRef.current = controls;
  };

  const startCamera = async () => {
    setError("");
    detectingRef.current = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Kamera tidak tersedia di perangkat ini. Ketik barcode manual di bawah.");
      return;
    }
    try {
      if ("BarcodeDetector" in window) {
        try {
          await startWithNativeDetector();
          return;
        } catch {
          /* fall through to ZXing */
        }
      }
      await startWithZxing();
    } catch {
      stopCamera();
      setError("Tidak bisa membuka kamera. Izinkan akses kamera atau ketik barcode manual.");
    }
  };

  const lookup = async (rawCode) => {
    const c = digitsOnly(rawCode || code);
    if (!c) {
      setError("Masukkan barcode.");
      return;
    }
    setLoading(true);
    setError("");
    setProduct(null);
    try {
      const { product: p } = await lookupFoodBarcode(c);
      setProduct(p);
      setCode(c);
    } catch (e) {
      setError(e?.message || "Produk tidak ditemukan.");
    } finally {
      setLoading(false);
      detectingRef.current = false;
    }
  };

  const onConfirm = async () => {
    if (!product) return;
    setSaving(true);
    setError("");
    try {
      setStoredMealType(meal);
      const res = await logFoodItem({
        food_name: product.food_name,
        calories: Number(product.calories) || 0,
        protein_g: product.protein_g,
        fats_g: product.fats_g,
        carbs_g: product.carbs_g,
        serving_label: product.serving_label,
        meal_type: meal,
        source_type: "barcode",
        barcode: product.barcode || code,
        image_url: product.image_url || null,
      });
      const alert = res?.healthAlert;
      if (hasHealthAlerts(alert)) {
        const sev = healthAlertSeverity(alert);
        if (sev === "high" || sev === "warning") {
          await showWarning(
            alert.primary?.title || "Peringatan MCU",
            alert.primary?.message || ""
          );
        } else {
          showToast(alert.primary?.title || "Saran MCU", "info");
        }
      }
      showSuccess("Makanan tersimpan", `${product.food_name} berhasil dicatat.`);
      navigate("/food", { replace: true });
    } catch (e) {
      setError(e?.message || "Gagal menyimpan.");
      showError("Gagal menyimpan", e?.message || "");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col overflow-hidden bg-[#f3f4f6] font-['Public_Sans',sans-serif]">
      <header className="flex shrink-0 items-center gap-2 bg-white px-3 pb-3 pt-[max(0.65rem,env(safe-area-inset-top))] shadow-sm">
        <Link
          to="/food"
          onClick={stopCamera}
          className="flex size-10 items-center justify-center rounded-full text-slate-700"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <h1 className="text-lg font-bold text-slate-900">Barcode scan</h1>
      </header>

      <main className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        <div className="relative overflow-hidden rounded-2xl bg-black">
          <video
            ref={videoRef}
            className={`h-48 w-full object-cover ${scanning ? "block" : "hidden"}`}
            muted
            playsInline
          />
          {!scanning ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-white/80">
              <span className="material-symbols-outlined text-4xl">barcode_reader</span>
              <p className="text-[12px]">Arahkan ke barcode produk</p>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => (scanning ? stopCamera() : startCamera())}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-800"
        >
          {scanning ? "Stop kamera" : "Buka kamera scan"}
        </button>

        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(digitsOnly(e.target.value).slice(0, 14))}
            placeholder="Atau ketik barcode…"
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => lookup()}
            className="rounded-xl px-4 text-sm font-bold text-white disabled:opacity-60"
            style={{ backgroundColor: ACCENT }}
          >
            Cari
          </button>
        </div>

        {error ? <p className="text-xs text-red-500">{error}</p> : null}
        {loading ? <p className="text-center text-sm text-slate-500">Mencari produk…</p> : null}

        {product ? (
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt=""
                className="mb-3 h-28 w-full rounded-xl bg-slate-50 object-contain"
              />
            ) : null}
            <p className="text-[15px] font-bold text-slate-900">{product.food_name}</p>
            <p className="mt-1 text-[12px] text-slate-500">
              {Math.round(product.calories)} cal
              {product.serving_label ? `, ${product.serving_label}` : ""}
              {product.brand ? ` · ${product.brand}` : ""}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">{product.source_label}</p>
            <button
              type="button"
              disabled={saving}
              onClick={onConfirm}
              className="mt-4 w-full rounded-xl py-3 text-sm font-bold text-white disabled:opacity-60"
              style={{ backgroundColor: ACCENT }}
            >
              {saving ? "Menyimpan…" : `Tambah ke ${meal}`}
            </button>
          </div>
        ) : null}
      </main>
    </div>
  );
}
