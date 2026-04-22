import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ActivityRunDetailContent from "../components/home/ActivityRunDetailContent";
import ActivityCaptureContent from "../components/home/ActivityCaptureContent";
import FoodAnalysisResultContent from "../components/home/FoodAnalysisResultContent";
import WorkoutAnalysisResultContent from "../components/home/WorkoutAnalysisResultContent";
import HistoryItemDetailContent from "../components/home/HistoryItemDetailContent";
import NutritionInsightContent from "../components/home/NutritionInsightContent";
import WorkoutInsightContent from "../components/home/WorkoutInsightContent";
import HomeContent from "../components/home/HomeContent";
import HistoryContent from "../components/home/HistoryContent";
import LoginContent from "../components/auth/LoginContent";
import ProfileContent from "../components/profile/ProfileContent";

export function SplashPage() {
  const navigate = useNavigate();
  const location = useLocation();
  /** Setelah login: `state.next` (mis. /home). Tanpa state: onboarding ke /get-started. */
  const nextPath = location.state?.next ?? "/get-started";
  const [progress, setProgress] = useState(0);

  const durationMs = 4000;

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate(nextPath, { replace: true });
    }, durationMs);

    return () => clearTimeout(timer);
  }, [navigate, nextPath]);

  useEffect(() => {
    const tickMs = 40;
    const step = 100 / (durationMs / tickMs);

    const interval = setInterval(() => {
      setProgress((prev) => Math.min(100, prev + step));
    }, tickMs);

    return () => clearInterval(interval);
  }, [durationMs]);

  return (
    <div className="flex h-dvh min-h-dvh w-full flex-col overflow-hidden bg-[#2D9B64] text-on-primary">
      <main className="relative mx-auto flex h-full min-h-0 w-full max-w-md flex-1 flex-col items-center justify-between overflow-hidden px-8 py-10 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary-container/20 rounded-[4rem] rotate-45 pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-primary-container/30 rounded-full blur-3xl pointer-events-none" />
        <div className="flex-1" />
        <div className="flex flex-col items-center space-y-6 text-center z-10">
          
          <div className="space-y-1">
            <img src="/images/-new.jpeg" alt="W.E.L.L Program" className="w-56 max-w-full object-contain" />
          </div>
        </div>
        <div className="flex-1 flex flex-col justify-end w-full max-w-[200px] pb-12 z-10">
          <div className="space-y-4">
            <div className="h-[3px] w-full bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-[width] duration-75 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-center text-[11px] font-medium text-white/50 font-body tracking-wide">
              loading... {Math.round(progress)}%
            </p>
          </div>
        </div>
        <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] text-[10px] text-white/30 font-body uppercase tracking-widest">
          v 2.4.0
        </div>
      </main>
    </div>
  );
}

export function GetStartedPage() {
  const navigate = useNavigate();

  return (
    <div className="relative flex h-dvh min-h-dvh w-full flex-col items-center justify-center overflow-y-auto overflow-x-hidden bg-surface px-6 py-8 text-on-surface font-body selection:bg-primary-fixed selection:text-on-primary-fixed pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-primary-fixed/20 rounded-full blur-3xl" />
      <div className="absolute bottom-[-5%] left-[-5%] w-80 h-80 bg-surface-container-high rounded-full blur-3xl" />
      <div className="w-full max-w-md flex flex-col items-center text-center z-10">
        <div className="relative w-full aspect-square mb-12 flex items-center justify-center">
          <div className="absolute inset-0 bg-surface-container-low rounded-[40px] rotate-3 scale-95 opacity-50" />
          <div className="absolute inset-0 bg-surface-container-high rounded-[48px] -rotate-2" />
          <div className="relative w-[85%] h-[85%] overflow-hidden rounded-[32px] shadow-2xl shadow-on-surface/5">
            <img className="w-full h-full object-cover" src="/images/getstarted.png" alt="Get Started" />
          </div>
          <div className="absolute -bottom-6 -right-4 w-24 h-24 bg-white/40 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-lg transform rotate-12">
            <span className="material-symbols-outlined text-primary text-4xl">restaurant</span>
          </div>
        </div>
        <div className="space-y-4 mb-10">
          <h1 className="font-headline font-extrabold text-4xl md:text-5xl text-on-surface tracking-tight leading-tight">
          Mulai Hidup Lebih Sehat <span className="text-primary italic">Hari Ini</span>
          </h1>
          <p className="font-body text-on-surface-variant text-lg max-w-[320px] mx-auto leading-relaxed">
             Dukung wellbeing-mu dengan memantau nutrisi dan aktivitas harian.
          </p>
        </div>
        <div className="w-full flex flex-col gap-4">
          <button onClick={() => navigate("/welcome")} className="text-on-primary font-headline font-bold py-5 px-8 rounded-full shadow-lg shadow-primary/20 text-lg bg-gradient-to-br from-[#2D9B64] to-[#006a3f]">
            Get Started
          </button>
          
        </div>
        <div className="mt-12 flex items-center gap-2">
          <div className="h-1.5 w-8 rounded-full bg-primary" />
          <div className="h-1.5 w-1.5 rounded-full bg-surface-container-highest" />
          <div className="h-1.5 w-1.5 rounded-full bg-surface-container-highest" />
        </div>
      </div>
    </div>
  );
}

export function WelcomePage() {
  const navigate = useNavigate();

  return (
    <div className="flex h-dvh min-h-dvh w-full flex-col overflow-hidden text-on-background selection:bg-primary-fixed selection:text-on-primary-fixed">
      <header className="sticky top-0 z-50 flex w-full shrink-0 items-center justify-between px-6 py-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="text-2xl font-black tracking-tighter text-primary">well</div>
        <button type="button" className="text-sm font-semibold text-on-surface-variant transition-colors hover:text-primary">
          Skip
        </button>
      </header>
      <main className="relative mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col overflow-y-auto overflow-x-hidden px-8 pb-[max(2rem,env(safe-area-inset-bottom))] pt-2">
        <div className="absolute -top-10 -right-10 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10" />
        <div className="absolute top-1/2 -left-20 w-80 h-80 bg-tertiary/5 rounded-full blur-3xl -z-10" />
        <div className="relative w-full aspect-square mb-12 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-primary/10 scale-110" />
          <div className="absolute inset-0 rounded-full border border-primary/5 scale-125" />
          <div className="w-full h-full rounded-full overflow-hidden bg-surface-container-low shadow-2xl ring-8 ring-surface-container-lowest">
            <img className="w-full h-full object-contain object-center" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDRk0lt_7kjJAcR1HkSEKKWaRv2uw-n-fja0a4zpBVCt2r4mTixid9w6ddHZLdJ-q_vn4WD0ZTh6qYfvcccd-U85xk1qFf0rAv8Ekocr9LX0pCNtdi9ircIw_DQzDZ0Fqz0EUFiJTABOosNZUcUJ-p1j1d8X0YgLekgYV4SydagsRqWk9rQkULLfU1NoE3lKASKI-Famds6spJUoe6DZcwHmYtKAs-m_1F2PTt4ZVNCas5VdklhPsgU_S0M4DRrv2r-kg0hoailnyOM" alt="Makanan sehat" />
          </div>
          <div className="absolute -bottom-2 -right-2 bg-surface-container-lowest p-4 rounded-3xl shadow-lg flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-tertiary/10 flex items-center justify-center text-tertiary">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                favorite
              </span>
            </div>
            <div>
              <div className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Upload</div>
              <div className="text-sm font-bold text-on-surface">Makananmu</div>
            </div>
          </div>
        </div>
        <div className="flex flex-1 flex-col justify-center text-center">
          <h1 className="text-4xl font-extrabold text-on-surface tracking-tight leading-tight mb-4 font-headline">
          Jadikan <span className="text-primary italic">Makananmu <br></br> </span>Lebih Sehat 
          </h1>
          <p className="text-on-surface-variant leading-relaxed mb-10 px-4">
          Pilihlah makanan yang kamu suka,
          dengan pilihan yang lebih tepat untuk tubuhmu.
          </p>
        </div>
        <div className="space-y-6">
          <button onClick={() => navigate("/login")} className="w-full py-5 rounded-full text-white font-bold text-lg shadow-lg shadow-primary/20 transition-transform flex items-center justify-center gap-2 group bg-gradient-to-br from-[#2D9B64] to-[#006a3f]">
            Continue
            <span className="material-symbols-outlined transition-transform group-hover:translate-x-1">arrow_forward</span>
          </button>
          <div className="text-center">
            <p className="text-on-surface-variant text-sm">
              Already have an account?
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="text-primary font-bold hover:underline decoration-2 underline-offset-4 ml-1 bg-transparent border-none p-0 cursor-pointer font-inherit"
              >
                Sign In
              </button>
            </p>
          </div>
        </div>
        <div className="mt-12 flex justify-center gap-1.5 opacity-30">
          <div className="w-8 h-1.5 rounded-full bg-primary" />
          <div className="w-1.5 h-1.5 rounded-full bg-outline-variant" />
          <div className="w-1.5 h-1.5 rounded-full bg-outline-variant" />
        </div>
      </main>
    </div>
  );
}

export function LoginPage() {
  return <LoginContent />;
}

export function HomePage() {
  return <HomeContent />;
}

export function ActivityRunPage() {
  return <ActivityRunDetailContent />;
}

export function ActivityCapturePage() {
  return <ActivityCaptureContent />;
}

export function FoodAnalysisResultPage() {
  return <FoodAnalysisResultContent />;
}

export function WorkoutAnalysisResultPage() {
  return <WorkoutAnalysisResultContent />;
}

export function NutritionInsightPage() {
  return <NutritionInsightContent />;
}

export function WorkoutInsightPage() {
  return <WorkoutInsightContent />;
}

export function HistoryPage() {
  return <HistoryContent />;
}

export function HistoryItemDetailPage() {
  return <HistoryItemDetailContent />;
}

export function HealthPage() {
  return (
    <div className="flex h-dvh min-h-dvh w-full flex-col overflow-hidden bg-surface text-on-surface">
      <header className="fixed left-0 right-0 top-0 z-50 flex w-full justify-between px-6 pb-4 pt-[max(0.75rem,env(safe-area-inset-top))] bg-emerald-50/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-md items-center gap-4">
          <button type="button" className="rounded-full p-2 text-emerald-700 transition-colors hover:bg-emerald-100/50">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="text-2xl font-black tracking-tighter text-emerald-800">well</h1>
        </div>
      </header>
      <main className="mx-auto min-h-0 w-full max-w-md flex-1 overflow-y-auto px-6 pb-[max(7rem,env(safe-area-inset-bottom))] pt-[calc(5.5rem+env(safe-area-inset-top))] space-y-8">
        <h2 className="text-3xl font-extrabold tracking-tight text-on-surface">Health Vitality</h2>
        <section className="grid grid-cols-2 gap-4">
          <div className="col-span-2 p-6 rounded-[2rem] bg-gradient-to-br from-primary-container to-primary text-on-primary h-48">
            <h3 className="text-4xl font-black">1,840</h3>
            <p className="text-on-primary/80 font-medium tracking-wide">Calories Remaining</p>
          </div>
          <div className="p-5 rounded-3xl bg-surface-container-low">
            <p className="text-xs font-bold uppercase tracking-tighter">Protein</p>
            <p className="text-2xl font-bold text-on-surface">124g</p>
          </div>
          <div className="p-5 rounded-3xl bg-surface-container-low">
            <p className="text-xs font-bold uppercase tracking-tighter">Carbs</p>
            <p className="text-2xl font-bold text-on-surface">210g</p>
          </div>
        </section>
        <section className="p-6 rounded-[2rem] bg-white shadow-[0_8px_24px_rgba(23,29,25,0.04)] flex items-center justify-between gap-6">
          <div className="flex-1">
            <h3 className="text-xl font-bold mb-1">Water Intake</h3>
            <p className="text-on-surface-variant text-sm mb-4">6 of 10 glasses today</p>
            <div className="flex gap-1.5 flex-wrap">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-on-primary">
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                    water_drop
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="w-24 h-24 rounded-full border-[6px] border-primary-container/10 flex items-center justify-center">
            <span className="text-xl font-black text-primary">1.5</span>
          </div>
        </section>
        <section className="space-y-4">
          <h3 className="text-xl font-bold">Recommended Meals</h3>
          <div className="relative rounded-[2rem] bg-white overflow-hidden shadow-sm group">
            <div className="h-48 overflow-hidden">
              <img
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAETa93WJHDg_CcXOn3J7cGLklZ0dF8ApxnQwE1at6ube_khJOm7Upigr056YhfO-EQ4kDRw_gXTq1o6clF_o3_apocKk9GrYYVseC_D2xl6qI2vNndhv1q85VNt-6alFL9Qr7f3POkRv4G7fhBkmli9oiHL11j_3kLANzscsuhVO4DnYLOrWRWoY9CVp4wKwyFdq2MANrkp6e5E3ufID0_ozay1PAmo101Hn7-gVfLaubqD6tEYgFmIcR9OWh7Ex-YtZj1VRhspOhb"
                alt="Recommended meal"
              />
              <div className="absolute top-4 left-4 px-3 py-1 bg-tertiary text-on-tertiary text-[10px] font-bold uppercase tracking-widest rounded-full">
                High Protein
              </div>
            </div>
            <div className="p-6">
              <div className="flex justify-between items-start mb-2">
                <h4 className="text-lg font-bold">Wild Salmon &amp; Quinoa Bowl</h4>
                <span className="text-primary font-bold">$18.50</span>
              </div>
            </div>
          </div>
        </section>
      </main>
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex w-full max-w-md mx-auto justify-around rounded-t-3xl border-t border-zinc-100/80 bg-white/80 px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] backdrop-blur-xl dark:bg-zinc-900/80 shadow-[0_-8px_24px_rgba(23,29,25,0.06)]">
        <a className="flex flex-col items-center justify-center bg-emerald-100/60 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 rounded-2xl px-5 py-2.5" href="#">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            home_max
          </span>
          <span className="font-['Inter'] font-medium text-[11px] tracking-wide mt-1">Home</span>
        </a>
        <a className="flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500 px-5 py-2.5" href="#">
          <span className="material-symbols-outlined">restaurant_menu</span>
          <span className="font-['Inter'] font-medium text-[11px] tracking-wide mt-1">Menu</span>
        </a>
        <a className="flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500 px-5 py-2.5" href="#">
          <span className="material-symbols-outlined">shopping_bag</span>
          <span className="font-['Inter'] font-medium text-[11px] tracking-wide mt-1">Cart</span>
        </a>
        <a className="flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500 px-5 py-2.5" href="#">
          <span className="material-symbols-outlined">person</span>
          <span className="font-['Inter'] font-medium text-[11px] tracking-wide mt-1">Profile</span>
        </a>
      </nav>
    </div>
  );
}

export function MenuPage() {
  return (
    <div className="flex h-dvh min-h-dvh w-full flex-col overflow-hidden bg-surface text-on-surface font-body selection:bg-primary-fixed selection:text-on-primary-fixed">
      <header className="fixed left-0 right-0 top-0 z-50 flex w-full items-center px-6 py-4 pt-[max(0.75rem,env(safe-area-inset-top))] bg-emerald-50/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-md items-center gap-4">
          <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full text-emerald-700">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="font-headline text-lg font-bold text-emerald-800">Menu</h1>
        </div>
      </header>
      <main className="mx-auto min-h-0 w-full max-w-md flex-1 overflow-y-auto space-y-6 px-4 pb-[max(7rem,env(safe-area-inset-bottom))] pt-[calc(5rem+env(safe-area-inset-top))]">
        <section className="bg-primary rounded-[2rem] p-6 text-on-primary shadow-lg shadow-emerald-900/10">
          <p className="text-sm font-medium opacity-80 mb-1">Indeks energi</p>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold">84</span>
            <span className="text-xl opacity-70">/100</span>
          </div>
        </section>
        <section className="space-y-3">
          <div className="bg-white p-4 rounded-2xl border border-emerald-50 shadow-sm flex gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">smart_toy</span>
            </div>
            <div className="flex-1">
              <h3 className="text-[13px] font-bold text-on-surface leading-tight">Sate ayam/unggas dengan bumbu kecap manis</h3>
              <p className="text-[11px] text-on-surface-variant mt-1 italic">AI • Hidangan ini tampaknya merupakan kombinasi sate</p>
            </div>
            <span className="text-[11px] font-bold text-on-surface-variant">740 kcal</span>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-emerald-50 shadow-sm flex gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">restaurant</span>
            </div>
            <div className="flex-1">
              <h3 className="text-[13px] font-bold text-on-surface leading-tight">Nasi Campur Ayam Goreng &amp; Sayuran</h3>
              <p className="text-[11px] text-on-surface-variant mt-1 italic">AI • Nasi campur dengan protein tinggi dan serat sayuran</p>
            </div>
            <span className="text-[11px] font-bold text-on-surface-variant">665 kcal</span>
          </div>
        </section>
      </main>
      <button
        type="button"
        className="fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom))] right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg"
      >
        <span className="material-symbols-outlined text-2xl">add</span>
      </button>
      <nav className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex w-full max-w-md justify-around rounded-t-3xl border-t border-zinc-100/10 bg-white/80 px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] backdrop-blur-xl shadow-[0_-8px_24px_rgba(23,29,25,0.06)]">
        <a className="flex flex-col items-center justify-center text-zinc-400 px-5 py-2.5" href="#">
          <span className="material-symbols-outlined mb-1">home_max</span>
          <span className="font-['Inter'] font-medium text-[11px] tracking-wide">Home</span>
        </a>
        <a className="flex flex-col items-center justify-center bg-emerald-100/60 text-emerald-800 rounded-2xl px-5 py-2.5" href="#">
          <span className="material-symbols-outlined mb-1" style={{ fontVariationSettings: "'FILL' 1" }}>
            restaurant_menu
          </span>
          <span className="font-['Inter'] font-medium text-[11px] tracking-wide">Menu</span>
        </a>
        <a className="flex flex-col items-center justify-center text-zinc-400 px-5 py-2.5" href="#">
          <span className="material-symbols-outlined mb-1">shopping_bag</span>
          <span className="font-['Inter'] font-medium text-[11px] tracking-wide">Cart</span>
        </a>
        <a className="flex flex-col items-center justify-center text-zinc-400 px-5 py-2.5" href="#">
          <span className="material-symbols-outlined mb-1">person</span>
          <span className="font-['Inter'] font-medium text-[11px] tracking-wide">Profile</span>
        </a>
      </nav>
    </div>
  );
}

export function ProfilePage() {
  return <ProfileContent />;
}
