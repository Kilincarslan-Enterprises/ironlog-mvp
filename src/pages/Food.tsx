import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, ChevronDown, RefreshCw, Trash2, X, ScanLine, Camera, Edit3 } from "lucide-react";
import { Card } from "../components/Card";
import { Modal } from "../components/Modal";
import { Loading, ErrorState, EmptyState } from "../components/States";
import {
  getNutritionDaily,
  getFoodPresets,
  createFoodPreset,
  updateFoodPreset,
  deleteFoodPreset,
  createMeal,
  deleteMeal,
  lookupBarcode,
  type NutritionDaily,
  type FoodPreset,
  type Meal,
} from "../lib/api";

export default function Food() {
  const [daily, setDaily] = useState<NutritionDaily | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await getNutritionDaily();
      setDaily(d);
    } catch (e: any) {
      setError(e?.message || "Ernährung konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const onMealDeleted = async (mealId: string) => {
    try { await deleteMeal(mealId); await load(); }
    catch (e: any) { setError(e?.message || "Mahlzeit konnte nicht gelöscht werden."); }
  };

  const onMealAdded = async () => { setAddOpen(false); await load(); };

  const totals = daily?.totals ?? { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 };
  const meals = daily?.meals ?? [];

  return (
    <div className="p-4 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-strong">Essen</h1>
        <button type="button" onClick={load} aria-label="Aktualisieren" className="text-muted hover:text-text p-2 -mr-2">
          <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Daily nutrition summary */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Kcal", value: totals.calories, tone: "text-accent" },
          { label: "Protein", value: totals.protein, tone: "text-success" },
          { label: "Carbs", value: totals.carbs, tone: "text-warning" },
          { label: "Fett", value: totals.fat, tone: "text-danger" },
        ].map((m) => (
          <div key={m.label} className="bg-card rounded-xl border border-border p-3 text-center">
            <div className={`text-lg font-bold ${m.tone}`}>{m.value}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted mt-0.5">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Meals */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-text-strong px-1">Mahlzeiten</h2>
        {loading && !daily ? (
          <Loading label="Mahlzeiten laden…" />
        ) : error && !daily ? (
          <ErrorState message={error} onRetry={load} />
        ) : meals.length === 0 ? (
          <EmptyState title="Noch keine Mahlzeiten heute" hint={"Tippe auf „Hinzufügen“, um etwas zu loggen."} />
        ) : (
          meals.map((meal) => (
            <MealRow key={meal.id} meal={meal} expanded={expanded.has(meal.id)}
              onToggle={() => toggle(meal.id)} onDelete={() => onMealDeleted(meal.id)} />
          ))
        )}
      </section>

      <button type="button" onClick={() => setAddOpen(true)}
        className="fixed bottom-24 right-4 z-20 bg-accent text-white rounded-full w-14 h-14 shadow-lg flex items-center justify-center active:scale-95 transition-transform hover:bg-accent-hover"
        aria-label="Mahlzeit hinzufügen">
        <Plus size={28} />
      </button>

      {addOpen && <AddMealModal onClose={() => setAddOpen(false)} onAdded={onMealAdded} />}
    </div>
  );
}

function MealRow({ meal, expanded, onToggle, onDelete }: {
  meal: Meal; expanded: boolean; onToggle: () => void; onDelete: () => void;
}) {
  const total = meal.items.reduce(
    (acc, it) => ({ calories: acc.calories + Number(it.calories || 0), protein: acc.protein + Number(it.protein || 0) }),
    { calories: 0, protein: 0 },
  );
  const time = new Date(meal.loggedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

  return (
    <Card>
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between text-left">
        <div className="min-w-0">
          <div className="font-semibold text-text-strong truncate">{meal.name}</div>
          <div className="text-xs text-muted mt-0.5">
            {time} · {Math.round(total.calories)} kcal · {Math.round(total.protein)}g Protein
          </div>
        </div>
        <div className="flex items-center gap-1 text-muted">
          <Trash2 size={18} onClick={(e) => { e.stopPropagation(); if (confirm("Mahlzeit löschen?")) onDelete(); }} className="hover:text-danger" />
          <ChevronDown size={18} className={expanded ? "rotate-180 transition-transform" : "transition-transform"} />
        </div>
      </button>
      {expanded && meal.items.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-border-muted pt-3">
          {meal.items.map((it) => (
            <li key={it.id} className="flex justify-between text-sm">
              <span className="text-text truncate">{it.name} · {it.quantity}{it.quantityUnit}</span>
              <span className="text-muted shrink-0 ml-2">{Math.round(it.calories)} kcal</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Add meal modal — with barcode scan + manual entry
// ---------------------------------------------------------------------------

function AddMealModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [presets, setPresets] = useState<FoodPreset[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<FoodPreset | null>(null);
  const [quantity, setQuantity] = useState<string>("");
  const [unitMode, setUnitMode] = useState<"g" | "piece">("g");
  const [mealName, setMealName] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<FoodPreset | null>(null);

  useEffect(() => {
    getFoodPresets().then((r) => setPresets(r.presets)).catch((e) => setErr(e?.message || "Presets konnten nicht geladen werden."));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return presets;
    return presets.filter((p) => p.name.toLowerCase().includes(q) || (p.brand || "").toLowerCase().includes(q));
  }, [presets, query]);

  const selectPreset = (p: FoodPreset) => {
    setSelected(p);
    // Default to piece mode if preset has pieceSize and user hasn't typed anything yet
    if (p.pieceSize) {
      setUnitMode("piece");
      setQuantity("1");
    } else {
      setUnitMode("g");
      setQuantity(String(p.servingSize));
    }
    setErr(null);
  };

  const onBarcodeScanned = (preset: FoodPreset) => {
    setScannerOpen(false);
    setPresets((prev) => prev.find((p) => p.id === preset.id) ? prev : [preset, ...prev]);
    selectPreset(preset);
  };

  const onPresetUpdated = (updated: FoodPreset) => {
    setPresets((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    if (selected?.id === updated.id) setSelected(updated);
    setEditingPreset(null);
  };

  const onPresetDeleted = (id: string) => {
    setPresets((prev) => prev.filter((p) => p.id !== id));
    if (selected?.id === id) setSelected(null);
    setEditingPreset(null);
  };

  const submit = async () => {
    if (!selected) { setErr("Wähle zuerst ein Lebensmittel."); return; }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) { setErr("Gültige Menge eingeben."); return; }

    // Calculate scale factor
    let grams: number;
    let displayUnit: string;
    if (unitMode === "piece" && selected.pieceSize) {
      grams = qty * selected.pieceSize;
      displayUnit = selected.pieceName || "Stück";
    } else {
      grams = qty;
      displayUnit = selected.servingUnit;
    }
    const scale = grams / selected.servingSize;

    setSaving(true); setErr(null);
    try {
      await createMeal({
        name: mealName.trim() || selected.name,
        loggedAt: Date.now(),
        items: [{
          foodPresetId: selected.id,
          name: selected.name,
          quantity: qty,
          quantityUnit: displayUnit,
          calories: Math.round(selected.calories * scale),
          protein: Math.round(selected.protein * scale),
          carbs: Math.round(selected.carbs * scale),
          fat: Math.round(selected.fat * scale),
          fiber: selected.fiber ? Math.round(selected.fiber * scale) : 0,
          sodium: selected.sodium ? Math.round(selected.sodium * scale) : 0,
        }],
      });
      onAdded();
    } catch (e: any) { setErr(e?.message || "Speichern fehlgeschlagen."); }
    finally { setSaving(false); }
  };

  if (scannerOpen) {
    return <BarcodeScannerModal onClose={() => setScannerOpen(false)} onFound={onBarcodeScanned} />;
  }

  if (editingPreset) {
    return (
      <Modal open onClose={() => setEditingPreset(null)} title="Lebensmittel bearbeiten">
        <PresetEditForm preset={editingPreset}
          onCancel={() => setEditingPreset(null)}
          onSaved={onPresetUpdated}
          onDeleted={() => onPresetDeleted(editingPreset.id)} />
      </Modal>
    );
  }

  if (showNewForm) {
    return (
      <Modal open onClose={onClose} title="Neues Lebensmittel">
        <NewPresetForm
          onCancel={() => setShowNewForm(false)}
          onCreated={(p) => { setShowNewForm(false); selectPreset(p); }} />
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="Mahlzeit hinzufügen"
      footer={
        <button type="button" onClick={submit} disabled={saving || !selected}
          className="w-full bg-accent text-white font-bold py-3 rounded-xl disabled:opacity-50 hover:bg-accent-hover transition-colors">
          {saving ? "Speichern…" : "Hinzufügen"}
        </button>
      }
    >
      <div className="space-y-3">
        <input value={mealName} onChange={(e) => setMealName(e.target.value)}
          placeholder="Mahlzeit-Name (optional)"
          className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder:text-muted" />

        {/* Barcode scan button */}
        <button type="button" onClick={() => setScannerOpen(true)}
          className="w-full bg-accent-soft border border-accent text-accent font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-accent/20 transition-colors">
          <ScanLine size={18} /> Barcode scannen
        </button>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Lebensmittel suchen…"
            className="w-full bg-bg border border-border rounded-xl pl-9 pr-3 py-2.5 text-sm text-text placeholder:text-muted" />
        </div>

        <button type="button" onClick={() => setShowNewForm(true)}
          className="w-full text-sm font-semibold text-accent hover:text-accent-hover text-left">
          + Neues Lebensmittel manuell anlegen
        </button>

        {/* Preset grid */}
        <div className="grid grid-cols-2 gap-2 max-h-[40dvh] overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="col-span-2 text-center text-sm text-muted py-6">
              Keine Treffer. Scanne einen Barcode oder leg ein neues Lebensmittel an.
            </p>
          ) : (
            filtered.map((p) => {
              const active = selected?.id === p.id;
              return (
                <div key={p.id}
                  className={`relative text-left p-3 rounded-xl border transition-colors ${
                    active ? "border-accent bg-accent-soft" : "border-border bg-bg hover:bg-card-hover"
                  }`}>
                  <button type="button" onClick={() => selectPreset(p)} className="text-left w-full">
                    <div className="font-semibold text-sm text-text-strong truncate">{p.name}</div>
                    <div className="text-xs text-muted mt-0.5">
                      {p.calories} kcal · {p.protein}g · pro {p.servingSize}{p.servingUnit}
                      {p.pieceSize && <span className="text-accent"> · {p.pieceName || "Stück"} à {p.pieceSize}g</span>}
                    </div>
                  </button>
                  <button type="button" onClick={() => setEditingPreset(p)}
                    className="absolute top-1.5 right-1.5 text-muted hover:text-accent p-1" aria-label="Bearbeiten">
                    <Edit3 size={12} />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {selected && (
          <div className="border-t border-border-muted pt-3">
            {/* Unit toggle: Gramm vs Stück */}
            {selected.pieceSize && (
              <div className="flex gap-1 mb-2">
                <button type="button" onClick={() => { setUnitMode("g"); setQuantity(String(selected.servingSize)); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border ${
                    unitMode === "g" ? "bg-accent border-accent text-white" : "border-border text-muted"}`}>
                  Gramm
                </button>
                <button type="button" onClick={() => { setUnitMode("piece"); setQuantity("1"); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border ${
                    unitMode === "piece" ? "bg-accent border-accent text-white" : "border-border text-muted"}`}>
                  {selected.pieceName || "Stück"}
                </button>
              </div>
            )}
            <label className="text-xs text-muted">
              {unitMode === "piece" && selected.pieceSize
                ? `Anzahl ${selected.pieceName || "Stück"} (à ${selected.pieceSize}g)`
                : `Menge (${selected.servingUnit})`}
            </label>
            <div className="flex items-center gap-2 mt-1">
              <input type="number" inputMode="decimal" value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="flex-1 bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text" />
              <button type="button" onClick={() => setSelected(null)}
                className="text-muted hover:text-text p-2" aria-label="Auswahl entfernen">
                <X size={18} />
              </button>
            </div>
          </div>
        )}
        {err && <p className="text-sm text-danger">{err}</p>}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Barcode scanner modal — camera + API lookup + manual barcode entry fallback
// ---------------------------------------------------------------------------

function BarcodeScannerModal({ onClose, onFound }: {
  onClose: () => void;
  onFound: (preset: FoodPreset) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scanning, setScanning] = useState(false);
  const [looking, setLooking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [manualBarcode, setManualBarcode] = useState("");
  const [searching, setSearching] = useState(false);
  const codeReaderRef = useRef<any>(null);

  const startScan = async () => {
    setErr(null);
    setScanning(true);
    setLooking(true);
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      codeReaderRef.current = reader;

      // List cameras, prefer back camera
      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      const backCam = devices.find((d: any) => /back|rear|environment/i.test(d.label)) || devices[devices.length - 1];

      reader.decodeFromVideoDevice(backCam.deviceId, videoRef.current!, (result: any, _err: any) => {
        if (result) {
          const barcode = result.getText();
          stopScan();
          lookupBarcodeApi(barcode);
        }
      });
      setLooking(false);
    } catch (e: any) {
      setScanning(false);
      setLooking(false);
      setErr("Kamera konnte nicht gestartet werden. Bitte Barcode manuell eingeben.");
    }
  };

  const stopScan = () => {
    if (codeReaderRef.current) {
      codeReaderRef.current.stop();
      codeReaderRef.current = null;
    }
    setScanning(false);
  };

  const lookupBarcodeApi = async (barcode: string) => {
    setSearching(true);
    setErr(null);
    try {
      const r = await lookupBarcode(barcode);
      onFound(r.preset);
    } catch (e: any) {
      const msg = e?.status === 404
        ? "Produkt nicht gefunden. Bitte manuell eingeben."
        : (e?.message || "Fehler beim Suchen.");
      setErr(msg);
      // Stop scanning so user can enter manually
      stopScan();
    } finally {
      setSearching(false);
    }
  };

  const submitManual = () => {
    if (!manualBarcode.trim()) return;
    lookupBarcodeApi(manualBarcode.trim());
  };

  useEffect(() => {
    return () => { stopScan(); };
  }, []);

  return (
    <Modal open onClose={() => { stopScan(); onClose(); }} title="Barcode scannen">
      <div className="space-y-4">
        {scanning && (
          <div className="relative rounded-xl overflow-hidden bg-black">
            <video ref={videoRef} className="w-full h-48 object-cover" />
            {/* Scan frame overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-1 bg-accent rounded-full opacity-80 animate-pulse" />
            </div>
            {looking && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <Loading label="Kamera wird gestartet…" />
              </div>
            )}
          </div>
        )}

        {searching && <Loading label="Produkt wird gesucht…" />}

        {err && (
          <div className="bg-danger-soft border border-danger rounded-xl p-3">
            <p className="text-sm text-danger">{err}</p>
          </div>
        )}

        {!scanning && !searching && (
          <>
            <button type="button" onClick={startScan}
              className="w-full bg-accent text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-accent-hover">
              <Camera size={18} /> Kamera starten
            </button>

            {/* Manual barcode entry */}
            <div className="border-t border-border-muted pt-3">
              <p className="text-xs text-muted mb-2">Oder Barcode manuell eingeben:</p>
              <div className="flex gap-2">
                <input value={manualBarcode} onChange={(e) => setManualBarcode(e.target.value)}
                  placeholder="z. B. 4008400253867" inputMode="numeric"
                  className="flex-1 bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text"
                  onKeyDown={(e) => { if (e.key === "Enter") submitManual(); }} />
                <button type="button" onClick={submitManual} disabled={!manualBarcode.trim()}
                  className="bg-accent text-white font-bold px-4 rounded-xl text-sm disabled:opacity-50">
                  Suchen
                </button>
              </div>
            </div>

            <button type="button" onClick={() => { stopScan(); onClose(); }}
              className="w-full text-sm text-muted hover:text-text py-2">
              Abbrechen
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// New preset form (manual entry)
// ---------------------------------------------------------------------------

function NewPresetForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (p: FoodPreset) => void }) {
  const [form, setForm] = useState({
    name: "", brand: "", servingSize: "100", servingUnit: "g",
    calories: "", protein: "", carbs: "", fat: "",
    pieceSize: "", pieceName: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.name.trim()) { setErr("Name erforderlich."); return; }
    setSaving(true); setErr(null);
    try {
      const r = await createFoodPreset({
        name: form.name.trim(),
        brand: form.brand.trim() || null,
        servingSize: Number(form.servingSize) || 100,
        servingUnit: form.servingUnit || "g",
        calories: Number(form.calories) || 0,
        protein: Number(form.protein) || 0,
        carbs: Number(form.carbs) || 0,
        fat: Number(form.fat) || 0,
        pieceSize: form.pieceSize.trim() ? Number(form.pieceSize) : null,
        pieceName: form.pieceName.trim() || null,
      } as any);
      onCreated(r.preset);
    } catch (e: any) { setErr(e?.message || "Anlegen fehlgeschlagen."); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-3">
      <Field label="Name"><input value={form.name} onChange={set("name")} className={inputCls} placeholder="z. B. Ei" /></Field>
      <Field label="Marke (optional)"><input value={form.brand} onChange={set("brand")} className={inputCls} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Portionsgröße"><input type="number" value={form.servingSize} onChange={set("servingSize")} className={inputCls} /></Field>
        <Field label="Einheit"><input value={form.servingUnit} onChange={set("servingUnit")} className={inputCls} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Kalorien"><input type="number" value={form.calories} onChange={set("calories")} className={inputCls} /></Field>
        <Field label="Protein (g)"><input type="number" value={form.protein} onChange={set("protein")} className={inputCls} /></Field>
        <Field label="Carbs (g)"><input type="number" value={form.carbs} onChange={set("carbs")} className={inputCls} /></Field>
        <Field label="Fett (g)"><input type="number" value={form.fat} onChange={set("fat")} className={inputCls} /></Field>
      </div>
      <div className="border-t border-border-muted pt-3">
        <p className="text-xs text-muted mb-2">Stück-Option (optional — z. B. 1 Ei = 53g, 1 Packung = 500g)</p>
        <div className="grid grid-cols-2 gap-2">
          <Field label="g pro Stück"><input type="number" value={form.pieceSize} onChange={set("pieceSize")} className={inputCls} placeholder="z. B. 53" /></Field>
          <Field label="Stück-Name"><input value={form.pieceName} onChange={set("pieceName")} className={inputCls} placeholder="z. B. Ei, Packung" /></Field>
        </div>
      </div>
      {err && <p className="text-sm text-danger">{err}</p>}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 bg-bg border border-border text-text font-semibold py-3 rounded-xl">Abbrechen</button>
        <button type="button" onClick={submit} disabled={saving}
          className="flex-1 bg-accent text-white font-bold py-3 rounded-xl disabled:opacity-50 hover:bg-accent-hover">
          {saving ? "…" : "Anlegen"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preset edit form — edit existing preset (including piece settings)
// ---------------------------------------------------------------------------
function PresetEditForm({ preset, onCancel, onSaved, onDeleted }: {
  preset: FoodPreset; onCancel: () => void; onSaved: (p: FoodPreset) => void; onDeleted: () => void;
}) {
  const [form, setForm] = useState({
    name: preset.name, brand: preset.brand || "", servingSize: String(preset.servingSize), servingUnit: preset.servingUnit,
    calories: String(preset.calories), protein: String(preset.protein), carbs: String(preset.carbs), fat: String(preset.fat),
    pieceSize: preset.pieceSize ? String(preset.pieceSize) : "", pieceName: preset.pieceName || "",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.name.trim()) { setErr("Name erforderlich."); return; }
    setSaving(true); setErr(null);
    try {
      const r = await updateFoodPreset(preset.id, {
        name: form.name.trim(),
        brand: form.brand.trim() || null,
        servingSize: Number(form.servingSize) || 100,
        servingUnit: form.servingUnit || "g",
        calories: Number(form.calories) || 0,
        protein: Number(form.protein) || 0,
        carbs: Number(form.carbs) || 0,
        fat: Number(form.fat) || 0,
        pieceSize: form.pieceSize.trim() ? Number(form.pieceSize) : null,
        pieceName: form.pieceName.trim() || null,
      } as any);
      onSaved(r.preset);
    } catch (e: any) { setErr(e?.message || "Speichern fehlgeschlagen."); }
    finally { setSaving(false); }
  };

  const del = async () => {
    if (!confirm(`"${preset.name}" wirklich löschen?`)) return;
    setDeleting(true);
    try { await deleteFoodPreset(preset.id); onDeleted(); }
    catch (e: any) { setErr(e?.message || "Löschen fehlgeschlagen."); }
    finally { setDeleting(false); }
  };

  return (
    <div className="space-y-3">
      <Field label="Name"><input value={form.name} onChange={set("name")} className={inputCls} /></Field>
      <Field label="Marke (optional)"><input value={form.brand} onChange={set("brand")} className={inputCls} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Portionsgröße"><input type="number" value={form.servingSize} onChange={set("servingSize")} className={inputCls} /></Field>
        <Field label="Einheit"><input value={form.servingUnit} onChange={set("servingUnit")} className={inputCls} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Kalorien"><input type="number" value={form.calories} onChange={set("calories")} className={inputCls} /></Field>
        <Field label="Protein (g)"><input type="number" value={form.protein} onChange={set("protein")} className={inputCls} /></Field>
        <Field label="Carbs (g)"><input type="number" value={form.carbs} onChange={set("carbs")} className={inputCls} /></Field>
        <Field label="Fett (g)"><input type="number" value={form.fat} onChange={set("fat")} className={inputCls} /></Field>
      </div>
      <div className="border-t border-border-muted pt-3">
        <p className="text-xs text-muted mb-2">Stück-Option (optional — z. B. 1 Ei = 53g, 1 Packung = 500g)</p>
        <div className="grid grid-cols-2 gap-2">
          <Field label="g pro Stück"><input type="number" value={form.pieceSize} onChange={set("pieceSize")} className={inputCls} placeholder="z. B. 53" /></Field>
          <Field label="Stück-Name"><input value={form.pieceName} onChange={set("pieceName")} className={inputCls} placeholder="z. B. Ei, Packung" /></Field>
        </div>
      </div>
      {err && <p className="text-sm text-danger">{err}</p>}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 bg-bg border border-border text-text font-semibold py-3 rounded-xl">Abbrechen</button>
        <button type="button" onClick={del} disabled={deleting}
          className="flex-1 bg-danger-soft border border-danger text-danger font-semibold py-3 rounded-xl disabled:opacity-50">
          {deleting ? "…" : "Löschen"}
        </button>
        <button type="button" onClick={submit} disabled={saving}
          className="flex-[2] bg-accent text-white font-bold py-3 rounded-xl disabled:opacity-50 hover:bg-accent-hover">
          {saving ? "…" : "Speichern"}
        </button>
      </div>
    </div>
  );
}

const inputCls = "w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder:text-muted";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-muted">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}