import { Authenticated, Unauthenticated, useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import { Dashboard } from "./components/Dashboard";
import { useEffect } from "react";
import { BookOpen, Sparkles } from "lucide-react";

export default function App() {
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const seedTemplates = useMutation(api.templates.seed);

  useEffect(() => {
    if (loggedInUser) {
      seedTemplates();
    }
  }, [loggedInUser, seedTemplates]);

  return (
    <div className="min-h-screen font-sans">
      <Authenticated>
        <Dashboard />
      </Authenticated>
      
      <Unauthenticated>
        <div className="auth-background min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 relative">
          {/* Animated Background Particles */}
          <div className="auth-particles">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="auth-particle" />
            ))}
          </div>

          {/* Main Content Container */}
          <div className="w-full max-w-md relative z-10">
            {/* Logo & Brand Section */}
            <div className="text-center mb-8 space-y-4">
              {/* Logo Icon */}
              <div className="auth-logo inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 backdrop-blur-sm mb-2">
                <div className="relative">
                  <BookOpen className="w-10 h-10 text-indigo-300" />
                  <Sparkles className="w-4 h-4 text-emerald-400 absolute -top-1 -right-1" />
                </div>
              </div>
              
              {/* Brand Name */}
              <div className="space-y-1">
                <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight">
                  Book<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Zang</span>
                </h1>
                <p className="text-white/50 text-sm sm:text-base font-medium">
                  Transform books into beautiful PDFs
                </p>
              </div>

              {/* Feature Pills */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/60">
                  Gutenberg Import
                </span>
                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/60">
                  PDF Export
                </span>
                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/60">
                  Beautiful Templates
                </span>
              </div>
            </div>

            {/* Auth Card */}
            <div className="auth-card p-6 sm:p-8">
              <SignInForm />
            </div>

            {/* Footer */}
            <div className="text-center mt-8 space-y-2">
              <p className="text-xs text-white/30">
                By signing in, you agree to our Terms of Service and Privacy Policy
              </p>
              <p className="text-xs text-white/20">
                © 2026 BookZang. All rights reserved.
              </p>
            </div>
          </div>

          {/* Decorative Gradient Orbs - Behind Card */}
          <div className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/30 rounded-full blur-[120px] pointer-events-none" />
          <div className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-purple-500/20 rounded-full blur-[100px] pointer-events-none" />
          <div className="fixed bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        </div>
      </Unauthenticated>
      
      <Toaster 
        position="top-center"
        toastOptions={{
          style: {
            background: 'rgba(30, 27, 75, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: 'white',
          },
        }}
      />
    </div>
  );
}
