import { useCallback, useEffect, useState } from "react";
import { Plus, Check, Undo2 } from "lucide-react";
import { Card } from "../components/Card";
import { Modal } from "../components/Modal";
import { Loading, ErrorState, EmptyState } from "../components/States";
import {
  getSupplements,
  createSupplement,
  getSupplementLogs,
  createSupplementLog,
  deleteSupplementLog,
  type Supplement,
  type SupplementLog,
} from "../lib/api";

export default function Supplements() {
  const [supps, setSupps] = useState<Supplement[]>([]);
  const [logs, setLogs] = useState<SupplementLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null); // supplementId being toggled

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, l] = await Promise.all([getSupplements(), getSupplementLogs()]);
      setSupps(s.supplements);
      setLogs(l.logs);
    } catch (e: any) {
      setError(e?.message || "Supplements konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const logsFor = (suppId: string) => logs.filter((l) => l.supplementId === suppId);

  const toggle = async (supp: Supplement) => {
    const todayLogs = logsFor(supp.id);
    setBusy(supp.id);
    try {
      if (todayLogs.length === 0) {
        // No intake yet → log one
        const r = await createSupplementLog({ supplementId: supp.id });
        setLogs((prev) => [...prev, r.log]);
      } else {
        // Already taken → undo the latest log
        const latest = todayLogs.sort(
          (a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime(),
        )[0];
        await deleteSupplementLog(latest.id);
        setLogs((prev) => prev.filter((l) => l.id !== latest.id));
      }
    } catch (e: any) {
      setError(e?.message || "Aktion fehlgeschlagen.");
    } finally {
      setBusy(null);
    }
  };

  const onCreated = async () => {
    setAddOpen(false);
    await load();
  };

  return (
    <div className="p-4 space-y-5">
      <h1 className="text-xl font-bold text-text-strong">Supplements</h1>

      {loading && supps.length === 0 ? (
        <Loading label="Supplements laden…" />
      ) : error && supps.length === 0 ? (
        <ErrorState message={error} onRetry={load} />
      ) : supps.length === 0 ? (
        <EmptyState
          title="Keine Supplements"
          hint="Füge Supplements hinzu, die du täglich einnimmst."
        />
      ) : (
        <div className="space-y-3">
          {supps.map((s) => {
            const todayLogs = logsFor(s.id);
            const taken = todayLogs.length > 0;
            const full = todayLogs.length >= s.dailyFrequency;
            return (
              <Card key={s.id}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-text-strong truncate">{s.name}</div>
                    <div className="text-xs text-muted mt-0.5">
                      {s.unitDose ? `${s.unitDose} ${s.doseUnit || ""}` : ""}
                      {s.dailyFrequency > 1 ? ` · ${s.dailyFrequency}×/Tag` : " · 1×/Tag"}
                      {" · "}
                      {todayLogs.length}/{s.dailyFrequency} heute
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {taken && (
                      <button
                        type="button"
                        onClick={() => toggle(s)}
                        aria-label="Rückgängig"
                        className="text-muted hover:text-danger p-2"
                      >
                        <Undo2 size={18} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => toggle(s)}
                      disabled={busy === s.id || full}
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90 ${
                        full
                          ? "bg-success text-white"
                          : taken
                            ? "bg-success-soft text-success border border-success"
                            : "bg-bg border border-border text-muted hover:text-text"
                      }`}
                      aria-label={taken ? "Eingenommen" : "Einnehmen"}
                    >
                      {busy === s.id ? (
                        <span className="text-xs">…</span>
                      ) : (
                        <Check size={20} className={full ? "" : ""} />
                      )}
                    </button>
                  </div>
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
        aria-label="Supplement hinzufügen"
      >
        <Plus size={28} />
      </button>

      {addOpen && <AddSupplementModal onClose={() => setAddOpen(false)} onCreated={onCreated} />}
    </div>
  );
}

function AddSupplementModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    form: "pill",
    unitDose: "",
    doseUnit: "mg",
    dailyFrequency: "1",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.name.trim()) {
      setErr("Name erforderlich.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await createSupplement({
        name: form.name.trim(),
        form: form.form as any,
        unitDose: form.unitDose ? Number(form.unitDose) : null,
        doseUnit: form.doseUnit,
        dailyFrequency: Number(form.dailyFrequency) || 1,
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
      title="Supplement hinzufügen"
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
          <span className="text-xs text-muted">Name</span>
          <input value={form.name} onChange={set("name")} placeholder="z. B. Vitamin D" className={inputCls} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs text-muted">Form</span>
            <select value={form.form} onChange={set("form")} className={inputCls}>
              <option value="pill">Tablette</option>
              <option value="capsule">Kapsel</option>
              <option value="powder">Pulver</option>
              <option value="liquid">Liquid</option>
              <option value="chewable">Kautablette</option>
              <option value="other">Sonstiges</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-muted">Häufigkeit/Tag</span>
            <input
              type="number"
              inputMode="numeric"
              value={form.dailyFrequency}
              onChange={set("dailyFrequency")}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted">Dosis</span>
            <input
              type="number"
              inputMode="decimal"
              value={form.unitDose}
              onChange={set("unitDose")}
              placeholder="500"
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted">Einheit</span>
            <input value={form.doseUnit} onChange={set("doseUnit")} placeholder="mg" className={inputCls} />
          </label>
        </div>
        {err && <p className="text-sm text-danger">{err}</p>}
      </div>
    </Modal>
  );
}