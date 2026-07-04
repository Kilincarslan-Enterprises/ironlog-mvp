import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, TrendingUp, TrendingDown, Minus, Trash2, Pencil } from "lucide-react";
import { Card } from "../components/Card";
import { Modal } from "../components/Modal";
import { Loading, ErrorState, EmptyState } from "../components/States";
import {
  getWeightEntries,
  createWeightEntry,
  updateWeightEntry,
  deleteWeightEntry,
  type WeightEntry,
} from "../lib/api";

type Range = "7d" | "30d" | "90d" | "all";

export default function Weight() {
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [range, setRange] = useState<Range>("30d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await getWeightEntries(range);
      setEntries(r.entries);
    } catch (e: any) {
      setError(e?.message || "Gewicht konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const onCreated = async () => {
    setAddOpen(false);
    await load();
  };

  const onDelete = async (id: string) => {
    try {
      await deleteWeightEntry(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (e: any) {
      setError(e?.message || "Löschen fehlgeschlagen.");
    }
  };

  const onEditSaved = async () => {
    setEditId(null);
    await load();
  };

  // Build a chronological (oldest → newest) view for the chart.
  const chrono = useMemo(() => [...entries].reverse(), [entries]);
  const latest = entries[0] ?? null;
  const prev = entries[1] ?? null;
  const trend =
    latest && prev
      ? latest.weight > prev.weight
        ? "up"
        : latest.weight < prev.weight
          ? "down"
          : "flat"
      : "flat";

  return (
    <div className="p-4 space-y-5">
      <h1 className="text-xl font-bold text-text-strong">Gewicht</h1>

      {loading && entries.length === 0 ? (
        <Loading label="Gewicht laden…" />
      ) : error && entries.length === 0 ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <>
          {/* Latest + trend */}
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted uppercase tracking-wider">Aktuell</div>
                <div className="text-3xl font-bold text-text-strong">
                  {latest ? `${latest.weight} ${latest.unit}` : "—"}
                </div>
                {latest && (
                  <div className="text-xs text-muted mt-0.5">
                    {new Date(latest.measuredAt).toLocaleDateString("de-DE")}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-center">
                {trend === "up" && <TrendingUp size={28} className="text-danger" />}
                {trend === "down" && <TrendingDown size={28} className="text-success" />}
                {trend === "flat" && <Minus size={28} className="text-muted" />}
                <span className="text-xs text-muted mt-1">
                  {trend === "up" ? "gestiegen" : trend === "down" ? "gefallen" : "gleich"}
                </span>
              </div>
            </div>
          </Card>

          {/* Range toggle */}
          <div className="flex gap-1 bg-card border border-border rounded-xl p-1">
            {(["7d", "30d", "90d", "all"] as Range[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  range === r ? "bg-accent text-white" : "text-muted hover:text-text"
                }`}
              >
                {r === "all" ? "Alle" : r}
              </button>
            ))}
          </div>

          {/* Chart */}
          {chrono.length >= 2 ? (
            <WeightChart entries={chrono} />
          ) : (
            <EmptyState title="Mindestens 2 Einträge nötig" hint="Für den Verlaufskurve." />
          )}

          {/* Recent entries */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-text-strong px-1">Einträge</h2>
            {entries.length === 0 ? (
              <EmptyState title="Noch keine Einträge" hint="Tippe + zum Eintragen." />
            ) : (
              entries.map((e) => (
                <div
                  key={e.id}
                  className="bg-card border border-border rounded-2xl p-3 flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold text-text-strong">{e.weight} {e.unit}</div>
                    <div className="text-xs text-muted">
                      {new Date(e.measuredAt).toLocaleDateString("de-DE")}
                      {e.bodyFatPercentage ? ` · KFA ${e.bodyFatPercentage}%` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-muted">
                    <button
                      type="button"
                      onClick={() => setEditId(e.id)}
                      aria-label="Bearbeiten"
                      className="hover:text-accent p-2"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(e.id)}
                      aria-label="Löschen"
                      className="hover:text-danger p-2"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </section>
        </>
      )}

      <button
        type="button"
        onClick={() => setAddOpen(true)}
        className="fixed bottom-24 right-4 z-20 bg-accent text-white rounded-full w-14 h-14 shadow-lg flex items-center justify-center active:scale-95 transition-transform hover:bg-accent-hover"
        aria-label="Gewicht eintragen"
      >
        <Plus size={28} />
      </button>

      {addOpen && <AddWeightModal onClose={() => setAddOpen(false)} onCreated={onCreated} />}
      {editId && (
        <EditWeightModal
          entry={entries.find((e) => e.id === editId)!}
          onClose={() => setEditId(null)}
          onSaved={onEditSaved}
        />
      )}
    </div>
  );
}

/** Simple inline SVG line chart of weight over time. */
function WeightChart({ entries }: { entries: WeightEntry[] }) {
  const W = 320;
  const H = 140;
  const pad = 24;

  const weights = entries.map((e) => e.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const span = max - min || 1;

  const points = entries.map((e, i) => {
    const x = pad + (i / (entries.length - 1)) * (W - pad * 2);
    const y = pad + (1 - (e.weight - min) / span) * (H - pad * 2);
    return { x, y, e };
  });

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  return (
    <Card>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Gewichtsverlauf">
        {/* baseline */}
        <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} className="stroke-border" strokeWidth={1} />
        <line x1={pad} y1={pad} x2={pad} y2={H - pad} className="stroke-border" strokeWidth={1} />
        <text x={pad - 6} y={pad + 4} textAnchor="end" className="fill-muted" fontSize={9}>
          {max}
        </text>
        <text x={pad - 6} y={H - pad} textAnchor="end" className="fill-muted" fontSize={9}>
          {min}
        </text>
        <path d={path} fill="none" className="stroke-accent" strokeWidth={2.5} strokeLinejoin="round" />
        {points.map((p) => (
          <circle key={p.e.id} cx={p.x} cy={p.y} r={3} className="fill-accent" />
        ))}
      </svg>
    </Card>
  );
}

function AddWeightModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [weight, setWeight] = useState("");
  const [unit, setUnit] = useState("kg");
  const [bodyFat, setBodyFat] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    const w = Number(weight);
    if (!Number.isFinite(w) || w <= 0) {
      setErr("Gültiges Gewicht eingeben.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await createWeightEntry({
        weight: w,
        unit,
        measuredAt: Date.now(),
        bodyFatPercentage: bodyFat ? Number(bodyFat) : null,
      });
      onCreated();
    } catch (e: any) {
      setErr(e?.message || "Speichern fehlgeschlagen.");
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
      title="Gewicht eintragen"
      footer={
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="w-full bg-accent text-white font-bold py-3 rounded-xl disabled:opacity-50 hover:bg-accent-hover"
        >
          {saving ? "Speichern…" : "Speichern"}
        </button>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <label className="block col-span-2">
            <span className="text-xs text-muted">Gewicht</span>
            <input
              type="number"
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="82.5"
              autoFocus
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted">Einheit</span>
            <select value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls}>
              <option value="kg">kg</option>
              <option value="lb">lb</option>
            </select>
          </label>
        </div>
        <label className="block">
          <span className="text-xs text-muted">Körperfett % (optional)</span>
          <input
            type="number"
            inputMode="decimal"
            value={bodyFat}
            onChange={(e) => setBodyFat(e.target.value)}
            className={inputCls}
          />
        </label>
        {err && <p className="text-sm text-danger">{err}</p>}
      </div>
    </Modal>
  );
}

function EditWeightModal({
  entry,
  onClose,
  onSaved,
}: {
  entry: WeightEntry;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [weight, setWeight] = useState(String(entry.weight));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    const w = Number(weight);
    if (!Number.isFinite(w) || w <= 0) {
      setErr("Gültiges Gewicht eingeben.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await updateWeightEntry(entry.id, { weight: w });
      onSaved();
    } catch (e: any) {
      setErr(e?.message || "Speichern fehlgeschlagen.");
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
      title="Gewicht bearbeiten"
      footer={
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="w-full bg-accent text-white font-bold py-3 rounded-xl disabled:opacity-50 hover:bg-accent-hover"
        >
          {saving ? "Speichern…" : "Speichern"}
        </button>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className="text-xs text-muted">Gewicht ({entry.unit})</span>
          <input
            type="number"
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className={inputCls}
          />
        </label>
        {err && <p className="text-sm text-danger">{err}</p>}
      </div>
    </Modal>
  );
}