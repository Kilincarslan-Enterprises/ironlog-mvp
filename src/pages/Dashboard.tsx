import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Utensils, Dumbbell, Pill, LineChart, CheckCircle, Flame } from "lucide-react";
import { ProgressRing } from "../components/ProgressRing";
import { Loading, ErrorState } from "../components/States";
import { getDashboard, type Dashboard as DashboardData } from "../lib/api";

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await getDashboard();
      setData(d);
    } catch (e: any) {
      setError(e?.message || "Dashboard konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) return <Loading label="Dashboard laden…" />;
  if (error && !data)
    return <ErrorState message={error} onRetry={load} />;

  const u = data?.user;
  const calMax = u?.dailyCalorieTarget || 2500;
  const proteinMax = u?.dailyProteinTarget || 150;
  const today = data?.today ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const trainingDone = data?.trainingCompleted ?? false;
  const weightDone = data?.weightLogged ?? false;
  const suppDone = data?.supplementsCompleted ?? 0;
  const suppTotal = data?.supplementsTotal ?? 0;

  return (
    <div className="p-4 space-y-6">
      {/* Progress Rings */}
      <section className="flex justify-around items-center bg-card p-4 rounded-2xl border border-border">
        <ProgressRing
          value={today.calories}
          max={calMax}
          label="Kcal"
          subLabel="kcal"
          colorClass="text-accent"
        />
        <ProgressRing
          value={today.protein}
          max={proteinMax}
          label="Protein"
          subLabel="g"
          colorClass="text-success"
        />
      </section>

      {/* Streak & Supplements mini-stats */}
      <section className="flex gap-4">
        <div className="flex-1 bg-card p-3 rounded-xl border border-border flex items-center gap-3">
          <Flame className="text-orange-500" size={24} />
          <div>
            <div className="text-sm font-medium text-muted">Streak</div>
            <div className="font-bold text-text">{data?.streaks.count ?? 0} Tage 🔥</div>
          </div>
        </div>
        <div className="flex-1 bg-card p-3 rounded-xl border border-border flex items-center gap-3">
          <Pill className="text-purple-400" size={24} />
          <div>
            <div className="text-sm font-medium text-muted">Supps</div>
            <div className="font-bold text-text">{suppDone} / {suppTotal}</div>
          </div>
        </div>
      </section>

      {/* Tasks */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-text-strong px-1">Heute anstehend</h2>

        <Link
          to="/training"
          className="block bg-card p-4 rounded-2xl border border-border active:scale-[0.98] transition-transform"
        >
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-accent-soft p-3 rounded-xl">
                <Dumbbell className="text-accent" size={24} />
              </div>
              <div>
                <div className="font-bold text-text">Training</div>
                <div className="text-sm text-muted">
                  {trainingDone ? "Heute abgeschlossen" : "Noch offen"}
                </div>
              </div>
            </div>
            {trainingDone ? (
              <CheckCircle className="text-success" size={24} />
            ) : (
              <div className="bg-accent text-white text-sm font-bold px-4 py-2 rounded-lg">Starten</div>
            )}
          </div>
        </Link>

        <Link
          to="/weight"
          className="block bg-card p-4 rounded-2xl border border-border active:scale-[0.98] transition-transform"
        >
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-success-soft p-3 rounded-xl">
                <LineChart className="text-success" size={24} />
              </div>
              <div>
                <div className="font-bold text-text">Körpergewicht</div>
                <div className="text-sm text-muted">
                  {weightDone && data?.todayWeight != null
                    ? `${data.todayWeight} kg heute`
                    : "Noch nicht erfasst"}
                </div>
              </div>
            </div>
            {weightDone ? (
              <CheckCircle className="text-success" size={24} />
            ) : (
              <div className="bg-card border border-border text-text text-sm font-bold px-4 py-2 rounded-lg">
                Eintragen
              </div>
            )}
          </div>
        </Link>
      </section>

      {/* Quick add food */}
      <section className="pt-4">
        <Link
          to="/food"
          className="flex items-center justify-center gap-2 w-full bg-card hover:bg-card-hover border border-border text-text font-bold py-4 rounded-2xl transition-colors"
        >
          <Utensils size={20} />
          Essen hinzufügen
        </Link>
      </section>
    </div>
  );
}