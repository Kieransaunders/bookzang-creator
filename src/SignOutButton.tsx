"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <button
      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white font-medium border border-white/10 hover:border-white/20 transition-all duration-200"
      onClick={() => void signOut()}
    >
      <LogOut size={18} />
      Sign out
    </button>
  );
}
