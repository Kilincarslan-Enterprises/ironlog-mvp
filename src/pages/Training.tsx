import { useCallback, useEffect, useState } from "react";
import {
  Plus, Play, Check, Flame, Trophy, History, ChevronRight, Trash2,
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
  getPersonalRecords,
  getExerciseHistory,
  createExercise,
  getScheduleToday,
  getScheduleWeek,
  setSchedule,
  overrideSchedule,
  deleteScheduleOverride,
  getMachines,
  createMachine,
  logMachineWeight,
  getMachineProgress,
  deleteMachine,
  type Exercise,
  type WorkoutPlan,
  type WorkoutSession,
  type WorkoutSet,
  type ScheduleToday,
  type ScheduleWeekDay,
  type Machine,
  type MachineProgress,
} from "../lib/api";

const DAY_NAMES = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const DAY_NAMES_FULL = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

export default function Training() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [scheduleToday, setScheduleToday] = useState<ScheduleToday | null>(null);
  const [scheduleWeek, setScheduleWeek] = useState<ScheduleWeekDay[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addSetOpen, setAddSetOpen] = useState(false);
  const [historyEx, setHistoryEx] = useState<Exercise | null>(null);
  const [machineModal, setMachineModal] = useState<Machine | null>(null);
  const [addMachineOpen, setAddMachineOpen] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [planModal, setPlanModal] = useState<WorkoutPlan | "new" | null>(null);
  const [planView, setPlanView] = useState<WorkoutPlan | null>(null);
  const [scheduleEditOpen, setScheduleEditOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ex, pl, se, pr, st, sw, mc] = await Promise.all([
        getExercises(),
        getWorkoutPlans(),
        getWorkoutSessions(),
        getPersonalRecords(),
        getScheduleToday(),
        getScheduleWeek(),
        getMachines(),
      ]);
      setExercises(ex.exercises);
      setPlans(pl.plans);
      setSessions(se.sessions);
      setRecords(pr.records || []);
      setScheduleToday(st);
      setScheduleWeek(sw.days || []);
      setMachines(mc.machines || []);
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
        name: plan?.name || scheduleToday?.label || "Workout",
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

  const createExerciseLocal = useCallback(async (name: string) => {
    const r = await createExercise({ name, category: "strength" });
    setExercises((prev) => [...prev, r.exercise]);
    return r.exercise;
  }, []);

  const onMachineCreated = useCallback(async (name: string, muscleGroup?: string) => {
    const r = await createMachine({ name, muscleGroup });
    setMachines((prev) => [...prev, r.machine]);
    return r.machine;
  }, []);

  const onMachineWeightLogged = useCallback(async (machineId: string, weight: number, reps?: number) => {
    await logMachineWeight(machineId, { weight, reps });
  }, []);

  const onDeletePlan = async (id: string) => {
    try {
      await deleteWorkoutPlan(id);
      setPlans((prev) => prev.filter((p) => p.id !== id));
      setPlanView(null);
    } catch (e: any) {
      setError(e?.message || "Plan konnte nicht gelöscht werden.");
    }
  };

  const onDeleteExercise = async (id: string) => {
    try {
      await deleteExercise(id);
      setExercises((prev) => prev.filter((e) => e.id !== id));
    } catch (e: any) {
      setError(e?.message || "Übung konnte nicht gelöscht werden.");
    }
  };

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

      {/* Today's schedule */}
      {scheduleToday && (
        <Card
          title="Heute"
          subtitle={DAY_NAMES_FULL[scheduleToday.dayOfWeek]}
          action={
            scheduleToday.isOverride ? (
              <button
                type="button"
                onClick={() => setOverrideOpen(true)}
                className="text-xs font-semibold text-warning"
              >
                ⚠ Überschrieben
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setOverrideOpen(true)}
                className="text-xs font-semibold text-muted hover:text-accent"
              >
                Verschieben
              </button>
            )
          }
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
              <button
                type="button"
                onClick={() => startSession(scheduleToday.plan || undefined)}
                className="bg-accent text-white font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-accent-hover"
              >
                <Play size={16} /> Start
              </button>
            )}
          </div>
        </Card>
      )}

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
        !scheduleToday && (
          <Card title="Heute" subtitle="Noch kein Training">
            <button
              type="button"
              onClick={() => startSession(plans.find((p) => p.isActive))}
              className="w-full bg-accent text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-accent-hover"
            >
              <Play size={18} /> Session starten
            </button>
          </Card>
        )
      )}

      {/* Weekly schedule */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-lg font-bold text-text-strong flex items-center gap-2">
            <Calendar size={18} className="text-accent" /> Diese Woche
          </h2>
          <button
            type="button"
            onClick={() => setScheduleEditOpen(true)}
            className="text-sm font-semibold text-accent hover:text-accent-hover flex items-center gap-1"
          >
            <Edit3 size={14} /> Bearbeiten
          </button>
        </div>
        {scheduleWeek.length > 0 ? (
          <div className="grid grid-cols-7 gap-1.5">
            {scheduleWeek.map((day, i) => (
              <div
                key={i}
                className={`rounded-xl border p-2 text-center ${
                  day.isOverride
                    ? "border-warning bg-warning/5"
                    : day.label === "Rest Day" || !day.label
                      ? "border-border-muted bg-bg"
                      : "border-border bg-card"
                }`}
              >
                <p className="text-xs text-muted">{DAY_NAMES[day.dayOfWeek]}</p>
                <p className="text-xs font-semibold text-text mt-1 truncate">
                  {day.label === "Rest Day" || !day.label ? "Rest" : day.label.split(" ")[0]}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="Kein Schedule" hint="Tippe auf Bearbeiten um deine Woche zu planen." />
        )}
      </section>

      {/* Machines gallery */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-lg font-bold text-text-strong flex items-center gap-2">
            <Dumbbell size={18} className="text-accent" /> Geräte
          </h2>
          <button
            type="button"
            onClick={() => setAddMachineOpen(true)}
            className="text-sm font-semibold text-accent hover:text-accent-hover flex items-center gap-1"
          >
            <Plus size={16} /> Hinzufügen
          </button>
        </div>
        {machines.length === 0 ? (
          <EmptyState title="Keine Geräte" hint="Füge Maschinen hinzu, um Gewichte zu loggen." />
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            {machines.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMachineModal(m)}
                className="bg-card border border-border rounded-2xl overflow-hidden hover:bg-card-hover transition-colors text-left"
              >
                <div className="aspect-square bg-bg flex items-center justify-center overflow-hidden">
                  {m.imageUrl ? (
                    <img src={m.imageUrl} alt={m.name} className="w-full h-full object-cover" />
                  ) : (
                    <Dumbbell size={28} className="text-muted" />
                  )}
                </div>
                <div className="p-2">
                  <p className="text-xs font-semibold text-text truncate">{m.name}</p>
                  {m.muscleGroup && (
                    <p className="text-[10px] text-muted truncate">{m.muscleGroup}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Workout plans — now with create/edit/view/delete */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-lg font-bold text-text-strong">Pläne</h2>
          <button
            type="button"
            onClick={() => setPlanModal("new")}
            className="text-sm font-semibold text-accent hover:text-accent-hover flex items-center gap-1"
          >
            <Plus size={16} /> Neuer Plan
          </button>
        </div>
        {plans.length === 0 ? (
          <EmptyState title="Keine Pläne" hint="Erstelle einen Trainingsplan." />
        ) : (
          plans.map((p) => (
            <Card
              key={p.id}
              title={p.name}
              subtitle={p.isActive ? "Aktiv" : "Inaktiv"}
              action={
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPlanView(p)}
                    className="text-muted hover:text-accent"
                    aria-label="Ansehen"
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlanModal(p)}
                    className="text-muted hover:text-accent"
                    aria-label="Bearbeiten"
                  >
                    <Edit3 size={16} />
                  </button>
                  {p.isActive ? (
                    <span className="text-success text-xs font-bold">AKTIV</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onActivate(p.id)}
                      className="text-sm font-semibold text-accent hover:text-accent-hover"
                    >
                      Aktivieren
                    </button>
                  )}
                </div>
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
        <div className="flex items-center justify-between px-1">
          <h2 className="text-lg font-bold text-text-strong flex items-center gap-2">
            <History size={18} className="text-accent" /> Übungen
          </h2>
        </div>
        {exercises.length === 0 ? (
          <EmptyState title="Keine Übungen" hint="Übungen werden erstellt, wenn du Sätze loggst." />
        ) : (
          exercises.map((ex) => (
            <div
              key={ex.id}
              className="w-full bg-card border border-border rounded-2xl p-3 flex items-center justify-between hover:bg-card-hover"
            >
              <button
                type="button"
                onClick={() => setHistoryEx(ex)}
                className="flex items-center gap-2 flex-1"
              >
                <span className="text-sm font-semibold text-text">{ex.name}</span>
                <ChevronRight size={18} className="text-muted" />
              </button>
              <button
                type="button"
                onClick={() => onDeleteExercise(ex.id)}
                className="text-muted hover:text-danger ml-2"
                aria-label="Übung löschen"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </section>

      {/* Modals */}
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
      {machineModal && (
        <MachineModal
          machine={machineModal}
          onClose={() => setMachineModal(null)}
          onLogWeight={onMachineWeightLogged}
          onDelete={async () => {
            await deleteMachine(machineModal.id);
            setMachines((prev) => prev.filter((m) => m.id !== machineModal.id));
            setMachineModal(null);
          }}
        />
      )}
      {addMachineOpen && (
        <AddMachineModal
          onClose={() => setAddMachineOpen(false)}
          onCreate={onMachineCreated}
        />
      )}
      {overrideOpen && scheduleToday && (
        <OverrideModal
          onClose={() => setOverrideOpen(false)}
          onOverride={async (label, planId) => {
            const today = new Date().toISOString().slice(0, 10);
            await overrideSchedule({ date: today, label, planId });
            setOverrideOpen(false);
            load();
          }}
          onRevert={async () => {
            const today = new Date().toISOString().slice(0, 10);
            await deleteScheduleOverride(today);
            setOverrideOpen(false);
            load();
          }}
          isOverride={scheduleToday.isOverride}
          currentLabel={scheduleToday.label}
          plans={plans}
        />
      )}
      {planModal && (
        <PlanModal
          plan={planModal === "new" ? null : planModal}
          exercises={exercises}
          onClose={() => setPlanModal(null)}
          onSaved={() => {
            setPlanModal(null);
            load();
          }}
        />
      )}
      {planView && (
        <PlanViewModal
          plan={planView}
          exercises={exercises}
          onClose={() => setPlanView(null)}
          onEdit={() => {
            setPlanModal(planView);
            setPlanView(null);
          }}
          onDelete={() => onDeletePlan(planView.id)}
        />
      )}
      {scheduleEditOpen && (
        <ScheduleEditModal
          onClose={() => setScheduleEditOpen(false)}
          plans={plans}
          currentWeek={scheduleWeek}
          onSave={async (entries) => {
            await setSchedule(entries);
            setScheduleEditOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Active session card
// ---------------------------------------------------------------------------

function ActiveSessionCard({
  session, exercises, onAddSet, onFinish, onRemoveSet, onShowHistory,
}: {
  session: WorkoutSession; exercises: Exercise[];
  onAddSet: () => void; onFinish: () => void;
  onRemoveSet: (setId: string) => void; onShowHistory: (ex: Exercise) => void;
}) {
  const startedAt = new Date(session.startedAt);
  const mins = session.endedAt
    ? Math.round((new Date(session.endedAt).getTime() - startedAt.getTime()) / 60000)
    : Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 60000));

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
        <button type="button" onClick={onFinish}
          className="bg-success text-white text-sm font-bold px-3 py-1.5 rounded-lg flex items-center gap-1">
          <Check size={14} /> Fertig
        </button>
      }
    >
      <div className="space-y-3">
        {byExercise.size === 0 ? (
          <p className="text-sm text-muted">Noch keine Sätze. Tippe „Satz hinzufügen".</p>
        ) : (
          [...byExercise.entries()].map(([exId, sets]) => {
            const ex = exMap.get(exId);
            return (
              <div key={exId} className="border-t border-border-muted pt-2 first:border-0 first:pt-0">
                <button type="button" onClick={() => ex && onShowHistory(ex)}
                  className="font-semibold text-sm text-text-strong">
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
                      <button type="button" onClick={() => onRemoveSet(s.id)}
                        aria-label="Satz löschen" className="text-muted hover:text-danger">
                        <Trash2 size={14} />
                      </button>
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
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Plan modal — create or edit a plan with exercises
// ---------------------------------------------------------------------------

function PlanModal({
  plan, exercises, onClose, onSaved,
}: {
  plan: WorkoutPlan | null;
  exercises: Exercise[];
  onClose: () => void;
  onSaved: () => void;
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
    if (existing) {
      setSelectedExercises((prev) => prev.filter((e) => e.exerciseId !== exId));
    } else {
      setSelectedExercises((prev) => [...prev, { exerciseId: exId, dayLabel: "A" }]);
    }
  };

  const updateField = (exId: string, field: string, value: string) => {
    setSelectedExercises((prev) =>
      prev.map((e) => (e.exerciseId === exId ? { ...e, [field]: value || undefined } : e)),
    );
  };

  const submit = async () => {
    if (!name.trim()) {
      setErr("Name erforderlich.");
      return;
    }
    setSaving(true);
    try {
      const body: any = { name: name.trim(), schedule: schedule.trim() || undefined };
      const exEntries = selectedExercises.map((e, i) => ({
        exerciseId: e.exerciseId,
        dayLabel: e.dayLabel || "A",
        orderIndex: i,
        sets: e.sets ? Number(e.sets) : undefined,
        reps: e.reps || undefined,
      }));
      if (exEntries.length > 0) body.exercises = exEntries;

      if (plan) {
        await updateWorkoutPlan(plan.id, body);
      } else {
        await createWorkoutPlan(body);
      }
      onSaved();
    } catch (e: any) {
      setErr(e?.message || "Plan konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={plan ? "Plan bearbeiten" : "Neuer Plan"}
      footer={
        <button type="button" onClick={submit} disabled={saving || !name.trim()}
          className="w-full bg-accent text-white font-bold py-3 rounded-xl hover:bg-accent-hover disabled:opacity-50">
          {saving ? "…" : "Speichern"}
        </button>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs text-muted">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)}
            placeholder="z. B. Push Day"
            className="w-full mt-1 bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text" />
        </label>
        <label className="block">
          <span className="text-xs text-muted">Schedule (optional)</span>
          <input value={schedule} onChange={(e) => setSchedule(e.target.value)}
            placeholder="z. B. Mo/Mi/Fr"
            className="w-full mt-1 bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text" />
        </label>

        <div>
          <p className="text-xs text-muted mb-2">Übungen ({selectedExercises.length})</p>
          {exercises.length === 0 ? (
            <p className="text-sm text-muted">Keine Übungen vorhanden. Erstelle Übungen über eine Session.</p>
          ) : (
            <div className="space-y-2">
              {exercises.map((ex) => {
                const selected = selectedExercises.find((e) => e.exerciseId === ex.id);
                return (
                  <div key={ex.id} className="border border-border rounded-xl p-2">
                    <button type="button" onClick={() => toggleExercise(ex.id)}
                      className="w-full flex items-center justify-between text-left">
                      <span className="text-sm font-semibold text-text">{ex.name}</span>
                      <span className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                        selected ? "bg-accent border-accent text-white" : "border-border"
                      }`}>
                        {selected && <Check size={12} />}
                      </span>
                    </button>
                    {selected && (
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        <input type="number" placeholder="Sets"
                          value={selected.sets ?? ""}
                          onChange={(e) => updateField(ex.id, "sets", e.target.value)}
                          className="bg-bg border border-border rounded-lg px-2 py-1.5 text-xs text-text" />
                        <input placeholder="Reps"
                          value={selected.reps ?? ""}
                          onChange={(e) => updateField(ex.id, "reps", e.target.value)}
                          className="bg-bg border border-border rounded-lg px-2 py-1.5 text-xs text-text" />
                        <input placeholder="Tag"
                          value={selected.dayLabel ?? "A"}
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
// Plan view modal — read-only view of a plan with delete/edit actions
// ---------------------------------------------------------------------------

function PlanViewModal({
  plan, exercises, onClose, onEdit, onDelete,
}: {
  plan: WorkoutPlan; exercises: Exercise[];
  onClose: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  return (
    <Modal open onClose={onClose} title={plan.name}
      footer={
        <div className="flex gap-2">
          <button type="button" onClick={onDelete}
            className="flex-1 bg-danger-soft border border-danger text-danger font-semibold py-2.5 rounded-xl text-sm">
            Löschen
          </button>
          <button type="button" onClick={onEdit}
            className="flex-[2] bg-accent text-white font-bold py-2.5 rounded-xl text-sm">
            Bearbeiten
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center gap-3 text-sm">
          <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${plan.isActive ? "bg-success-soft text-success" : "bg-bg text-muted"}`}>
            {plan.isActive ? "AKTIV" : "INAKTIV"}
          </span>
          {plan.schedule && <span className="text-muted">{plan.schedule}</span>}
        </div>
        {plan.exercises.length === 0 ? (
          <p className="text-sm text-muted">Keine Übungen in diesem Plan.</p>
        ) : (
          <ul className="space-y-2">
            {plan.exercises.map((pe) => {
              const ex = exMap.get(pe.exerciseId);
              return (
                <li key={pe.id} className="flex items-center justify-between border-b border-border-muted py-2">
                  <div>
                    <p className="text-sm font-semibold text-text">{ex?.name || "Unbekannt"}</p>
                    <p className="text-xs text-muted">
                      Tag {pe.dayLabel}
                      {pe.sets ? ` · ${pe.sets} Sets` : ""}
                      {pe.reps ? ` · ${pe.reps} Reps` : ""}
                      {pe.restSeconds ? ` · ${pe.restSeconds}s Pause` : ""}
                    </p>
                  </div>
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
// Schedule edit modal — assign plans to weekdays
// ---------------------------------------------------------------------------

function ScheduleEditModal({
  onClose, plans, currentWeek, onSave,
}: {
  onClose: () => void;
  plans: WorkoutPlan[];
  currentWeek: ScheduleWeekDay[];
  onSave: (entries: Array<{ dayOfWeek: number; planId?: string; label: string }>) => Promise<void>;
}) {
  const [entries, setEntries] = useState<Array<{ dayOfWeek: number; planId: string; label: string }>>(() => {
    const result: Array<{ dayOfWeek: number; planId: string; label: string }> = [];
    for (let i = 0; i < 7; i++) {
      const dow = i;
      const weekDay = currentWeek.find((d: ScheduleWeekDay) => d.dayOfWeek === dow);
      result.push({
        dayOfWeek: dow,
        planId: weekDay?.planId || "",
        label: weekDay?.label || "Rest Day",
      });
    }
    return result;
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const updateEntry = (dow: number, field: "planId" | "label", value: string) => {
    setEntries((prev) =>
      prev.map((e) => {
        if (e.dayOfWeek !== dow) return e;
        if (field === "planId") {
          const plan = plans.find((p) => p.id === value);
          return { ...e, planId: value, label: plan ? plan.name : "Rest Day" };
        }
        return { ...e, [field]: value };
      }),
    );
  };

  const submit = async () => {
    setSaving(true);
    try {
      await onSave(entries.map((e) => ({
        dayOfWeek: e.dayOfWeek,
        planId: e.planId || undefined,
        label: e.label,
      })));
    } catch (e: any) {
      setErr(e?.message || "Schedule konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Wochenplan bearbeiten"
      footer={
        <button type="button" onClick={submit} disabled={saving}
          className="w-full bg-accent text-white font-bold py-3 rounded-xl hover:bg-accent-hover disabled:opacity-50">
          {saving ? "…" : "Speichern"}
        </button>
      }
    >
      <div className="space-y-3">
        {entries.map((entry) => (
          <div key={entry.dayOfWeek} className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text w-10">{DAY_NAMES[entry.dayOfWeek]}</span>
            <select
              value={entry.planId}
              onChange={(e) => updateEntry(entry.dayOfWeek, "planId", e.target.value)}
              className="flex-1 bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text"
            >
              <option value="">Rest Day</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <input
              value={entry.label}
              onChange={(e) => updateEntry(entry.dayOfWeek, "label", e.target.value)}
              placeholder="Label"
              className="w-24 bg-bg border border-border rounded-xl px-2 py-2 text-xs text-text"
            />
          </div>
        ))}
        {err && <p className="text-sm text-danger">{err}</p>}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Machine modal
// ---------------------------------------------------------------------------

function MachineModal({
  machine, onClose, onLogWeight, onDelete,
}: {
  machine: Machine; onClose: () => void;
  onLogWeight: (machineId: string, weight: number, reps?: number) => Promise<void>;
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
      const p = await getMachineProgress(machine.id);
      setProgress(p);
    } catch (e: any) {
      setError(e?.message || "Fortschritt konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [machine.id]);

  useEffect(() => { loadProgress(); }, [loadProgress]);

  const submit = async () => {
    if (!weight) return;
    setLogging(true);
    try {
      await onLogWeight(machine.id, Number(weight), reps ? Number(reps) : undefined);
      setWeight(""); setReps("");
      await loadProgress();
    } catch (e: any) {
      setError(e?.message || "Log fehlgeschlagen.");
    } finally {
      setLogging(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={machine.name}
      footer={
        <div className="flex gap-2">
          <button type="button" onClick={onDelete}
            className="flex-1 bg-danger-soft border border-danger text-danger font-semibold py-2.5 rounded-xl text-sm">
            Löschen
          </button>
          <button type="button" onClick={submit} disabled={logging || !weight}
            className="flex-[2] bg-accent text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50">
            {logging ? "…" : "Speichern"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {machine.muscleGroup && <p className="text-sm text-muted">Muskelgruppe: {machine.muscleGroup}</p>}
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs text-muted">kg</span>
            <input type="number" inputMode="decimal" value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder={progress?.latestLog ? String(progress.latestLog.weight) : "0"}
              className="w-full mt-1 bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text" />
          </label>
          <label className="block">
            <span className="text-xs text-muted">Reps</span>
            <input type="number" inputMode="numeric" value={reps}
              onChange={(e) => setReps(e.target.value)}
              className="w-full mt-1 bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text" />
          </label>
        </div>
        {loading ? <Loading /> : error ? <ErrorState message={error} /> : progress ? (
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
              <span className="font-bold text-text">{progress.maxWeight}kg</span>
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
        ) : null}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Add machine modal
// ---------------------------------------------------------------------------

function AddMachineModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, muscleGroup?: string) => Promise<Machine> }) {
  const [name, setName] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await onCreate(name.trim(), muscleGroup.trim() || undefined);
      onClose();
    } catch (e: any) {
      setErr(e?.message || "Gerät konnte nicht angelegt werden.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Gerät hinzufügen"
      footer={
        <button type="button" onClick={submit} disabled={creating || !name.trim()}
          className="w-full bg-accent text-white font-bold py-3 rounded-xl hover:bg-accent-hover disabled:opacity-50">
          {creating ? "…" : "Anlegen"}
        </button>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className="text-xs text-muted">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Butterfly"
            className="w-full mt-1 bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text" />
        </label>
        <label className="block">
          <span className="text-xs text-muted">Muskelgruppe</span>
          <input value={muscleGroup} onChange={(e) => setMuscleGroup(e.target.value)} placeholder="z. B. Brust"
            className="w-full mt-1 bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text" />
        </label>
        <label className="block">
          <span className="text-xs text-muted">Bild URL (optional)</span>
          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…"
            className="w-full mt-1 bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text" />
        </label>
        {err && <p className="text-sm text-danger">{err}</p>}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Override modal
// ---------------------------------------------------------------------------

function OverrideModal({ onClose, onOverride, onRevert, isOverride, currentLabel, plans }: {
  onClose: () => void;
  onOverride: (label: string, planId?: string) => Promise<void>;
  onRevert: () => Promise<void>;
  isOverride: boolean; currentLabel: string; plans: WorkoutPlan[];
}) {
  const [label, setLabel] = useState("Rest Day");
  const [planId, setPlanId] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try { await onOverride(label, planId || undefined); } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title="Heute verschieben"
      footer={
        <div className="flex gap-2">
          {isOverride && (
            <button type="button" onClick={onRevert}
              className="flex-1 bg-bg border border-border text-text py-2.5 rounded-xl text-sm font-semibold">
              Zurücksetzen
            </button>
          )}
          <button type="button" onClick={submit} disabled={saving}
            className="flex-[2] bg-accent text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50">
            {saving ? "…" : "Überschreiben"}
          </button>
        </div>
      }
    >
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
            <option value="">Kein Plan (Rest Day)</option>
            {plans.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
        </label>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Add set modal
// ---------------------------------------------------------------------------

function AddSetModal({ exercises, onClose, onAdd, onCreateExercise }: {
  exercises: Exercise[]; onClose: () => void; onAdd: (data: any) => void;
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
    if (!exerciseId) { setErr("Übung wählen."); return; }
    onAdd({ exerciseId, weight: weight ? Number(weight) : null, reps: reps ? Number(reps) : null, rpe: rpe ? Number(rpe) : null, isWarmup, isDropset });
  };

  const createEx = async () => {
    if (!newExName.trim()) return;
    setCreating(true);
    try {
      const ex = await onCreateExercise(newExName.trim());
      setExerciseId(ex.id); setShowNewEx(false);
    } catch (e: any) { setErr(e?.message || "Übung konnte nicht angelegt werden."); }
    finally { setCreating(false); }
  };

  return (
    <Modal open onClose={onClose} title="Satz hinzufügen"
      footer={
        <button type="button" onClick={submit}
          className="w-full bg-accent text-white font-bold py-3 rounded-xl hover:bg-accent-hover">Speichern</button>
      }
    >
      <div className="space-y-3">
        {showNewEx ? (
          <div className="space-y-2">
            <label className="text-xs text-muted">Neue Übung</label>
            <input value={newExName} onChange={(e) => setNewExName(e.target.value)} placeholder="z. B. Bankdrücken"
              className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text" />
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowNewEx(false)}
                className="flex-1 bg-bg border border-border text-text py-2.5 rounded-xl text-sm font-semibold">Abbrechen</button>
              <button type="button" onClick={createEx} disabled={creating || !newExName.trim()}
                className="flex-1 bg-accent text-white py-2.5 rounded-xl text-sm font-bold disabled:opacity-50">
                {creating ? "…" : "Anlegen"}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <label className="text-xs text-muted">Übung</label>
            <select value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}
              className="w-full mt-1 bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text">
              <option value="">Wählen…</option>
              {exercises.map((ex) => (<option key={ex.id} value={ex.id}>{ex.name}</option>))}
            </select>
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
// History modal
// ---------------------------------------------------------------------------

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
      {loading ? <Loading /> : err ? <ErrorState message={err} /> : history.length === 0 ? (
        <EmptyState title="Noch keine Sätze" hint="Logge diese Übung in einem Workout." />
      ) : (
        <ul className="space-y-1">
          {history.map((s) => (
            <li key={s.id} className="flex justify-between text-sm border-b border-border-muted py-2">
              <span className="text-muted">
                {new Date((s as any).sessionStartedAt || s.setNumber).toLocaleDateString("de-DE")}
              </span>
              <span className="text-text">
                {s.weight ?? "-"}kg × {s.reps ?? "-"}{s.rpe ? ` · RPE ${s.rpe}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}