import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { TournamentProvider } from "@/contexts/TournamentContext";
import { AuthGuard } from "@/components/auth/AuthGuard";

// Eagerly loaded critical landing page
import Index from "./pages/Index";

// Lazy-loaded code-split pages for high performance
const Admin = lazy(() => import("./pages/Admin"));
const PointsTable = lazy(() => import("./pages/PointsTable"));
const TournamentStructure = lazy(() => import("./pages/TournamentStructure"));
const TeamStats = lazy(() => import("./pages/TeamStats"));
const PlayersDirectory = lazy(() => import("./pages/PlayersDirectory"));
const PlayerProfile = lazy(() => import("./pages/PlayerProfile"));
const Auction = lazy(() => import("./pages/Auction"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Optimized Query Client with aggressive edge caching for high concurrency
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes cache for static rosters and tournament tables
      gcTime: 10 * 60 * 1000,   // 10 minutes garbage collection
      refetchOnWindowFocus: false, // Prevent redundant mobile background refetches
      retry: 2,
    },
  },
});

function PageLoadingFallback() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="relative mb-4">
        <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center animate-pulse">
          <span className="text-2xl">🏏</span>
        </div>
        <div className="absolute inset-0 rounded-2xl border-2 border-primary border-t-transparent animate-spin" />
      </div>
      <p className="text-sm font-semibold text-foreground tracking-tight">KAPL 3.0</p>
      <p className="text-xs text-muted-foreground mt-0.5">Loading stadium experience...</p>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <TournamentProvider>
          <BrowserRouter>
            <Suspense fallback={<PageLoadingFallback />}>
              <Routes>
                {/* Public Auth & Tournament Spectator Routes */}
                <Route path="/auth" element={<Auth />} />
                <Route path="/" element={<Index />} />
                <Route path="/players" element={<PlayersDirectory />} />
                <Route path="/players/:id" element={<PlayerProfile />} />
                <Route path="/auction" element={<Auction />} />
                <Route path="/points" element={<PointsTable />} />
                <Route path="/bracket" element={<TournamentStructure />} />
                <Route path="/stats" element={<TeamStats />} />

                {/* Protected Admin & Scoring Route */}
                <Route
                  path="/admin"
                  element={
                    <AuthGuard allowedRoles={['admin', 'co_admin', 'scorer', 'primary_scorer']}>
                      <Admin />
                    </AuthGuard>
                  }
                />

                {/* Fallback */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TournamentProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
