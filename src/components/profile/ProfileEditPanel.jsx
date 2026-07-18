/**
 * @param {{
 *   profile: { name: string, phone: string, email: string },
 *   onChange: (next: { name: string, phone: string, email: string }) => void,
 *   onSave: () => void | Promise<void>,
 *   onBack: () => void,
 *   saving?: boolean,
 * }} props
 */
export default function ProfileEditPanel({
  profile,
  onChange,
  onSave,
  onBack,
  saving = false,
}) {
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
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Edit profil</h2>
          <p className="mt-0.5 text-[12px] text-slate-500">Perbarui data akun Anda</p>
        </div>

        <label className="block space-y-1.5">
          <span className="text-[11px] font-semibold text-slate-500">Nama lengkap</span>
          <input
            value={profile.name}
            onChange={(e) => onChange({ ...profile, name: e.target.value })}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            placeholder="Nama lengkap"
            autoComplete="name"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-[11px] font-semibold text-slate-500">Nomor telepon</span>
          <input
            value={profile.phone}
            onChange={(e) => onChange({ ...profile, phone: e.target.value })}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            placeholder="08…"
            autoComplete="tel"
            inputMode="tel"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-[11px] font-semibold text-slate-500">Email</span>
          <input
            value={profile.email}
            onChange={(e) => onChange({ ...profile, email: e.target.value })}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            placeholder="nama@email.com"
            autoComplete="email"
            type="email"
          />
        </label>

        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="h-12 w-full rounded-full bg-primary text-sm font-bold text-white disabled:opacity-60"
        >
          {saving ? "Menyimpan…" : "Simpan profil"}
        </button>
      </div>
    </section>
  );
}
