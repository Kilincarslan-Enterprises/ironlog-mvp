import { useEffect, useState } from "react";
import { Copy, Plus, Trash2, Key, User as UserIcon } from "lucide-react";
import {
  getUser,
  updateUser,
  getAgentTokens,
  createAgentToken,
  deleteAgentToken,
  type User,
  type AgentToken,
} from "../lib/api";
import { Loading, ErrorState } from "../components/States";
import Modal from "../components/Modal";

export default function Settings() {
  const [, setUser] = useState<User | null>(null);
  const [tokens, setTokens] = useState<AgentToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Profile Form state
  const [displayName, setDisplayName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [unitSystem, setUnitSystem] = useState<"metric" | "imperial">("metric");
  const [dailyCalorieTarget, setDailyCalorieTarget] = useState<string>("");
  const [dailyProteinTarget, setDailyProteinTarget] = useState<string>("");
  const [dailyCarbsTarget, setDailyCarbsTarget] = useState<string>("");
  const [dailyFatTarget, setDailyFatTarget] = useState<string>("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Token Modal state
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [newTokenLabel, setNewTokenLabel] = useState("");
  const [newTokenExpires, setNewTokenExpires] = useState<"30" | "90" | "365" | "never">("90");
  const [creatingToken, setCreatingToken] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [uRes, tRes] = await Promise.all([getUser(), getAgentTokens()]);
      const u = uRes.user;
      setUser(u);
      setTokens(tRes.tokens);

      setDisplayName(u.displayName);
      setTimezone(u.timezone);
      setUnitSystem(u.unitSystem);
      setDailyCalorieTarget(u.dailyCalorieTarget?.toString() || "");
      setDailyProteinTarget(u.dailyProteinTarget?.toString() || "");
      setDailyCarbsTarget(u.dailyCarbsTarget?.toString() || "");
      setDailyFatTarget(u.dailyFatTarget?.toString() || "");
    } catch (e: any) {
      setError(e.message || "Fehler beim Laden der Einstellungen");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const uRes = await updateUser({
        displayName,
        timezone,
        unitSystem,
        dailyCalorieTarget: dailyCalorieTarget ? parseInt(dailyCalorieTarget) : null,
        dailyProteinTarget: dailyProteinTarget ? parseInt(dailyProteinTarget) : null,
        dailyCarbsTarget: dailyCarbsTarget ? parseInt(dailyCarbsTarget) : null,
        dailyFatTarget: dailyFatTarget ? parseInt(dailyFatTarget) : null,
      });
      setUser(uRes.user);
    } catch (e: any) {
      alert(e.message || "Profil konnte nicht gespeichert werden");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTokenLabel) return;
    setCreatingToken(true);
    try {
      let expiresAt: string | null = null;
      if (newTokenExpires !== "never") {
        const d = new Date();
        d.setDate(d.getDate() + parseInt(newTokenExpires));
        expiresAt = d.toISOString();
      }

      const res = await createAgentToken({
        label: newTokenLabel,
        expiresAt,
      });

      setTokens((prev) => [res.token, ...prev]);
      setCreatedSecret(res.secret);
    } catch (e: any) {
      alert(e.message || "Token konnte nicht erstellt werden");
    } finally {
      setCreatingToken(false);
    }
  };

  const handleDeleteToken = async (id: string) => {
    if (!confirm("Diesen API Key wirklich löschen/widerrufen?")) return;
    try {
      await deleteAgentToken(id);
      setTokens((prev) => prev.filter((t) => t.id !== id));
    } catch (e: any) {
      alert(e.message || "Token konnte nicht gelöscht werden");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Kopiert!");
  };

  if (loading) return <Loading label="Einstellungen laden…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Profile Section */}
      <section className="bg-card p-4 rounded-2xl border border-border">
        <div className="flex items-center gap-2 mb-4 text-text-strong font-bold text-lg">
          <UserIcon className="text-accent" />
          <h2>Profil & Ziele</h2>
        </div>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-bg border border-border rounded-lg p-2 text-text focus:ring-2 focus:ring-accent outline-none"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Kcal Ziel</label>
              <input
                type="number"
                value={dailyCalorieTarget}
                onChange={(e) => setDailyCalorieTarget(e.target.value)}
                className="w-full bg-bg border border-border rounded-lg p-2 text-text focus:ring-2 focus:ring-accent outline-none"
                placeholder="2500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Protein (g)</label>
              <input
                type="number"
                value={dailyProteinTarget}
                onChange={(e) => setDailyProteinTarget(e.target.value)}
                className="w-full bg-bg border border-border rounded-lg p-2 text-text focus:ring-2 focus:ring-accent outline-none"
                placeholder="150"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Carbs (g)</label>
              <input
                type="number"
                value={dailyCarbsTarget}
                onChange={(e) => setDailyCarbsTarget(e.target.value)}
                className="w-full bg-bg border border-border rounded-lg p-2 text-text focus:ring-2 focus:ring-accent outline-none"
                placeholder="250"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Fett (g)</label>
              <input
                type="number"
                value={dailyFatTarget}
                onChange={(e) => setDailyFatTarget(e.target.value)}
                className="w-full bg-bg border border-border rounded-lg p-2 text-text focus:ring-2 focus:ring-accent outline-none"
                placeholder="80"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Einheitensystem</label>
            <select
              value={unitSystem}
              onChange={(e) => setUnitSystem(e.target.value as "metric" | "imperial")}
              className="w-full bg-bg border border-border rounded-lg p-2 text-text focus:ring-2 focus:ring-accent outline-none"
            >
              <option value="metric">Metrisch (kg, cm)</option>
              <option value="imperial">Imperial (lbs, in)</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={savingProfile}
            className="w-full bg-accent text-white font-bold py-3 rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {savingProfile ? "Wird gespeichert..." : "Profil speichern"}
          </button>
        </form>
      </section>

      {/* API Keys Section */}
      <section className="bg-card p-4 rounded-2xl border border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-text-strong font-bold text-lg">
            <Key className="text-purple-400" />
            <h2>API Keys</h2>
          </div>
          <button
            onClick={() => {
              setNewTokenLabel("");
              setCreatedSecret(null);
              setIsTokenModalOpen(true);
            }}
            className="flex items-center gap-1 bg-bg border border-border text-text text-sm font-bold px-3 py-1.5 rounded-lg hover:bg-card-hover"
          >
            <Plus size={16} />
            Neu
          </button>
        </div>
        <p className="text-sm text-muted mb-4">
          Verwende API Keys zur Authentifizierung externer Anwendungen. Sende den Key im <code className="text-xs bg-bg p-1 rounded">x-api-token</code> Header.
        </p>

        {tokens.length === 0 ? (
          <p className="text-sm text-muted text-center py-4">Keine aktiven API Keys.</p>
        ) : (
          <div className="space-y-3">
            {tokens.map((token) => (
              <div key={token.id} className="bg-bg p-3 rounded-xl border border-border flex justify-between items-center">
                <div>
                  <div className="font-bold text-text">{token.label}</div>
                  <div className="text-xs text-muted">
                    {token.expiresAt
                      ? `Läuft ab: ${new Date(token.expiresAt).toLocaleDateString()}`
                      : "Läuft nie ab"}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteToken(token.id)}
                  className="p-2 text-danger hover:bg-danger-soft rounded-lg transition-colors"
                  title="Widerrufen"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Create Token Modal */}
      <Modal open={isTokenModalOpen} onClose={() => setIsTokenModalOpen(false)} title="Neuer API Key">
        {!createdSecret ? (
          <form onSubmit={handleCreateToken} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Name / Label</label>
              <input
                type="text"
                value={newTokenLabel}
                onChange={(e) => setNewTokenLabel(e.target.value)}
                className="w-full bg-bg border border-border rounded-lg p-2 text-text focus:ring-2 focus:ring-accent outline-none"
                placeholder="z.B. Mein Skript"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Gültigkeit</label>
              <select
                value={newTokenExpires}
                onChange={(e) => setNewTokenExpires(e.target.value as any)}
                className="w-full bg-bg border border-border rounded-lg p-2 text-text focus:ring-2 focus:ring-accent outline-none"
              >
                <option value="30">30 Tage</option>
                <option value="90">90 Tage</option>
                <option value="365">1 Jahr</option>
                <option value="never">Nie</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={creatingToken || !newTokenLabel}
              className="w-full bg-accent text-white font-bold py-3 rounded-xl mt-4 hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {creatingToken ? "Erstelle..." : "Erstellen"}
            </button>
          </form>
        ) : (
          <div className="space-y-4 text-center">
            <div className="p-3 bg-success-soft text-success rounded-xl font-bold">
              Erfolgreich erstellt!
            </div>
            <p className="text-sm text-text">
              Bitte kopiere deinen API Key <strong>jetzt</strong>. Er wird danach nie wieder vollständig angezeigt.
            </p>
            <div className="flex items-center gap-2 bg-bg border border-border p-3 rounded-xl break-all text-sm font-mono text-left">
              <span className="flex-1">{createdSecret}</span>
              <button
                onClick={() => copyToClipboard(createdSecret)}
                className="p-2 bg-card border border-border rounded-lg hover:bg-card-hover"
              >
                <Copy size={16} className="text-text" />
              </button>
            </div>
            <button
              onClick={() => setIsTokenModalOpen(false)}
              className="w-full bg-card border border-border text-text font-bold py-3 rounded-xl hover:bg-card-hover transition-colors mt-2"
            >
              Schließen
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
