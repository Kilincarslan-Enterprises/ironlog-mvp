import { Link } from "react-router-dom";
import { Utensils, Dumbbell, Pill, LineChart, CheckCircle, Flame } from "lucide-react";
import { ProgressRing } from "../components/ProgressRing";

export default function Dashboard() {
  // Mock data for UI development
  const data = {
    calories: { current: 1850, max: 2200 },
    protein: { current: 112, max: 150 },
    training: { completed: false, todayPlan: "Push Day" },
    weight: { logged: false },
    supplements: { completed: 4, total: 5 },
    streaks: { active: true, count: 8 }
  };

  return (
    <div className="p-4 space-y-6">
      
      {/* Top Section: Progress Rings */}
      <section className="flex justify-around items-center bg-card p-4 rounded-2xl border border-border">
        <ProgressRing 
          value={data.calories.current} 
          max={data.calories.max} 
          label="Kcal" 
          subLabel="kcal"
          colorClass="text-accent"
        />
        <ProgressRing 
          value={data.protein.current} 
          max={data.protein.max} 
          label="Protein" 
          subLabel="g"
          colorClass="text-success"
        />
      </section>

      {/* Streaks & Mini Stats */}
      <section className="flex gap-4">
        <div className="flex-1 bg-card p-3 rounded-xl border border-border flex items-center gap-3">
          <Flame className="text-orange-500" size={24} />
          <div>
            <div className="text-sm font-medium text-muted">Streak</div>
            <div className="font-bold text-text">{data.streaks.count} Tage 🔥</div>
          </div>
        </div>
        <div className="flex-1 bg-card p-3 rounded-xl border border-border flex items-center gap-3">
          <Pill className="text-purple-400" size={24} />
          <div>
            <div className="text-sm font-medium text-muted">Supps</div>
            <div className="font-bold text-text">{data.supplements.completed} / {data.supplements.total}</div>
          </div>
        </div>
      </section>

      {/* Main Actions / Tasks */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-text px-1">Heute anstehend</h2>
        
        {/* Training Action */}
        <Link to="/training" className="block bg-card p-4 rounded-2xl border border-border active:scale-[0.98] transition-transform">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500/10 p-3 rounded-xl">
                <Dumbbell className="text-accent" size={24} />
              </div>
              <div>
                <div className="font-bold text-text">Training</div>
                <div className="text-sm text-muted">{data.training.todayPlan}</div>
              </div>
            </div>
            {data.training.completed ? (
              <CheckCircle className="text-success" size={24} />
            ) : (
              <div className="bg-accent text-white text-sm font-bold px-4 py-2 rounded-lg">Starten</div>
            )}
          </div>
        </Link>

        {/* Weight Action */}
        <div className="block bg-card p-4 rounded-2xl border border-border active:scale-[0.98] transition-transform">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-green-500/10 p-3 rounded-xl">
                <LineChart className="text-success" size={24} />
              </div>
              <div>
                <div className="font-bold text-text">Körpergewicht</div>
                <div className="text-sm text-muted">Noch nicht erfasst</div>
              </div>
            </div>
            {data.weight.logged ? (
              <CheckCircle className="text-success" size={24} />
            ) : (
              <Link to="/weight" className="bg-card border border-border hover:bg-border text-text text-sm font-bold px-4 py-2 rounded-lg transition-colors">
                Eintragen
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Quick Add (Floating Action style inside the flow) */}
      <section className="pt-4">
        <Link to="/food" className="flex items-center justify-center gap-2 w-full bg-card hover:bg-border border border-border text-text font-bold py-4 rounded-2xl transition-colors">
          <Utensils size={20} />
          Essen hinzufügen
        </Link>
      </section>

    </div>
  );
}
