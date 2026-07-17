import { useCallback, useEffect, useState } from "react";
import {
  Plus, Play, Check, Trophy, History, Trash2,
  Calendar, Dumbbell, TrendingUp, Edit3, Eye,
} from "lucide-react";
import { Card } from "../components/Card";
import { Modal } from "../components/Modal";
import { Loading, ErrorState, EmptyState } from "../components/States";
import {
  getExercises,
  getWorkoutPlans,
  createWorkoutPlan,
  updateWorkoutPlan,
  deleteWorkoutPlan,
  activateWorkoutPlan,
  deleteExercise,
  getWorkoutSessions,
  startWorkoutSession,
  finishWorkoutSession,
  addSet,
  deleteSet,
  getExerciseHistory,
  createExercise,
  getScheduleToday,
  getScheduleWeek,
  setSchedule,
  overrideSchedule,
  deleteScheduleOverride,
  getMachineProgress,
  logMachineWeight,
  type Exercise,
  type WorkoutPlan,
  type WorkoutSession,
  type WorkoutSet,
  type ScheduleToday,
  type ScheduleWeekDay,
  type MachineProgress,
} from "../lib/api";

const DAY_NAMES = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const DAY_NAMES_FULL = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const TYPE_LABELS: Record<string, string> = { machine: "Maschine", "free-weight": "Freihantel", bodyweight: "Körpergewicht" };
const TYPE_COLORS: Record<string, string> = { machine: "text-accent", "free-weight": "text-success", bodyweight: "text-warning" };

export default function Training() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [scheduleToday, setScheduleToday] = useState<ScheduleToday | null>(null);
  const [scheduleWeek, setScheduleWeek] = useState<ScheduleWeekDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addSetOpen, setAddSetOpen] = useState(false);
  const [historyEx, setHistoryEx] = useState<Exercise | null>(null);
  const [exerciseModal, setExerciseModal] = useState<Exercise | null>(null);
  const [addExerciseOpen, setAddExerciseOpen] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [planModal, setPlanModal] = useState<WorkoutPlan | "new" | null>(null);
  const [planView, setPlanView] = useState<WorkoutPlan | null>(null);
  const [scheduleEditOpen, setScheduleEditOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ex, pl, se, st, sw] = await Promise.all([
        getExercises(),
        getWorkoutPlans(),
        getWorkoutSessions(),
        getScheduleToday(),
        getScheduleWeek(),
      ]);
      setExercises(ex.exercises);
      setPlans(pl.plans);
      setSessions((se.sessions || []).map((s: any) => ({ ...s, sets: s.sets || [] })));
      setScheduleToday(st);
      setScheduleWeek(sw.days || []);
    } catch (e: any) {
      setError(e?.message || "Training konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeSession = sessions.find((s) => !s.endedAt) || null;

  const startSession = async (plan?: WorkoutPlan) => {
    try {
      const r = await startWorkoutSession({ name: plan?.name || scheduleToday?.label || "Workout", planId: plan?.id });
      setSessions((prev) => [{ ...r.session, sets: r.session.sets || [] }, ...prev]);
    } catch (e: any) { setError(e?.message || "Session konnte nicht gestartet werden."); }
  };

  const finishSession = async (id: string) => {
    try {
      const r = await finishWorkoutSession(id);
      setSessions((prev) => prev.map((s) => (s.id === id ? { ...r.session, sets: r.session.sets || [] } : s)));
    } catch (e: any) { setError(e?.message || "Session konnte nicht beendet werden."); }
  };

  const onAddSet = async (data: any) => {
    if (!activeSession) return;
    try {
      const r = await addSet(activeSession.id, data);
      setSessions((prev) => prev.map((s) => (s.id === activeSession.id ? { ...s, sets: [...(s.sets || []), r.set] } : s)));
      setAddSetOpen(false);
    } catch (e: any) { setError(e?.message || "Satz konnte nicht hinzugefügt werden."); }
  };

  const onRemoveSet = async (sessionId: string, setId: string) => {
    try {
      await deleteSet(sessionId, setId);
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, sets: (s.sets || []).filter((x) => x.id !== setId) } : s)));
    } catch (e: any) { setError(e?.message || "Satz konnte nicht gelöscht werden."); }
  };

  const onActivate = async (id: string) => {
    try { await activateWorkoutPlan(id); await load(); }
    catch (e: any) { setError(e?.message || "Plan konnte nicht aktiviert werden."); }
  };

  const createExerciseLocal = async (name: string, type?: string): Promise<Exercise> => {
    const r = await createExercise({ name, category: "strength", type: (type as Exercise["type"]) || "free-weight" });
    setExercises((prev) => [...prev, r.exercise]);
    return r.exercise;
  };

  const onExerciseCreated = () => { setAddExerciseOpen(false); load(); };
  const onExerciseDeleted = async (id: string) => {
    try { await deleteExercise(id); setExercises((prev) => prev.filter((e) => e.id !== id)); setExerciseModal(null); }
    catch (e: any) { setError(e?.message || "Übung konnte nicht gelöscht werden."); }
  };

  // Plan exercises for active session (if session has planId)
  const activePlanExercises: Exercise[] = activeSession?.planId
    ? (plans.find((p) => p.id === activeSession.planId)?.exercises || []).map((pe: any) => exercises.find((e) => e.id === pe.exerciseId)).filter((e: Exercise | undefined): e is Exercise => !!e) || []
    : exercises;

  if (loading) return <div className="p-4"><Loading label="Training laden…" /></div>;
  if (error && exercises.length === 0) return <div className="p-4"><ErrorState message={error} onRetry={load} /></div>;

  return (
    <div className="p-4 space-y-5">
      {error && <div className="bg-danger-soft border border-danger rounded-xl p-3 text-sm text-danger">{error}</div>}

      {/* Today's schedule */}
      {scheduleToday && (
        <Card title="Heute" subtitle={DAY_NAMES_FULL[scheduleToday.dayOfWeek]}
          action={scheduleToday.isOverride ? <span className="text-xs font-semibold text-warning">Override</span> : undefined}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-bold text-text-strong">{scheduleToday.label}</p>
              {scheduleToday.plan && (
                <p className="text-sm text-muted mt-0.5">
                  {scheduleToday.plan.name} · {(scheduleToday.plan.exercises?.length ?? 0)} Übung(en)
                </p>
              )}
            </div>
            {scheduleToday.label !== "Rest Day" && (
              <button type="button" onClick={() => startSession(scheduleToday.plan || undefined)}
                className="bg-accent text-white font-bold text-sm px-4 py-2.5 rounded-xl flex items-center gap-1 hover:bg-accent-hover">
                <Play size={16} /> Start
              </button>
            )}
          </div>
          <button type="button" onClick={() => setOverrideOpen(true)}
            className="mt-2 text-xs font-semibold text-muted hover:text-text">
            Heute überschreiben
          </button>
        </Card>
      )}

      {/* Weekly schedule */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-lg font-bold text-text-strong flex items-center gap-2"><Calendar size={18} className="text-accent" /> Woche</h2>
          <button type="button" onClick={() => setScheduleEditOpen(true)}
            className="text-sm font-semibold text-accent hover:text-accent-hover">Bearbeiten</button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {scheduleWeek.map((day, i) => (
            <div key={i} className={`rounded-xl p-2 text-center border ${day.label === "Rest Day" || !day.label ? "border-border bg-bg" : "border-accent/30 bg-accent-soft"}`}>
              <p className="text-[10px] font-semibold text-muted">{DAY_NAMES[day.dayOfWeek]}</p>
              <p className="text-xs font-bold text-text mt-0.5 truncate">
                {day.label === "Rest Day" || !day.label ? "Rest" : day.label.split(" ")[0]}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Active session */}
      {activeSession && (
        <ActiveSessionCard session={activeSession} exercises={exercises} onAddSet={() => setAddSetOpen(true)}
          onFinish={() => finishSession(activeSession.id)} onRemoveSet={(setId) => onRemoveSet(activeSession.id, setId)}
        />
      )}

      {/* Unified exercises list — machines + free-weights + bodyweight */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-lg font-bold text-text-strong flex items-center gap-2"><Dumbbell size={18} className="text-accent" /> Übungen</h2>
          <button type="button" onClick={() => setAddExerciseOpen(true)}
            className="text-sm font-semibold text-accent hover:text-accent-hover flex items-center gap-1">
            <Plus size={16} /> Neu
          </button>
        </div>
        {exercises.length === 0 ? (
          <EmptyState title="Keine Übungen" hint="Füge eine Übung oder Maschine hinzu." />
        ) : (
          <div className="space-y-2">
            {exercises.map((ex) => (
              <div key={ex.id} className="w-full bg-card border border-border rounded-2xl p-3 flex items-center justify-between hover:bg-card-hover">
                <button type="button" onClick={() => setExerciseModal(ex)} className="flex items-center gap-3 flex-1 text-left">
                  <div className="w-10 h-10 rounded-xl bg-bg flex items-center justify-center overflow-hidden shrink-0">
                    {ex.imageUrl ? <img src={ex.imageUrl} alt={ex.name} className="w-full h-full object-cover" />
                    : <Dumbbell size={18} className="text-muted" />}
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-text">{ex.name}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-bold ${TYPE_COLORS[ex.type] || "text-muted"}`}>{TYPE_LABELS[ex.type] || ex.type}</span>
                      {ex.muscleGroup && <span className="text-[10px] text-muted">{ex.muscleGroup}</span>}
                    </div>
                  </div>
                </button>
                <div className="flex items-center gap-1 text-muted">
                  <button type="button" onClick={() => setHistoryEx(ex)} aria-label="History" className="hover:text-accent p-1"><History size={16} /></button>
                  <button type="button" onClick={() => onExerciseDeleted(ex.id)} aria-label="Löschen" className="hover:text-danger p-1"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Workout plans */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-lg font-bold text-text-strong">Pläne</h2>
          <button type="button" onClick={() => setPlanModal("new")}
            className="text-sm font-semibold text-accent hover:text-accent-hover flex items-center gap-1">
            <Plus size={16} /> Neuer Plan
          </button>
        </div>
        {plans.length === 0 ? (
          <EmptyState title="Keine Pläne" hint="Erstelle einen Trainingsplan." />
        ) : (
          plans.map((p) => (
            <Card key={p.id} title={p.name} subtitle={p.isActive ? "Aktiv" : "Inaktiv"}
              action={
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setPlanView(p)} className="text-muted hover:text-accent" aria-label="Ansehen"><Eye size={16} /></button>
                  <button type="button" onClick={() => setPlanModal(p)} className="text-muted hover:text-accent" aria-label="Bearbeiten"><Edit3 size={16} /></button>
                  {p.isActive ? <span className="text-success text-xs font-bold">AKTIV</span>
                  : <button type="button" onClick={() => onActivate(p.id)} className="text-sm font-semibold text-accent hover:text-accent-hover">Aktivieren</button>}
                </div>
              }
            >
              <p className="text-sm text-muted">{(p.exercises?.length ?? 0)} Übung(en) · {p.schedule || "kein Schedule"}</p>
            </Card>
          ))
        )}
      </section>

      {/* Modals */}
      {addSetOpen && activeSession && (
        <AddSetModal exercises={activePlanExercises} onClose={() => setAddSetOpen(false)} onAdd={onAddSet} onCreateExercise={createExerciseLocal} />
      )}
      {historyEx && <HistoryModal exercise={historyEx} onClose={() => setHistoryEx(null)} />}
      {exerciseModal && (
        <ExerciseDetailModal exercise={exerciseModal} onClose={() => setExerciseModal(null)}
          onLogWeight={async (id, weight, reps) => {
            await logMachineWeight(id, { weight, reps });
            setExerciseModal(null); load();
          }}
          onDelete={() => onExerciseDeleted(exerciseModal.id)}
        />
      )}
      {addExerciseOpen && <AddExerciseModal onClose={() => setAddExerciseOpen(false)} onCreated={onExerciseCreated} />}
      {planModal && (
        <PlanModal plan={planModal === "new" ? null : planModal} exercises={exercises}
          onClose={() => setPlanModal(null)} onSaved={() => { setPlanModal(null); load(); }} />
      )}
      {planView && <PlanViewModal plan={planView} exercises={exercises} onClose={() => setPlanView(null)} onEdit={(p) => { setPlanView(null); setPlanModal(p); }}
        onDelete={async () => { await deleteWorkoutPlan(planView.id); setPlanView(null); load(); }} />}
      {scheduleEditOpen && <ScheduleEditModal plans={plans} currentWeek={scheduleWeek} onClose={() => setScheduleEditOpen(false)}
        onSave={async (entries) => { await setSchedule(entries); setScheduleEditOpen(false); load(); }} />}
      {overrideOpen && scheduleToday && (
        <OverrideModal onClose={() => setOverrideOpen(false)} currentLabel={scheduleToday.label}
          isOverride={scheduleToday.isOverride}
          onOverride={async (label, planId) => { const today = new Date().toISOString().slice(0, 10); await overrideSchedule({ date: today, label, planId }); setOverrideOpen(false); load(); }}
          onRevert={async () => { const today = new Date().toISOString().slice(0, 10); await deleteScheduleOverride(today); setOverrideOpen(false); load(); }} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Active session card
// ---------------------------------------------------------------------------
function ActiveSessionCard({ session, exercises, onAddSet, onFinish, onRemoveSet }: {
  session: WorkoutSession; exercises: Exercise[]; onAddSet: () => void; onFinish: () => void; onRemoveSet: (setId: string) => void;
}) {
  const startedAt = new Date(session.startedAt);
  const elapsed = session.endedAt
    ? Math.round(((new Date(session.endedAt)).getTime() - startedAt.getTime()) / 60000)
    : Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 60000));
  const byExercise = new Map<string, WorkoutSet[]>();
  for (const set of (session.sets || [])) {
    const arr = byExercise.get(set.exerciseId) || []; arr.push(set); byExercise.set(set.exerciseId, arr);
  }
  return (
    <Card title={`Aktiv: ${session.name}`} subtitle={`${elapsed} min`} action={
      <button type="button" onClick={onFinish} className="text-sm font-semibold text-danger hover:text-danger/80">Beenden</button>
    }>
      {byExercise.size === 0 ? (
        <p className="text-sm text-muted">Noch keine Sätze. Tippe „Satz hinzufügen".</p>
      ) : (
        [...byExercise.entries()].map(([exId, sets]) => {
          const ex = exercises.find((e) => e.id === exId);
          return (
            <div key={exId} className="mb-2">
              <p className="text-sm font-semibold text-text">{ex?.name || "Unbekannt"}</p>
              <div className="space-y-1 ml-2">
                {sets.map((s, i) => (
                  <div key={s.id} className="flex items-center justify-between text-xs">
                    <span className="text-muted">Satz {i + 1}: {s.weight ? `${s.weight}kg` : ""} {s.reps ? `× ${s.reps}` : ""} {s.isWarmup ? "🔥" : ""} {s.isDropset ? "📉" : ""}</span>
                    <button type="button" onClick={() => onRemoveSet(s.id)} aria-label="Löschen" className="text-muted hover:text-danger"><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
      <button type="button" onClick={onAddSet}
        className="w-full mt-1 bg-bg border border-border rounded-xl py-2.5 text-sm font-semibold text-accent hover:bg-card-hover flex items-center justify-center gap-1">
        <Plus size={16} /> Satz hinzufügen
      </button>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Add exercise modal — unified (machine / free-weight / bodyweight)
// ---------------------------------------------------------------------------
function AddExerciseModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"machine" | "free-weight" | "bodyweight">("free-weight");
  const [muscleGroup, setMuscleGroup] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) { setErr("Name erforderlich."); return; }
    setSaving(true); setErr(null);
    try {
      await createExercise({
        name: name.trim(), category: "strength",
        type, muscleGroup: muscleGroup.trim() || null,
        imageUrl: imageUrl.trim() || null, notes: notes.trim() || null,
      });
      onCreated();
    } catch (e: any) { setErr(e?.message || "Anlegen fehlgeschlagen."); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title="Übung hinzufügen"
      footer={<button type="button" onClick={submit} disabled={saving || !name.trim()}
        className="w-full bg-accent text-white font-bold py-3 rounded-xl hover:bg-accent-hover disabled:opacity-50">
        {saving ? "…" : "Anlegen"}</button>}>
      <div className="space-y-3">
        <label className="block">
          <span className="text-xs text-muted">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Bankdrücken oder Butterfly"
            className="w-full mt-1 bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text" />
        </label>

        <div>
          <span className="text-xs text-muted">Typ</span>
          <div className="grid grid-cols-3 gap-2 mt-1">
            {(["free-weight", "machine", "bodyweight"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setType(t)}
                className={`py-2.5 rounded-xl text-xs font-bold border transition-colors ${
                  type === t ? "bg-accent border-accent text-white" : "border-border text-muted hover:bg-card-hover"}`}>
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="text-xs text-muted">Muskelgruppe (optional)</span>
          <input value={muscleGroup} onChange={(e) => setMuscleGroup(e.target.value)} placeholder="z. B. Brust"
            className="w-full mt-1 bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text" />
        </label>

        {type === "machine" && (
          <label className="block">
            <span className="text-xs text-muted">Bild URL (optional)</span>
            <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…"
              className="w-full mt-1 bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text" />
          </label>
        )}

        <label className="block">
          <span className="text-xs text-muted">Notizen (optional)</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="z. B. Sitzhöhe, Griffweite…"
            rows={2} className="w-full mt-1 bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text resize-none" />
        </label>

        {err && <p className="text-sm text-danger">{err}</p>}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Exercise detail modal — shows progress + quick log for ALL exercise types
// ---------------------------------------------------------------------------
function ExerciseDetailModal({ exercise, onClose, onLogWeight, onDelete }: {
  exercise: Exercise; onClose: () => void;
  onLogWeight: (id: string, weight: number, reps?: number) => Promise<void>;
  onDelete: () => void;
}) {
  const [progress, setProgress] = useState<MachineProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [logging, setLogging] = useState(false);

  const loadProgress = useCallback(async () => {
    setLoading(true);
    try {
      // Use machine progress endpoint for all types (works because machineId = exerciseId for type=machine,
      // and for non-machine types we can still log via session sets, but progress endpoint is machine-specific)
      // For now, only show progress for machine-type exercises
      if (exercise.type === "machine") {
        const p = await getMachineProgress(exercise.id);
        setProgress(p);
      }
    } catch (e: any) { setError(e?.message || "Fortschritt konnte nicht geladen werden."); }
    finally { setLoading(false); }
  }, [exercise.id, exercise.type]);

  useEffect(() => { loadProgress(); }, [loadProgress]);

  const submit = async () => {
    if (!weight) return;
    setLogging(true);
    try {
      await onLogWeight(exercise.id, Number(weight), reps ? Number(reps) : undefined);
      setWeight(""); setReps("");
      await loadProgress();
    } catch (e: any) { setError(e?.message || "Log fehlgeschlagen."); }
    finally { setLogging(false); }
  };

  return (
    <Modal open onClose={onClose} title={exercise.name}
      footer={
        <div className="flex gap-2">
          <button type="button" onClick={onDelete}
            className="flex-1 bg-danger-soft border border-danger text-danger font-semibold py-2.5 rounded-xl text-sm">Löschen</button>
          <button type="button" onClick={submit} disabled={logging || !weight}
            className="flex-[2] bg-accent text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50">
            {logging ? "…" : "Speichern"}</button>
        </div>
      }>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${TYPE_COLORS[exercise.type]}`}>{TYPE_LABELS[exercise.type]}</span>
          {exercise.muscleGroup && <span className="text-xs text-muted">· {exercise.muscleGroup}</span>}
        </div>

        {exercise.imageUrl && <img src={exercise.imageUrl} alt={exercise.name} className="w-full h-40 object-cover rounded-xl" />}
        {exercise.notes && <p className="text-sm text-muted">{exercise.notes}</p>}

        {/* Quick weight log — works for all types */}
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs text-muted">kg</span>
            <input type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)}
              placeholder={progress?.latestLog ? String(progress.latestLog.weight) : "0"}
              className="w-full mt-1 bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text" />
          </label>
          <label className="block">
            <span className="text-xs text-muted">Reps</span>
            <input type="number" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)}
              className="w-full mt-1 bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text" />
          </label>
        </div>

        {/* Progress — only for machine-type (has machine_logs) */}
        {exercise.type === "machine" && (
          loading ? <Loading /> : error ? <ErrorState message={error} /> : progress ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-bg rounded-xl p-3 text-center">
                  <p className="text-xs text-muted">Erstes</p>
                  <p className="text-lg font-bold text-text">{progress.firstLog ? `${progress.firstLog.weight}kg` : "—"}</p>
                </div>
                <div className="bg-bg rounded-xl p-3 text-center">
                  <p className="text-xs text-muted">Letztes</p>
                  <p className="text-lg font-bold text-text">{progress.latestLog ? `${progress.latestLog.weight}kg` : "—"}</p>
                </div>
                <div className="bg-bg rounded-xl p-3 text-center">
                  <p className="text-xs text-muted">Delta</p>
                  <p className={`text-lg font-bold ${progress.delta > 0 ? "text-success" : progress.delta < 0 ? "text-danger" : "text-muted"}`}>
                    {progress.delta > 0 ? "+" : ""}{progress.delta}kg
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Trophy size={16} className="text-warning" />
                <span className="text-muted">All-Time Max:</span>
                <span className="font-bold text-text">{progress.maxWeight ? `${progress.maxWeight.weight}kg` : "—"}</span>
              </div>
              {progress.recentLogs.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-text mb-2 flex items-center gap-1">
                    <TrendingUp size={14} className="text-accent" /> Verlauf
                  </h4>
                  <ul className="space-y-1">
                    {progress.recentLogs.map((log) => (
                      <li key={log.id} className="flex justify-between text-sm border-b border-border-muted py-2">
                        <span className="text-muted">
                          {new Date(log.loggedAt).toLocaleDateString("de-DE", { day: "2-digit", month: "short" })}
                        </span>
                        <span className="text-text">
                          {log.weight}kg{log.reps ? ` × ${log.reps}` : ""}{log.sets > 1 ? ` · ${log.sets}x` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : null
        )}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Add set modal — shows plan exercises if session started from plan
// ---------------------------------------------------------------------------
function AddSetModal({ exercises, onClose, onAdd, onCreateExercise }: {
  exercises: Exercise[]; onClose: () => void;
  onAdd: (data: any) => void; onCreateExercise: (name: string, type?: string) => Promise<Exercise>;
}) {
  const [exerciseId, setExerciseId] = useState("");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [rpe, setRpe] = useState("");
  const [isWarmup, setIsWarmup] = useState(false);
  const [isDropset, setIsDropset] = useState(false);
  const [showNewEx, setShowNewEx] = useState(false);
  const [newExName, setNewExName] = useState("");
  const [newExType, setNewExType] = useState<"machine" | "free-weight" | "bodyweight">("free-weight");
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!exerciseId) { setErr("Übung wählen."); return; }
    onAdd({ exerciseId, weight: weight ? Number(weight) : null, reps: reps ? Number(reps) : null, rpe: rpe ? Number(rpe) : null, isWarmup, isDropset });
  };

  const createEx = async () => {
    if (!newExName.trim()) return;
    setCreating(true);
    try {
      const ex = await onCreateExercise(newExName.trim(), newExType);
      setExerciseId(ex.id); setShowNewEx(false);
    } catch (e: any) { setErr(e?.message || "Übung konnte nicht angelegt werden."); }
    finally { setCreating(false); }
  };

  return (
    <Modal open onClose={onClose} title="Satz hinzufügen"
      footer={<button type="button" onClick={submit} className="w-full bg-accent text-white font-bold py-3 rounded-xl hover:bg-accent-hover">Speichern</button>}>
      <div className="space-y-3">
        {showNewEx ? (
          <div className="space-y-2">
            <label className="text-xs text-muted">Neue Übung</label>
            <input value={newExName} onChange={(e) => setNewExName(e.target.value)} placeholder="z. B. Bankdrücken"
              className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text" />
            <div className="grid grid-cols-3 gap-2">
              {(["free-weight", "machine", "bodyweight"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setNewExType(t)}
                  className={`py-2 rounded-xl text-xs font-bold border ${newExType === t ? "bg-accent border-accent text-white" : "border-border text-muted"}`}>
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowNewEx(false)}
                className="flex-1 bg-bg border border-border text-text py-2.5 rounded-xl text-sm font-semibold">Abbrechen</button>
              <button type="button" onClick={createEx} disabled={creating || !newExName.trim()}
                className="flex-1 bg-accent text-white py-2.5 rounded-xl text-sm font-bold disabled:opacity-50">
                {creating ? "…" : "Anlegen"}</button>
            </div>
          </div>
        ) : (
          <div>
            <label className="text-xs text-muted">Übung</label>
            {exercises.length === 0 ? (
              <p className="text-sm text-muted mt-1">Keine Übungen im Plan. Erstelle eine neue.</p>
            ) : (
              <select value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}
                className="w-full mt-1 bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text">
                <option value="">Wählen…</option>
                {exercises.map((ex) => (<option key={ex.id} value={ex.id}>{ex.name} ({TYPE_LABELS[ex.type]})</option>))}
              </select>
            )}
            <button type="button" onClick={() => setShowNewEx(true)} className="mt-1 text-xs font-semibold text-accent">+ Neue Übung</button>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          <label className="block">
            <span className="text-xs text-muted">kg</span>
            <input type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)}
              className="w-full mt-1 bg-bg border border-border rounded-xl px-2 py-2.5 text-sm text-text" />
          </label>
          <label className="block">
            <span className="text-xs text-muted">Reps</span>
            <input type="number" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)}
              className="w-full mt-1 bg-bg border border-border rounded-xl px-2 py-2.5 text-sm text-text" />
          </label>
          <label className="block">
            <span className="text-xs text-muted">RPE</span>
            <input type="number" inputMode="decimal" value={rpe} onChange={(e) => setRpe(e.target.value)}
              className="w-full mt-1 bg-bg border border-border rounded-xl px-2 py-2.5 text-sm text-text" />
          </label>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setIsWarmup((v) => !v)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold border ${isWarmup ? "bg-accent-soft border-accent text-accent" : "border-border text-muted"}`}>Warmup</button>
          <button type="button" onClick={() => setIsDropset((v) => !v)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold border ${isDropset ? "bg-danger-soft border-danger text-danger" : "border-border text-muted"}`}>Dropset</button>
        </div>
        {err && <p className="text-sm text-danger">{err}</p>}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Plan modal — create or edit a plan with exercises
// ---------------------------------------------------------------------------
function PlanModal({ plan, exercises, onClose, onSaved }: {
  plan: WorkoutPlan | null; exercises: Exercise[]; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(plan?.name || "");
  const [schedule, setSchedule] = useState(plan?.schedule || "");
  const [selectedExercises, setSelectedExercises] = useState<
    Array<{ exerciseId: string; sets?: number; reps?: string; dayLabel?: string }>
  >(plan?.exercises?.map((e) => ({ exerciseId: e.exerciseId, sets: e.sets ?? undefined, reps: e.reps ?? undefined, dayLabel: e.dayLabel })) || []);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggleExercise = (exId: string) => {
    const existing = selectedExercises.find((e) => e.exerciseId === exId);
    if (existing) setSelectedExercises((prev) => prev.filter((e) => e.exerciseId !== exId));
    else setSelectedExercises((prev) => [...prev, { exerciseId: exId, dayLabel: "A" }]);
  };

  const updateField = (exId: string, field: string, value: string) => {
    setSelectedExercises((prev) => prev.map((e) => (e.exerciseId === exId ? { ...e, [field]: value || undefined } : e)));
  };

  const submit = async () => {
    if (!name.trim()) { setErr("Name erforderlich."); return; }
    setSaving(true);
    try {
      const body: any = { name: name.trim(), schedule: schedule.trim() || undefined };
      const exEntries = selectedExercises.map((e, i) => ({
        exerciseId: e.exerciseId, dayLabel: e.dayLabel || "A", orderIndex: i,
        sets: e.sets ? Number(e.sets) : undefined, reps: e.reps || undefined,
      }));
      if (exEntries.length > 0) body.exercises = exEntries;
      if (plan) await updateWorkoutPlan(plan.id, body);
      else await createWorkoutPlan(body);
      onSaved();
    } catch (e: any) { setErr(e?.message || "Plan konnte nicht gespeichert werden."); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={plan ? "Plan bearbeiten" : "Neuer Plan"}
      footer={<button type="button" onClick={submit} disabled={saving || !name.trim()}
        className="w-full bg-accent text-white font-bold py-3 rounded-xl hover:bg-accent-hover disabled:opacity-50">
        {saving ? "…" : "Speichern"}</button>}>
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs text-muted">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Push Day"
            className="w-full mt-1 bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text" />
        </label>
        <label className="block">
          <span className="text-xs text-muted">Schedule (optional)</span>
          <input value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder="z. B. Mo/Mi/Fr"
            className="w-full mt-1 bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text" />
        </label>
        <div>
          <p className="text-xs text-muted mb-2">Übungen ({selectedExercises.length})</p>
          {exercises.length === 0 ? (
            <p className="text-sm text-muted">Keine Übungen vorhanden. Erstelle zuerst Übungen.</p>
          ) : (
            <div className="space-y-2">
              {exercises.map((ex) => {
                const selected = selectedExercises.find((e) => e.exerciseId === ex.id);
                return (
                  <div key={ex.id} className="border border-border rounded-xl p-2">
                    <button type="button" onClick={() => toggleExercise(ex.id)}
                      className="w-full flex items-center justify-between text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-text">{ex.name}</span>
                        <span className={`text-[10px] font-bold ${TYPE_COLORS[ex.type]}`}>{TYPE_LABELS[ex.type]}</span>
                      </div>
                      <span className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                        selected ? "bg-accent border-accent text-white" : "border-border"}`}>
                        {selected && <Check size={12} />}
                      </span>
                    </button>
                    {selected && (
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        <input type="number" placeholder="Sets" value={selected.sets ?? ""}
                          onChange={(e) => updateField(ex.id, "sets", e.target.value)}
                          className="bg-bg border border-border rounded-lg px-2 py-1.5 text-xs text-text" />
                        <input placeholder="Reps" value={selected.reps ?? ""}
                          onChange={(e) => updateField(ex.id, "reps", e.target.value)}
                          className="bg-bg border border-border rounded-lg px-2 py-1.5 text-xs text-text" />
                        <input placeholder="Tag" value={selected.dayLabel ?? "A"}
                          onChange={(e) => updateField(ex.id, "dayLabel", e.target.value)}
                          className="bg-bg border border-border rounded-lg px-2 py-1.5 text-xs text-text" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {err && <p className="text-sm text-danger">{err}</p>}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Plan view modal — read-only view with edit/delete
// ---------------------------------------------------------------------------
function PlanViewModal({ plan, exercises, onClose, onEdit, onDelete }: {
  plan: WorkoutPlan; exercises: Exercise[]; onClose: () => void; onEdit: (plan: WorkoutPlan) => void; onDelete: () => void;
}) {
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  return (
    <Modal open onClose={onClose} title={plan.name}
      footer={
        <div className="flex gap-2">
          <button type="button" onClick={onDelete}
            className="flex-1 bg-danger-soft border border-danger text-danger font-semibold py-2.5 rounded-xl text-sm">Löschen</button>
          <button type="button" onClick={() => onEdit(plan)}
            className="flex-[2] bg-accent text-white font-bold py-2.5 rounded-xl text-sm">Bearbeiten</button>
        </div>
      }>
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <span className={plan.isActive ? "text-success font-bold" : "text-muted"}>{plan.isActive ? "Aktiv" : "Inaktiv"}</span>
          {plan.schedule && <span className="text-muted">· {plan.schedule}</span>}
        </div>
        {(plan.exercises ?? []).length === 0 ? (
          <p className="text-sm text-muted">Keine Übungen in diesem Plan.</p>
        ) : (
          <ul className="space-y-2">
            {(plan.exercises || []).map((pe) => {
              const ex = exMap.get(pe.exerciseId);
              return (
                <li key={pe.id} className="flex items-center justify-between border-b border-border-muted py-2">
                  <div>
                    <span className="text-sm font-semibold text-text">{ex?.name || "Unbekannt"}</span>
                    {ex && <span className={`ml-2 text-[10px] font-bold ${TYPE_COLORS[ex.type]}`}>{TYPE_LABELS[ex.type]}</span>}
                  </div>
                  <span className="text-xs text-muted">
                    {pe.sets ? `${pe.sets}×` : ""} {pe.reps || ""} {pe.dayLabel ? `· ${pe.dayLabel}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Schedule edit modal
// ---------------------------------------------------------------------------
function ScheduleEditModal({ plans, currentWeek, onClose, onSave }: {
  plans: WorkoutPlan[]; currentWeek: ScheduleWeekDay[]; onClose: () => void;
  onSave: (entries: Array<{ dayOfWeek: number; planId?: string; label: string }>) => Promise<void>;
}) {
  const [entries, setEntries] = useState(() => {
    const result: Array<{ dayOfWeek: number; planId: string; label: string }> = [];
    for (let i = 0; i < 7; i++) {
      const dow = i;
      const weekDay = currentWeek.find((d) => d.dayOfWeek === dow);
      result.push({ dayOfWeek: dow, planId: weekDay?.planId || "", label: weekDay?.label || "Rest Day" });
    }
    return result;
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const updateEntry = (dow: number, field: string, value: string) => {
    setEntries((prev) => prev.map((e) => {
      if (e.dayOfWeek !== dow) return e;
      if (field === "planId") {
        const plan = plans.find((p) => p.id === value);
        return { ...e, planId: value, label: plan ? plan.name : "Rest Day" };
      }
      return { ...e, [field]: value };
    }));
  };

  const submit = async () => {
    setSaving(true);
    try {
      await onSave(entries.map((e) => ({ dayOfWeek: e.dayOfWeek, planId: e.planId || undefined, label: e.label })));
    } catch (e: any) { setErr(e?.message || "Schedule konnte nicht gespeichert werden."); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title="Wochenplan bearbeiten"
      footer={<button type="button" onClick={submit} disabled={saving}
        className="w-full bg-accent text-white font-bold py-3 rounded-xl hover:bg-accent-hover disabled:opacity-50">
        {saving ? "…" : "Speichern"}</button>}>
      <div className="space-y-3">
        {entries.map((entry) => (
          <div key={entry.dayOfWeek} className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text w-10">{DAY_NAMES[entry.dayOfWeek]}</span>
            <select value={entry.planId} onChange={(e) => updateEntry(entry.dayOfWeek, "planId", e.target.value)}
              className="flex-1 bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text">
              <option value="">Rest Day</option>
              {plans.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
            </select>
            <input value={entry.label} onChange={(e) => updateEntry(entry.dayOfWeek, "label", e.target.value)}
              placeholder="Label" className="w-24 bg-bg border border-border rounded-xl px-2 py-2 text-xs text-text" />
          </div>
        ))}
        {err && <p className="text-sm text-danger">{err}</p>}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Override modal
// ---------------------------------------------------------------------------
function OverrideModal({ onClose, onOverride, onRevert, isOverride, currentLabel }: {
  onClose: () => void; onOverride: (label: string, planId?: string) => Promise<void>;
  onRevert: () => Promise<void>; isOverride: boolean; currentLabel: string;
}) {
  const [label, setLabel] = useState("Rest Day");
  const [planId, setPlanId] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try { await onOverride(label, planId || undefined); } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title="Heute überschreiben"
      footer={
        <div className="flex gap-2">
          {isOverride && <button type="button" onClick={onRevert}
            className="flex-1 bg-bg border border-border text-text py-2.5 rounded-xl text-sm font-semibold">Zurücksetzen</button>}
          <button type="button" onClick={submit} disabled={saving}
            className="flex-[2] bg-accent text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50">
            {saving ? "…" : "Überschreiben"}</button>
        </div>
      }>
      <div className="space-y-3">
        <p className="text-sm text-muted">Aktuell: <span className="font-semibold text-text">{currentLabel}</span></p>
        <label className="block">
          <span className="text-xs text-muted">Neue Bezeichnung</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="z. B. Rest Day"
            className="w-full mt-1 bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text" />
        </label>
        <label className="block">
          <span className="text-xs text-muted">Plan (optional)</span>
          <select value={planId} onChange={(e) => setPlanId(e.target.value)}
            className="w-full mt-1 bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text">
            <option value="">Kein Plan</option>
          </select>
        </label>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// History modal — weight progression for one exercise
// ---------------------------------------------------------------------------
function HistoryModal({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getExerciseHistory(exercise.id).then((r) => setHistory(r.history || [])).catch((e) => setErr(e?.message || "History konnte nicht geladen werden.")).finally(() => setLoading(false));
  }, [exercise.id]);

  return (
    <Modal open onClose={onClose} title={`${exercise.name} — Verlauf`}>
      {loading ? <Loading /> : err ? <ErrorState message={err} /> : history.length === 0 ? (
        <p className="text-sm text-muted">Noch keine Sätze geloggt.</p>
      ) : (
        <ul className="space-y-2">
          {history.map((h, i) => (
            <li key={i} className="flex justify-between text-sm border-b border-border-muted py-2">
              <span className="text-muted">{new Date(h.loggedAt || h.startedAt || h.createdAt).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })}</span>
              <span className="text-text">{h.weight ? `${h.weight}kg` : ""} {h.reps ? `× ${h.reps}` : ""}</span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}