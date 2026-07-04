import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Pause, Play, Trophy } from "lucide-react";
import { Card } from "../components/Card";
import { Modal } from "../components/Modal";
import { Loading, ErrorState, EmptyState } from "../components/States";
import {
  getGoals,
  createGoal,
  updateGoalStatus,
  deleteGoal,
  getGoalProgress,
  type Goal,
} from "../lib/api";

const STATUS_LABEL: Record<Goal["status"], string> = {
  active: "Aktiv",
  paused: "Pausiert",
  achieved: "Erreicht",
  abandoned: "Abgebrochen",
};

const STATUS_TONE: Record<Goal["status"], string> = {
  active: "text-success bg-success-soft",
  paused: "text-warning bg-warning/10",
  achieved: "text-accent bg-accent-soft",
  abandoned: "text-muted bg-card-hover",
};

export default function Goals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [filter, setFilter] = useState<Goal["status"] | "all">("active");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await getGoals();
      setGoals(r.goals);
      // Fetch progress (latest value) for each goal with a target.
      const entries = await Promise.all(
        r.goals.map(async (g) => {
          if (!g.targetValue) return [g.id, 0] as const;
          try {
            const p = await getGoalProgress(g.id);
            const latest = p.progress.sort(
              (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
            )[0];
            return [g.id, latest ? latest.value : 0] as const;
          } catch {
            return [g.id, 0] as const;
          }
        }),
      );
      setProgress(Object.fromEntries(entries));
    } catch (e: any) {
      setError(e?.message || "Ziele konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onStatusChange = async (id: string, status: Goal["status"]) => {
    try {
      const r = await updateGoalStatus(id, status);
      setGoals((prev) => prev.map((g) => (g.id === id ? r.goal : g)));
    } catch (e: any) {
      setError(e?.message || "Status konnte nicht geändert werden.");
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Ziel löschen?")) return;
    try {
      await deleteGoal(id);
      setGoals((prev) => prev.filter((g) => g.id !== id));
    } catch (e: any) {
      setError(e?.message || "Löschen fehlgeschlagen.");
    }
  };

  const onCreated = async () => {
    setAddOpen(false);
    await load();
  };

  const visible = goals.filter((g) => filter === "all" || g.status === filter);

  return (
    <div className="p-4 space-y-5">
      <h1 className="text-xl font-bold text-text-strong">Ziele</h1>

      {/* Filter */}
      <div className="flex gap-1 bg-card border border-border rounded-xl p-1 overflow-x-auto">
        {(["active", "paused", "achieved", "all"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`flex-1 whitespace-nowrap py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors ${
              filter === f ? "bg-accent text-white" : "text-muted hover:text-text"
            }`}
          >
            {f === "all" ? "Alle" : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {loading && goals.length === 0 ? (
        <Loading label="Ziele laden…" />
      ) : error && goals.length === 0 ? (
        <ErrorState message={error} onRetry={load} />
      ) : visible.length === 0 ? (
        <EmptyState
          title="Keine Ziele"
          hint="Setze dir ein Ziel, um Fortschritt zu tracken."
        />
      ) : (
        <div className="space-y-3">
          {visible.map((g) => {
            const target = g.targetValue ?? 0;
            const current = progress[g.id] ?? 0;
            const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
            const deadline = g.deadline
              ? new Date(g.deadline).toLocaleDateString("de-DE")
              : null;
            return (
              <Card key={g.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-text-strong truncate">{g.title}</div>
                    <div className="text-xs text-muted mt-0.5">
                      {g.category}
                      {target ? ` · Ziel ${target}${g.targetUnit || ""}` : ""}
                      {deadline ? ` · bis ${deadline}` : ""}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-1 rounded-full ${STATUS_TONE[g.status]}`}
                  >
                    {STATUS_LABEL[g.status]}
                  </span>
                </div>

                {/* Progress bar */}
                {target > 0 && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-muted mb-1">
                      <span>{current}{g.targetUnit || ""}</span>
                      <span>{target}{g.targetUnit || ""}</span>
                    </div>
                    <div className="h-2 bg-bg rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Status actions */}
                <div className="flex items-center gap-2 mt-3">
                  {g.status !== "active" && (
                    <button
                      type="button"
                      onClick={() => onStatusChange(g.id, "active")}
                      className="flex items-center gap-1 text-xs font-semibold text-success"
                    >
                      <Play size={12} /> Aktiv
                    </button>
                  )}
                  {g.status !== "paused" && (
                    <button
                      type="button"
                      onClick={() => onStatusChange(g.id, "paused")}
                      className="flex items-center gap-1 text-xs font-semibold text-warning"
                    >
                      <Pause size={12} /> Pause
                    </button>
                  )}
                  {g.status !== "achieved" && (
                    <button
                      type="button"
                      onClick={() => onStatusChange(g.id, "achieved")}
                      className="flex items-center gap-1 text-xs font-semibold text-accent"
                    >
                      <Trophy size={12} /> Erreicht
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDelete(g.id)}
                    className="ml-auto text-muted hover:text-danger"
                    aria-label="Löschen"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => setAddOpen(true)}
        className="fixed bottom-24 right-4 z-20 bg-accent text-white rounded-full w-14 h-14 shadow-lg flex items-center justify-center active:scale-95 transition-transform hover:bg-accent-hover"
        aria-label="Ziel hinzufügen"
      >
        <Plus size={28} />
      </button>

      {addOpen && <AddGoalModal onClose={() => setAddOpen(false)} onCreated={onCreated} />}
    </div>
  );
}

function AddGoalModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    title: "",
    category: "weight" as Goal["category"],
    direction: "lose" as "lose" | "maintain" | "gain",
    targetValue: "",
    targetUnit: "kg",
    deadline: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.title.trim()) {
      setErr("Titel erforderlich.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await createGoal({
        title: form.title.trim(),
        category: form.category,
        direction: form.direction,
        targetValue: form.targetValue ? Number(form.targetValue) : null,
        targetUnit: form.targetUnit || null,
        deadline: form.deadline ? new Date(form.deadline).getTime() : null,
      });
      onCreated();
    } catch (e: any) {
      setErr(e?.message || "Anlegen fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder:text-muted";

  return (
    <Modal
      open
      onClose={onClose}
      title="Neues Ziel"
      footer={
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="w-full bg-accent text-white font-bold py-3 rounded-xl disabled:opacity-50 hover:bg-accent-hover"
        >
          {saving ? "Speichern…" : "Anlegen"}
        </button>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className="text-xs text-muted">Titel</span>
          <input value={form.title} onChange={set("title")} placeholder="z. B. 80 kg erreichen" className={inputCls} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs text-muted">Kategorie</span>
            <select value={form.category} onChange={set("category")} className={inputCls}>
              <option value="weight">Gewicht</option>
              <option value="nutrition">Ernährung</option>
              <option value="strength">Kraft</option>
              <option value="cardio">Cardio</option>
              <option value="habit">Gewohnheit</option>
              <option value="custom">Sonstiges</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-muted">Richtung</span>
            <select value={form.direction} onChange={set("direction")} className={inputCls}>
              <option value="lose">Reduzieren</option>
              <option value="maintain">Halten</option>
              <option value="gain">Aufbauen</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-muted">Zielwert</span>
            <input
              type="number"
              inputMode="decimal"
              value={form.targetValue}
              onChange={set("targetValue")}
              placeholder="80"
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted">Einheit</span>
            <input value={form.targetUnit} onChange={set("targetUnit")} placeholder="kg" className={inputCls} />
          </label>
        </div>
        <label className="block">
          <span className="text-xs text-muted">Deadline (optional)</span>
          <input type="date" value={form.deadline} onChange={set("deadline")} className={inputCls} />
        </label>
        {err && <p className="text-sm text-danger">{err}</p>}
      </div>
    </Modal>
  );
}