import { Authenticated, Unauthenticated, useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import { Dashboard } from "./components/Dashboard";
import { useEffect } from "react";

export default function App() {
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const seedTemplates = useMutation(api.templates.seed);

  useEffect(() => {
    if (loggedInUser) {
      seedTemplates();
    }
  }, [loggedInUser, seedTemplates]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Authenticated>
        <Dashboard />
      </Authenticated>
      
      <Unauthenticated>
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-white mb-4">BookZang</h1>
              <p className="text-slate-300">Transform public domain books into beautiful PDFs</p>
            </div>
            <SignInForm />
          </div>
        </div>
      </Unauthenticated>
      
      <Toaster />
    </div>
  );
}
