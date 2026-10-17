import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Header } from "@/components/cricket/Header";
import { Navigation } from "@/components/cricket/Navigation";
import { Button } from "@/components/ui/button";
import { Compass, Trophy } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-slate-950 text-foreground flex flex-col relative overflow-hidden">
      {/* Stadium ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-b from-amber-500/15 via-emerald-500/10 to-transparent blur-3xl pointer-events-none -z-10" />

      <Header />
      <Navigation />

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="relative max-w-md w-full text-center p-8 rounded-3xl border border-white/10 bg-slate-900/80 backdrop-blur-xl shadow-2xl shadow-black/60">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-6 shadow-lg shadow-amber-500/10">
            <Compass className="w-8 h-8 animate-spin-slow" />
          </div>

          <span className="inline-block px-3 py-1 text-xs font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 rounded-full border border-amber-500/30 mb-3">
            Out of Bounds
          </span>

          <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-slate-200 to-slate-400 tracking-tight font-display mb-2">
            404
          </h1>
          <p className="text-lg font-semibold text-slate-300 mb-2">Lost in the Pavilion</p>
          <p className="text-sm text-slate-400 mb-8 leading-relaxed">
            The pitch or boundary line you're searching for at <span className="font-mono text-amber-400 text-xs">{location.pathname}</span> doesn't exist in the KAPL tournament grounds.
          </p>

          <Link to="/">
            <Button variant="glow" size="lg" className="w-full gap-2 text-base font-bold">
              <Trophy className="w-4 h-4" />
              Return to Tournament Hub
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
};

export default NotFound;
