import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { getSession, loginWithPassword } from "../../auth/auth";

export default function LoginContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/home";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getSession()) {
      navigate(from, { replace: true });
    }
  }, [navigate, from]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const u = username.trim();
    if (!u || !password) {
      setError("Isi SID dan password (SID).");
      return;
    }
    setLoading(true);
    const { user, error: loginError } = await loginWithPassword(u, password);
    setLoading(false);
    if (!user) {
      setError(loginError || "Login gagal.");
      return;
    }
    navigate("/splash", { replace: true, state: { next: from } });
  };

  return (
    <div className="bg-surface font-body text-on-surface antialiased overflow-x-hidden min-h-[max(884px,100dvh)]">
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-6 py-4  backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <Link
            to="/welcome"
            className="p-2 rounded-full hover:bg-emerald-100/50 transition-colors active:scale-95 duration-150 text-emerald-700 dark:text-emerald-400"
          >
            <span className="material-symbols-outlined" data-icon="arrow_back">
              arrow_back
            </span>
          </Link>
        </div>
        <div className="absolute left-1/2 -translate-x-1/2">
          <span className="text-2xl font-black tracking-tighter text-emerald-800 dark:text-emerald-400 font-headline">Well</span>
        </div>
        <div className="w-10" aria-hidden />
      </header>
      <main className="min-h-screen flex flex-col pt-24 pb-12 px-6 lg:px-0">
        <div className="absolute top-0 right-0 -z-10 w-2/3 h-2/3 bg-primary-fixed/20 rounded-bl-[120px] lg:rounded-bl-[240px]" />
        <div className="max-w-md w-full mx-auto flex flex-col gap-8 flex-grow justify-center">
          <div className="space-y-2 text-center lg:text-left">
            <h1 className="font-headline font-extrabold text-4xl lg:text-5xl text-on-surface tracking-tight leading-tight">
              Welcome <span className="text-primary"></span>
            </h1>
            <p className="text-on-surface-variant font-medium text-lg leading-relaxed max-w-sm">
              Login dengan SID Anda; isi password dengan SID yang sama.
            </p>
           
          </div>
          <div className="bg-surface-container-lowest p-8 lg:p-10 rounded-[32px] shadow-[0_8px_24px_rgba(23,29,25,0.06)] space-y-6">
            <form className="space-y-5" onSubmit={handleSubmit}>
              {error ? (
                <div className="rounded-xl bg-error-container/30 text-error px-4 py-3 text-sm font-medium border border-error/20">
                  {error}
                </div>
              ) : null}
              <div className="space-y-2">
                <label className="font-label font-semibold text-sm text-on-surface-variant px-1" htmlFor="login-username">
                  SID
                </label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">
                    person
                  </span>
                  <input
                    id="login-username"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-surface-container-highest border-none rounded-xl focus:ring-1 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all text-on-surface placeholder:text-outline"
                    placeholder="contoh: C5BXK"
                    type="text"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <label className="font-label font-semibold text-sm text-on-surface-variant" htmlFor="login-password">
                    Password
                  </label>
                </div>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">
                    lock
                  </span>
                  <input
                    id="login-password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-surface-container-highest border-none rounded-xl focus:ring-1 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all text-on-surface placeholder:text-outline"
                    placeholder="••••••••"
                    type="password"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 mt-4 emerald-gradient text-on-primary font-headline font-bold text-lg rounded-full shadow-lg active:scale-[0.98] transition-all hover:brightness-110 disabled:opacity-60"
              >
                {loading ? "Memproses…" : "Login"}
              </button>
            </form>
          </div>
          
        </div>
      </main>
    </div>
  );
}
