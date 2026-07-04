import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { SignedIn, SignedOut, SignIn, useAuth } from "@clerk/clerk-react";

import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Food from "./pages/Food";
import Training from "./pages/Training";
import Supplements from "./pages/Supplements";
import Weight from "./pages/Weight";
import Goals from "./pages/Goals";
import { setTokenGetter } from "./lib/api";

/**
 * Bridges Clerk's session JWT into the plain-module API client.
 * Rendered once inside <SignedIn> so the token getter always reflects the
 * active Clerk session.
 */
function AuthBridge() {
  const { getToken } = useAuth();
  useEffect(() => {
    setTokenGetter(() => getToken());
  }, [getToken]);
  return null;
}

function App() {
  return (
    <Router>
      <SignedOut>
        <div className="min-h-[100dvh] flex items-center justify-center bg-bg p-4">
          <div className="bg-card p-6 rounded-2xl border border-border text-center space-y-4 max-w-sm w-full shadow-2xl">
            <h1 className="text-2xl font-bold text-text-strong">
              Willkommen bei IronLog
            </h1>
            <p className="text-muted">Dein AI-gesteuerter Fitness Tracker.</p>
            <div className="flex justify-center mt-4">
              <SignIn routing="hash" />
            </div>
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        <AuthBridge />
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/food" element={<Food />} />
            <Route path="/training" element={<Training />} />
            <Route path="/supplements" element={<Supplements />} />
            <Route path="/weight" element={<Weight />} />
            <Route path="/goals" element={<Goals />} />
          </Routes>
        </Layout>
      </SignedIn>
    </Router>
  );
}

export default App;