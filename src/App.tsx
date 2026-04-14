import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useBusinessTheme } from "@/hooks/useBusinessTheme";
import AppLayout from "@/components/AppLayout";
import LandingPage from "@/pages/LandingPage";
import Auth from "@/pages/Auth";
import ClientBooking from "@/pages/ClientBooking";
import MyAppointments from "@/pages/MyAppointments";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminTreatments from "@/pages/admin/AdminTreatments";
import AdminSettings from "@/pages/admin/AdminSettings";
import AdminCalendar from "@/pages/admin/AdminCalendar";
import Gallery from "@/pages/Gallery";
import About from "@/pages/About";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">טוען...</div>;
  if (!user) return <Navigate to="/auth" />;
  if (adminOnly && !isAdmin) return <Navigate to="/booking" />;
  return <AppLayout>{children}</AppLayout>;
}

function AppRoutes() {
  const { user, loading, isAdmin } = useAuth();
  const { ready: themeReady } = useBusinessTheme();

  if (loading || !themeReady) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">טוען...</div>;

  return (
    <Routes>
      <Route path="/" element={user && isAdmin ? <Navigate to="/admin" /> : <LandingPage />} />
      <Route path="/auth" element={user ? <Navigate to={isAdmin ? "/admin" : "/booking"} /> : <Auth />} />
      <Route path="/gallery" element={<Gallery />} />
      <Route path="/about" element={<About />} />
      <Route path="/booking" element={<ProtectedRoute><ClientBooking /></ProtectedRoute>} />
      <Route path="/my-appointments" element={<ProtectedRoute><MyAppointments /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/treatments" element={<ProtectedRoute adminOnly><AdminTreatments /></ProtectedRoute>} />
      <Route path="/admin/settings" element={<ProtectedRoute adminOnly><AdminSettings /></ProtectedRoute>} />
      <Route path="/admin/calendar" element={<ProtectedRoute adminOnly><AdminCalendar /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
