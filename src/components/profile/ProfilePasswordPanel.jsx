import { useState } from "react";

/**
 * @param {{
 *   onBack: () => void,
 *   onSubmit: (payload: {
 *     currentPassword: string,
 *     newPassword: string,
 *     confirmPassword: string,
 *   }) => Promise<void>,
 *   saving?: boolean,
 * }} props
 */
export default function ProfilePasswordPanel({ onBack, onSubmit, saving = false }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [localError, setLocalError] = useState("");

  const handleSubmit = async () => {
    setLocalError("");
    if (!currentPassword || !newPassword || !confirmPassword) {
      setLocalError("Lengkapi semua kolom password.");
      return;
    }
    if (newPassword.length < 6) {
      setLocalError("Password baru minimal 6 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setLocalError("Konfirmasi password tidak cocok.");
      return;
    }
    if (currentPassword === newPassword) {
      setLocalError("Password baru harus berbeda dari password lama.");
      return;
    }
    await onSubmit({ currentPassword, newPassword, confirmPassword });
  };

  return (
    <section className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-sm font-semibold text-primary"
      >
        <span className="material-symbols-outlined text-base">arrow_back</span>
        Kembali
      </button>

      <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Ganti password</h2>
          <p className="mt-0.5 text-[12px] text-slate-500">
            Masukkan password lama, lalu buat password baru (minimal 6 karakter).
          </p>
        </div>

        <label className="block space-y-1.5">
          <span className="text-[11px] font-semibold text-slate-500">Password lama</span>
          <div className="relative">
            <input
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              type={showCurrent ? "text" : "password"}
              autoComplete="current-password"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-sm text-slate-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              placeholder="Password saat ini"
            />
            <button
              type="button"
              onClick={() => setShowCurrent((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              aria-label={showCurrent ? "Sembunyikan" : "Tampilkan"}
            >
              <span className="material-symbols-outlined text-[20px]">
                {showCurrent ? "visibility_off" : "visibility"}
              </span>
            </button>
          </div>
        </label>

        <label className="block space-y-1.5">
          <span className="text-[11px] font-semibold text-slate-500">Password baru</span>
          <div className="relative">
            <input
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              type={showNew ? "text" : "password"}
              autoComplete="new-password"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-sm text-slate-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              placeholder="Minimal 6 karakter"
            />
            <button
              type="button"
              onClick={() => setShowNew((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              aria-label={showNew ? "Sembunyikan" : "Tampilkan"}
            >
              <span className="material-symbols-outlined text-[20px]">
                {showNew ? "visibility_off" : "visibility"}
              </span>
            </button>
          </div>
        </label>

        <label className="block space-y-1.5">
          <span className="text-[11px] font-semibold text-slate-500">Ulangi password baru</span>
          <input
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            type="password"
            autoComplete="new-password"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            placeholder="Ulangi password baru"
          />
        </label>

        {localError ? (
          <p className="text-[12px] font-medium text-red-600">{localError}</p>
        ) : null}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="h-12 w-full rounded-full bg-primary text-sm font-bold text-white disabled:opacity-60"
        >
          {saving ? "Menyimpan…" : "Simpan password"}
        </button>
      </div>
    </section>
  );
}
