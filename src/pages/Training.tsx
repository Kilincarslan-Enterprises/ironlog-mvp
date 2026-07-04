import { useCallback, useEffect, useState } from "react";
import { Plus, Play, Check, Flame, Trophy, History, ChevronRight, Trash2 } from "lucide-react";
import { Card } from "../components/Card";
import { Modal } from "../components/Modal";
import { Loading, ErrorState, EmptyState } from "../components/States";
import {
  getExercises,
  getWorkoutPlans,
  activateWorkoutPlan,
  getWorkoutSessions,
  startWorkoutSession,
  finishWorkoutSession,
  addSet,
  deleteSet,
  getPersonalRecords,
  getExerciseHistory,
  createExercise,
  type Exercise,
  type WorkoutPlan,
  type WorkoutSession,
  type WorkoutSet,
} from "../lib/api";

export default function Training() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addSetOpen, setAddSetOpen] = useState(false);
  const [historyEx, setHistoryEx] = useState<Exercise | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ex, pl, se, pr] = await Promise.all([
        getExercises(),
        getWorkoutPlans(),
        getWorkoutSessions(),
        getPersonalRecords(),
      ]);
      setExercises(ex.exercises);
      setPlans(pl.plans);
      setSessions(se.sessions);
      setRecords(pr.records || []);
    } catch (e: any) {
      setError(e?.message || "Training konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeSession = sessions.find((s) => !s.endedAt) || null;

  const startSession = async (plan?: WorkoutPlan) => {
    try {
      const r = await startWorkoutSession({
        name: plan?.name || "Workout",
        planId: plan?.id,
      });
      setSessions((prev) => [r.session, ...prev]);
    } catch (e: any) {
      setError(e?.message || "Session konnte nicht gestartet werden.");
    }
  };

  const finishSession = async (id: string) => {
    try {
      const r = await finishWorkoutSession(id);
      setSessions((prev) => prev.map((s) => (s.id === id ? r.session : s)));
    } catch (e: any) {
      setError(e?.message || "Session konnte nicht beendet werden.");
    }
  };

  const onActivate = async (id: string) => {
    try {
      const r = await activateWorkoutPlan(id);
      setPlans((prev) => prev.map((p) => ({ ...p, isActive: p.id === r.plan.id })));
    } catch (e: any) {
      setError(e?.message || "Plan konnte nicht aktiviert werden.");
    }
  };

  const onAddSet = async (data: any) => {
    if (!activeSession) return;
    try {
      const r = await addSet(activeSession.id, data);
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSession.id ? { ...s, sets: [...s.sets, r.set] } : s,
        ),
      );
      setAddSetOpen(false);
    } catch (e: any) {
      setError(e?.message || "Satz konnte nicht hinzugefügt werden.");
    }
  };

  const onRemoveSet = async (sessionId: string, setId: string) => {
    try {
      await deleteSet(sessionId, setId);
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, sets: s.sets.filter((x) => x.id !== setId) } : s,
        ),
      );
    } catch (e: any) {
      setError(e?.message || "Satz konnte nicht gelöscht werden.");
    }
  };

  /** Create an exercise and append it to the local list (used by AddSetModal). */
  const createExerciseLocal = useCallback(async (name: string) => {
    const r = await createExercise({ name, category: "strength" });
    setExercises((prev) => [...prev, r.exercise]);
    return r.exercise;
  }, []);

  if (loading && sessions.length === 0 && plans.length === 0)
    return (
      <div className="p-4">
        <Loading label="Training laden…" />
      </div>
    );

  return (
    <div className="p-4 space-y-5">
      <h1 className="text-xl font-bold text-text-strong">Training</h1>
      {error && <ErrorState message={error} onRetry={load} />}

      {/* Active session or start */}
      {activeSession ? (
        <ActiveSessionCard
          session={activeSession}
          exercises={exercises}
          onAddSet={() => setAddSetOpen(true)}
          onFinish={() => finishSession(activeSession.id)}
          onRemoveSet={(setId) => onRemoveSet(activeSession.id, setId)}
          onShowHistory={(ex) => setHistoryEx(ex)}
        />
      ) : (
        <Card title="Heute" subtitle="Noch kein Training">
          <button
            type="button"
            onClick={() => startSession(plans.find((p) => p.isActive))}
            className="w-full bg-accent text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-accent-hover"
          >
            <Play size={18} /> Session starten
          </button>
        </Card>
      )}

      {/* Workout plans */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-text-strong px-1">Pläne</h2>
        {plans.length === 0 ? (
          <EmptyState title="Keine Pläne" hint="Erstelle Workouts im API oder per Agent." />
        ) : (
          plans.map((p) => (
            <Card
              key={p.id}
              title={p.name}
              subtitle={p.isActive ? "Aktiv" : "Inaktiv"}
              action={
                p.isActive ? (
                  <span className="text-success text-xs font-bold">AKTIV</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onActivate(p.id)}
                    className="text-sm font-semibold text-accent hover:text-accent-hover"
                  >
                    Aktivieren
                  </button>
                )
              }
            >
              <p className="text-sm text-muted">
                {p.exercises.length} Übung(en) · {p.schedule || "kein Schedule"}
              </p>
            </Card>
          ))
        )}
      </section>

      {/* Personal records */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-text-strong px-1 flex items-center gap-2">
          <Trophy size={18} className="text-warning" /> Personal Records
        </h2>
        {records.length === 0 ? (
          <EmptyState title="Noch keine PRs" hint="Logge Sätze, um Rekorde zu sehen." />
        ) : (
          records.map((r) => (
            <Card key={r.exercise.id} title={r.exercise.name}>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-text">
                  <Flame className="inline text-danger" size={14} /> {r.weight} kg × {r.reps}
                </span>
              </div>
            </Card>
          ))
        )}
      </section>

      {/* Exercise history entry */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-text-strong px-1 flex items-center gap-2">
          <History size={18} className="text-accent" /> Übungsverlauf
        </h2>
        {exercises.length === 0 ? (
          <EmptyState title="Keine Übungen" />
        ) : (
          exercises.map((ex) => (
            <button
              key={ex.id}
              type="button"
              onClick={() => setHistoryEx(ex)}
              className="w-full bg-card border border-border rounded-2xl p-3 flex items-center justify-between hover:bg-card-hover"
            >
              <span className="text-sm font-semibold text-text">{ex.name}</span>
              <ChevronRight size={18} className="text-muted" />
            </button>
          ))
        )}
      </section>

      {addSetOpen && activeSession && (
        <AddSetModal
          exercises={exercises}
          onClose={() => setAddSetOpen(false)}
          onAdd={onAddSet}
          onCreateExercise={createExerciseLocal}
        />
      )}

      {historyEx && (
        <HistoryModal exercise={historyEx} onClose={() => setHistoryEx(null)} />
      )}
    </div>
  );
}

function ActiveSessionCard({
  session,
  exercises,
  onAddSet,
  onFinish,
  onRemoveSet,
  onShowHistory,
}: {
  session: WorkoutSession;
  exercises: Exercise[];
  onAddSet: () => void;
  onFinish: () => void;
  onRemoveSet: (setId: string) => void;
  onShowHistory: (ex: Exercise) => void;
}) {
  const startedAt = new Date(session.startedAt);
  const mins = session.endedAt
    ? Math.round((new Date(session.endedAt).getTime() - startedAt.getTime()) / 60000)
    : Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 60000));

  // Group sets by exercise
  const byExercise = new Map<string, WorkoutSet[]>();
  for (const set of session.sets) {
    const arr = byExercise.get(set.exerciseId) || [];
    arr.push(set);
    byExercise.set(set.exerciseId, arr);
  }
  const exMap = new Map(exercises.map((e) => [e.id, e]));

  return (
    <Card
      title={session.name}
      subtitle={`Aktiv · ${mins} min`}
      action={
        <button
          type="button"
          onClick={onFinish}
          className="bg-success text-white text-sm font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"
        >
          <Check size={14} /> Fertig
        </button>
      }
    >
      <div className="space-y-3">
        {byExercise.size === 0 ? (
          <p className="text-sm text-muted">Noch keine Sätze. Tippe „Satz hinzufügen“.</p>
        ) : (
          [...byExercise.entries()].map(([exId, sets]) => {
            const ex = exMap.get(exId);
            return (
              <div key={exId} className="border-t border-border-muted pt-2 first:border-0 first:pt-0">
                <button
                  type="button"
                  onClick={() => ex && onShowHistory(ex)}
                  className="font-semibold text-sm text-text-strong"
                >
                  {ex?.name || "Unbekannt"}
                </button>
                <div className="mt-1 space-y-1">
                  {sets.map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-sm">
                      <span className="text-text">
                        #{s.setNumber} · {s.weight ?? "-"}kg × {s.reps ?? "-"}
                        {s.rpe ? ` · RPE ${s.rpe}` : ""}
                        {s.isWarmup ? " · WG" : ""}
                        {s.isDropset ? " · DS" : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemoveSet(s.id)}
                        aria-label="Satz löschen"
                        className="text-muted hover:text-danger"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
        <button
          type="button"
          onClick={onAddSet}
          className="w-full mt-1 bg-bg border border-border rounded-xl py-2.5 text-sm font-semibold text-accent hover:bg-card-hover flex items-center justify-center gap-1"
        >
          <Plus size={16} /> Satz hinzufügen
        </button>
      </div>
    </Card>
  );
}

function AddSetModal({
  exercises,
  onClose,
  onAdd,
  onCreateExercise,
}: {
  exercises: Exercise[];
  onClose: () => void;
  onAdd: (data: any) => void;
  onCreateExercise: (name: string) => Promise<Exercise>;
}) {
  const [exerciseId, setExerciseId] = useState("");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [rpe, setRpe] = useState("");
  const [isWarmup, setIsWarmup] = useState(false);
  const [isDropset, setIsDropset] = useState(false);
  const [showNewEx, setShowNewEx] = useState(exercises.length === 0);
  const [newExName, setNewExName] = useState("");
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!exerciseId) {
      setErr("Übung wählen.");
      return;
    }
    onAdd({
      exerciseId,
      weight: weight ? Number(weight) : null,
      reps: reps ? Number(reps) : null,
      rpe: rpe ? Number(rpe) : null,
      isWarmup,
      isDropset,
    });
  };

  const createEx = async () => {
    if (!newExName.trim()) return;
    setCreating(true);
    try {
      const ex = await onCreateExercise(newExName.trim());
      setExerciseId(ex.id);
      setShowNewEx(false);
    } catch (e: any) {
      setErr(e?.message || "Übung konnte nicht angelegt werden.");
    } finally {
      setCreating(false);
    }
  };

  // Note: creating a new exercise here adds it locally; the parent list refreshes on reload.
  // To keep the dropdown consistent, we close after add and rely on parent reload.
  return (
    <Modal
      open
      onClose={onClose}
      title="Satz hinzufügen"
      footer={
        <button
          type="button"
          onClick={submit}
          className="w-full bg-accent text-white font-bold py-3 rounded-xl hover:bg-accent-hover"
        >
          Speichern
        </button>
      }
    >
      <div className="space-y-3">
        {showNewEx ? (
          <div className="space-y-2">
            <label className="text-xs text-muted">Neue Übung</label>
            <input
              value={newExName}
              onChange={(e) => setNewExName(e.target.value)}
              placeholder="z. B. Bankdrücken"
              className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowNewEx(false)}
                className="flex-1 bg-bg border border-border text-text py-2.5 rounded-xl text-sm font-semibold"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={createEx}
                disabled={creating || !newExName.trim()}
                className="flex-1 bg-accent text-white py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
              >
                {creating ? "…" : "Anlegen"}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <label className="text-xs text-muted">Übung</label>
            <select
              value={exerciseId}
              onChange={(e) => setExerciseId(e.target.value)}
              className="w-full mt-1 bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text"
            >
              <option value="">Wählen…</option>
              {exercises.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowNewEx(true)}
              className="mt-1 text-xs font-semibold text-accent"
            >
              + Neue Übung
            </button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <label className="block">
            <span className="text-xs text-muted">kg</span>
            <input
              type="number"
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full mt-1 bg-bg border border-border rounded-xl px-2 py-2.5 text-sm text-text"
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted">Reps</span>
            <input
              type="number"
              inputMode="numeric"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              className="w-full mt-1 bg-bg border border-border rounded-xl px-2 py-2.5 text-sm text-text"
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted">RPE</span>
            <input
              type="number"
              inputMode="decimal"
              value={rpe}
              onChange={(e) => setRpe(e.target.value)}
              className="w-full mt-1 bg-bg border border-border rounded-xl px-2 py-2.5 text-sm text-text"
            />
          </label>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsWarmup((v) => !v)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold border ${
              isWarmup ? "bg-accent-soft border-accent text-accent" : "border-border text-muted"
            }`}
          >
            Warmup
          </button>
          <button
            type="button"
            onClick={() => setIsDropset((v) => !v)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold border ${
              isDropset ? "bg-danger-soft border-danger text-danger" : "border-border text-muted"
            }`}
          >
            Dropset
          </button>
        </div>

        {err && <p className="text-sm text-danger">{err}</p>}
      </div>
    </Modal>
  );
}

function HistoryModal({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  const [history, setHistory] = useState<WorkoutSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getExerciseHistory(exercise.id)
      .then((r) => setHistory(r.history || []))
      .catch((e) => setErr(e?.message || "Verlauf konnte nicht geladen werden."))
      .finally(() => setLoading(false));
  }, [exercise.id]);

  return (
    <Modal open onClose={onClose} title={`Verlauf · ${exercise.name}`}>
      {loading ? (
        <Loading />
      ) : err ? (
        <ErrorState message={err} />
      ) : history.length === 0 ? (
        <EmptyState title="Noch keine Sätze" hint="Logge diese Übung in einem Workout." />
      ) : (
        <ul className="space-y-1">
          {history.map((s) => (
            <li key={s.id} className="flex justify-between text-sm border-b border-border-muted py-2">
              <span className="text-muted">
                {new Date((s as any).sessionStartedAt || s.setNumber).toLocaleDateString("de-DE")}
              </span>
              <span className="text-text">
                {s.weight ?? "-"}kg × {s.reps ?? "-"}
                {s.rpe ? ` · RPE ${s.rpe}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}