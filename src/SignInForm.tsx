"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { toast } from "sonner";
import { Mail, Lock, UserPlus, LogIn, Sparkles, Eye, EyeOff } from "lucide-react";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const toggleFlow = () => {
    setFlow(flow === "signIn" ? "signUp" : "signIn");
  };

  return (
    <div className="w-full space-y-6">
      {/* Form Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-white">
          {flow === "signIn" ? "Welcome back" : "Create account"}
        </h2>
        <p className="text-sm text-white/50 font-normal">
          {flow === "signIn" 
            ? "Enter your credentials to access your library" 
            : "Sign up to start transforming books"}
        </p>
      </div>

      {/* Main Form */}
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitting(true);
          const formData = new FormData(e.target as HTMLFormElement);
          formData.set("flow", flow);
          void signIn("password", formData).catch((error) => {
            let toastTitle = "";
            if (error.message.includes("Invalid password")) {
              toastTitle = "Invalid password. Please try again.";
            } else {
              toastTitle =
                flow === "signIn"
                  ? "Could not sign in, did you mean to sign up?"
                  : "Could not sign up, did you mean to sign in?";
            }
            toast.error(toastTitle);
            setSubmitting(false);
          });
        }}
      >
        {/* Email Field */}
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 pointer-events-none" />
          <input
            className="auth-input-field !pl-[4.5rem]"
            type="email"
            name="email"
            placeholder="Email address"
            required
            autoComplete="email"
          />
        </div>

        {/* Password Field */}
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 pointer-events-none" />
          <input
            className="auth-input-field !pl-[4.5rem] !pr-14"
            type={showPassword ? "text" : "password"}
            name="password"
            placeholder="Password"
            required
            autoComplete={flow === "signIn" ? "current-password" : "new-password"}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors cursor-pointer"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>

        {/* Submit Button */}
        <button 
          className="auth-button-primary flex items-center justify-center gap-2" 
          type="submit" 
          disabled={submitting}
        >
          {submitting ? (
            <>
              <span className="auth-spinner" />
              <span>{flow === "signIn" ? "Signing in..." : "Creating account..."}</span>
            </>
          ) : (
            <>
              {flow === "signIn" ? (
                <LogIn className="w-5 h-5" />
              ) : (
                <UserPlus className="w-5 h-5" />
              )}
              <span>{flow === "signIn" ? "Sign in" : "Create account"}</span>
            </>
          )}
        </button>
      </form>

      {/* Toggle Flow Link */}
      <div className="text-center">
        <span className="text-sm text-white/50 font-normal">
          {flow === "signIn"
            ? "Don't have an account? "
            : "Already have an account? "}
        </span>
        <button
          type="button"
          className="auth-text-button text-sm ml-1 font-medium"
          onClick={toggleFlow}
        >
          {flow === "signIn" ? "Sign up" : "Sign in"}
        </button>
      </div>

      {/* Divider */}
      <div className="auth-divider">
        <span>or continue with</span>
      </div>

      {/* Anonymous Sign In */}
      <button 
        className="auth-button-secondary flex items-center justify-center gap-2" 
        onClick={() => void signIn("anonymous")}
        disabled={submitting}
      >
        <Sparkles className="w-5 h-5 text-emerald-400" />
        <span>Sign in anonymously</span>
      </button>

      {/* Trust Indicators */}
      <div className="flex items-center justify-center gap-4 pt-2">
        <div className="flex items-center gap-1.5 text-xs text-white/40">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span>Secure</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-white/40">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>Instant access</span>
        </div>
      </div>
    </div>
  );
}
