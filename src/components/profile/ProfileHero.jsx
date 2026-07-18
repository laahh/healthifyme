const FALLBACK_AVATAR =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuB7uwxn84_hs7oaiFQKLbY8Y-f6y693VmByLqOGrcuA-6v64TcopIAZDvqqRbuzbrkuxM-pg1MkjTwcvsrU3tvYgiBkKItP0qtNqqx-sailK7sQv4jDejfx1_ni-xcQ-frac1FsVCI7bOn9-1fejw0U6l9C01hDLQZ6psZ2La1RnaOfkp8bI9vr2jEd_l3nE7QULFkpC3rdsEBOsNTajMnpxUadnp1jj199t_1nXryacDVai90wtEXEjWZ84YSz4vgyLw0E3pTlJD3H";

/**
 * @param {{
 *   displayName: string,
 *   photoUrl?: string | null,
 *   tier?: string,
 *   onEdit: () => void,
 * }} props
 */
export default function ProfileHero({ displayName, photoUrl, tier = "MEMBER", onEdit }) {
  const src = photoUrl || FALLBACK_AVATAR;

  return (
    <section className="flex flex-col items-center text-center px-2 py-2">
      <div className="relative">
        <div className="size-24 rounded-full p-1 bg-primary/15">
          <img alt="" className="size-full rounded-full object-cover" src={src} />
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="absolute bottom-0 right-0 flex size-8 items-center justify-center rounded-full bg-primary text-white shadow-sm ring-2 ring-white"
          aria-label="Edit profil"
        >
          <span className="material-symbols-outlined text-[16px]">edit</span>
        </button>
      </div>
      <h1 className="mt-3 text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        {displayName}
      </h1>
      {tier ? (
        <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary">
          <span
            className="material-symbols-outlined text-[14px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            stars
          </span>
          {tier}
        </span>
      ) : null}
    </section>
  );
}
