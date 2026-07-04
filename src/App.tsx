import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import { SignedIn, SignedOut, SignIn, UserButton } from "@clerk/clerk-react";
import { Home, Utensils, Dumbbell, Pill, LineChart } from "lucide-react";
import clsx from "clsx";

import Dashboard from "./pages/Dashboard";

// Placeholder Pages
const Food = () => <div className="p-4">Essen</div>;
const Training = () => <div className="p-4">Training</div>;
const Supplements = () => <div className="p-4">Supplements</div>;
const Weight = () => <div className="p-4">Gewicht</div>;

function BottomNav() {
  const location = useLocation();
  const tabs = [
    { name: "Dashboard", path: "/", icon: Home },
    { name: "Essen", path: "/food", icon: Utensils },
    { name: "Training", path: "/training", icon: Dumbbell },
    { name: "Supps", path: "/supplements", icon: Pill },
    { name: "Gewicht", path: "/weight", icon: LineChart },
  ];

  return (
    <nav className="fixed bottom-0 w-full bg-card border-t border-border pb-safe">
      <div className="flex justify-around items-center h-16">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.name}
              to={tab.path}
              className={clsx(
                "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                isActive ? "text-accent" : "text-muted hover:text-text"
              )}
            >
              <Icon size={24} />
              <span className="text-[10px] font-medium">{tab.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <header className="h-14 bg-card border-b border-border flex items-center justify-between px-4 sticky top-0 z-10">
        <h1 className="font-bold text-lg text-text">Rocky Tracker</h1>
        <UserButton afterSignOutUrl="/" />
      </header>
      <main className="flex-1 pb-16 overflow-y-auto">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}

function App() {
  return (
    <Router>
      <SignedOut>
        <div className="min-h-screen flex items-center justify-center bg-bg p-4">
          <div className="bg-card p-6 rounded-xl border border-border text-center space-y-4 max-w-sm w-full">
            <h1 className="text-2xl font-bold">Willkommen bei IronLog</h1>
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
