import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { SignedIn, SignedOut, SignIn } from "@clerk/clerk-react";

import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";

// Placeholder Pages (filled in later phases)
const Food = () => <div className="p-4 text-muted">Essen</div>;
const Training = () => <div className="p-4 text-muted">Training</div>;
const Supplements = () => <div className="p-4 text-muted">Supplements</div>;
const Weight = () => <div className="p-4 text-muted">Gewicht</div>;

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
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/food" element={<Food />} />
            <Route path="/training" element={<Training />} />
            <Route path="/supplements" element={<Supplements />} />
            <Route path="/weight" element={<Weight />} />
          </Routes>
        </Layout>
      </SignedIn>
    </Router>
  );
}

export default App;