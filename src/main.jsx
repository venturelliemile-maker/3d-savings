import { useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ["#6366f1", "#22d3ee", "#f59e0b", "#10b981", "#f43f5e", "#a78bfa"];
const formatCHF = v => `CHF ${Number(v).toFixed(2)}`;

const DEFAULT_SETTINGS = {
  hourlyRate: 20,
  electricityCost: 0.02,
  materials: [
    { id: "pla",  name: "PLA",  costPerKg: 20 },
    { id: "petg", name: "PETG", costPerKg: 25 },
    { id: "tpu",  name: "TPU",  costPerKg: 40 },
    { id: "abs",  name: "ABS",  costPerKg: 22 },
    { id: "asa",  name: "ASA",  costPerKg: 28 },
  ]
};

function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

function ProgressBar({ value, max, color = "#6366f1" }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  return (
    <div style={{ background: "#0f0f1a", borderRadius: 8, height: 14, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, background: color, height: "100%", borderRadius: 8, transition: "width 0.5s ease" }} />
    </div>
  );
}

function Card({ children, style }) {
  return <div style={{ background: "#1e1e2e", borderRadius: 16, padding: "20px 24px", ...style }}>{children}</div>;
}

function Badge({ children, color = "#6366f1" }) {
  return <span style={{ background: color + "22", color, borderRadius: 6, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>{children}</span>;
}

const inp = { background: "#2a2a3e", border: "1px solid #3a3a5e", borderRadius: 8, padding: "8px 12px", color: "#e2e8f0", fontSize: 14, width: "100%", boxSizing: "border-box" };
const btn = (color = "#6366f1") => ({ background: color, border: "none", borderRadius: 8, padding: "9px 18px", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 14 });
const lbl = { fontSize: 12, color: "#9ca3af", marginBottom: 4, display: "block" };

function App() {
  const [tab, setTab] = useState("dashboard");
  const [goals, setGoals] = useState(() => load("goals", []));
  const [prints, setPrints] = useState(() => load("prints", []));
  const [settings, setSettings] = useState(() => load("settings", DEFAULT_SETTINGS));
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [showPrintForm, setShowPrintForm] = useState(false);
  const [newGoal, setNewGoal] = useState({ name: "", target: "", color: COLORS[0] });
  const [newPrint, setNewPrint] = useState({ name: "", type: "purchase", materialId: "pla", weightG: "", hours: "", savedHours: "", savedMinutes: "", marketPrice: "", goalId: "", date: new Date().toISOString().slice(0, 10) });
  const [dragIdx, setDragIdx] = useState(null);

  const saveGoals = useCallback(g => { setGoals(g); save("goals", g); }, []);
  const savePrints = useCallback(p => { setPrints(p); save("prints", p); }, []);
  const saveSettings = useCallback(s => { setSettings(s); save("settings", s); }, []);

  const totalSaved    = prints.reduce((s, p) => s + (p.saving || 0), 0);
  const savingsByGoal = goals.reduce((acc, g) => { acc[g.id] = prints.filter(p => p.goalId === g.id).reduce((s, p) => s + p.saving, 0); return acc; }, {});
  const unallocated   = prints.filter(p => !p.goalId).reduce((s, p) => s + p.saving, 0);

  const costPerG = matId => (settings.materials.find(m => m.id === matId)?.costPerKg || 0) / 1000;

  function calcPrintCost(materialId, weightG, hours) {
    return costPerG(materialId) * (parseFloat(weightG) || 0) + settings.electricityCost * (parseFloat(hours) || 0);
  }

  function previewSaving() {
    const { type, materialId, weightG, hours, marketPrice, savedHours, savedMinutes } = newPrint;
    if (type === "purchase") return Math.max(0, (parseFloat(marketPrice) || 0) - calcPrintCost(materialId, weightG, hours));
    const totalSavedH = (parseFloat(savedHours) || 0) + (parseFloat(savedMinutes) || 0) / 60;
    return Math.max(0, totalSavedH * settings.hourlyRate - calcPrintCost(materialId, weightG, hours));
  }

  function addGoal() {
    if (!newGoal.name || !newGoal.target) return;
    const g = [...goals, { id: Date.now().toString(), name: newGoal.name, target: parseFloat(newGoal.target), color: newGoal.color, createdAt: new Date().toISOString() }];
    saveGoals(g);
    setNewGoal({ name: "", target: "", color: COLORS[g.length % COLORS.length] });
    setShowGoalForm(false);
  }

  function addPrint() {
    const { name, type, materialId, weightG, hours, marketPrice, goalId, date, savedHours, savedMinutes } = newPrint;
    if (!name) return;
    const totalSavedH = (parseFloat(savedHours) || 0) + (parseFloat(savedMinutes) || 0) / 60;
    const saving    = previewSaving();
    const printCost = calcPrintCost(materialId, weightG, hours);
    const mat       = settings.materials.find(m => m.id === materialId);
    const p = [...prints, {
      id: Date.now().toString(), name, type, saving, goalId: goalId || null, date,
      details: type === "purchase"
        ? { material: mat?.name || materialId, weightG: parseFloat(weightG) || 0, hours: parseFloat(hours) || 0, printCost, marketPrice: parseFloat(marketPrice) || 0 }
        : { material: mat?.name || materialId, weightG: parseFloat(weightG) || 0, printHours: parseFloat(hours) || 0, printCost, savedHours: totalSavedH, rate: settings.hourlyRate }
    }];
    savePrints(p);
    setNewPrint({ name: "", type: "purchase", materialId: settings.materials[0]?.id || "pla", weightG: "", hours: "", savedHours: "", savedMinutes: "", marketPrice: "", goalId: "", date: new Date().toISOString().slice(0, 10) });
    setShowPrintForm(false);
  }

  function onDragStart(i) { setDragIdx(i); }
  function onDragOver(e, i) {
    e.preventDefault();
    if (dragIdx === null || dragIdx === i) return;
    const mats = [...settings.materials];
    const [moved] = mats.splice(dragIdx, 1);
    mats.splice(i, 0, moved);
    setDragIdx(i);
    saveSettings({ ...settings, materials: mats });
  }
  function onDragEnd() { setDragIdx(null); }

  const saving = previewSaving();

  const monthlyData = (() => {
    const map = {};
    prints.forEach(p => { const m = p.date?.slice(0, 7) || "?"; map[m] = (map[m] || 0) + p.saving; });
    return Object.entries(map).sort(([a],[b]) => a.localeCompare(b)).map(([month, saving]) => ({ month, saving: +saving.toFixed(2) }));
  })();

  const typeData = [
    { name: "Acquisto", value: +prints.filter(p => p.type==="purchase").reduce((s,p)=>s+p.saving,0).toFixed(2) },
    { name: "Tempo",    value: +prints.filter(p => p.type==="time"   ).reduce((s,p)=>s+p.saving,0).toFixed(2) },
  ].filter(d => d.value > 0);

  const goalChartData = goals.map(g => ({ name: g.name, salvato: +(savingsByGoal[g.id]||0).toFixed(2), obiettivo: g.target }));

  return (
    <div style={{ background: "#13131f", minHeight: "100vh", color: "#e2e8f0", fontFamily: "system-ui,sans-serif", paddingBottom: 40 }}>

      <div style={{ background: "#1a1a2e", borderBottom: "1px solid #2a2a4e", padding: "18px 28px", display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ fontSize: 26 }}>🖨️</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>3D Print Savings</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Tieni traccia di quanto risparmi stampando</div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#10b981" }}>{formatCHF(totalSaved)}</div>
          <div style={{ fontSize: 11, color: "#6b7280" }}>risparmio totale</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, padding: "16px 28px 0", borderBottom: "1px solid #2a2a4e" }}>
        {[["dashboard","📊 Dashboard"],["prints","🗂 Stampe"],["stats","📈 Statistiche"],["settings","⚙️ Impostazioni"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ background: tab===id ? "#6366f1" : "transparent", border: "none", borderRadius: "8px 8px 0 0", padding: "8px 20px", color: tab===id ? "#fff" : "#6b7280", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>{label}</button>
        ))}
      </div>

      <div style={{ padding: "24px 28px", maxWidth: 900, margin: "0 auto" }}>

        {tab === "dashboard" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Obiettivi</div>
              <button onClick={() => setShowGoalForm(!showGoalForm)} style={btn()}>+ Nuovo obiettivo</button>
            </div>
            {showGoalForm && (
              <Card>
                <div style={{ fontWeight: 600, marginBottom: 14 }}>Nuovo obiettivo</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div><span style={lbl}>Nome</span><input style={inp} placeholder="es. Bambu Lab A1" value={newGoal.name} onChange={e => setNewGoal(g => ({ ...g, name: e.target.value }))} /></div>
                  <div><span style={lbl}>Importo (CHF)</span><input style={inp} type="number" placeholder="350" value={newGoal.target} onChange={e => setNewGoal(g => ({ ...g, target: e.target.value }))} /></div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {COLORS.map(c => <div key={c} onClick={() => setNewGoal(g => ({ ...g, color: c }))} style={{ width: 28, height: 28, borderRadius: "50%", background: c, cursor: "pointer", border: newGoal.color===c ? "3px solid #fff" : "3px solid transparent" }} />)}
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={addGoal} style={btn()}>Salva</button>
                    <button onClick={() => setShowGoalForm(false)} style={btn("#374151")}>Annulla</button>
                  </div>
                </div>
              </Card>
            )}
            {goals.length === 0 && !showGoalForm && <Card><div style={{ color: "#6b7280", textAlign: "center", padding: "20px 0" }}>Nessun obiettivo ancora.</div></Card>}
            {goals.map(g => {
              const saved = savingsByGoal[g.id] || 0;
              const pct   = g.target > 0 ? Math.min(100, (saved / g.target) * 100) : 0;
              return (
                <Card key={g.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{g.name}</div>
                      <div style={{ fontSize: 13, color: "#6b7280" }}>Obiettivo: {formatCHF(g.target)}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 800, fontSize: 20, color: g.color }}>{formatCHF(saved)}</div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>{pct.toFixed(1)}%</div>
                    </div>
                  </div>
                  <ProgressBar value={saved} max={g.target} color={g.color} />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12, color: "#6b7280" }}>
                    <span>Mancano {formatCHF(Math.max(0, g.target - saved))}</span>
                    <button onClick={() => saveGoals(goals.filter(x => x.id !== g.id))} style={{ background: "none", border: "none", color: "#f43f5e", cursor: "pointer", fontSize: 12 }}>Elimina</button>
                  </div>
                </Card>
              );
            })}
            {unallocated > 0 && (
              <Card style={{ borderLeft: "3px solid #f59e0b" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div><div style={{ fontWeight: 600 }}>Non assegnato</div><div style={{ fontSize: 12, color: "#6b7280" }}>Risparmio senza obiettivo</div></div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: "#f59e0b" }}>{formatCHF(unallocated)}</div>
                </div>
              </Card>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              {[
                { label: "Stampe totali",    value: prints.length,                                                    icon: "🖨️" },
                { label: "Risparmio medio",  value: prints.length ? formatCHF(totalSaved/prints.length) : "CHF 0.00", icon: "📊" },
                { label: "Obiettivi attivi", value: goals.length,                                                     icon: "🎯" },
              ].map(s => (
                <Card key={s.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 24 }}>{s.icon}</div>
                  <div style={{ fontWeight: 800, fontSize: 18, marginTop: 4 }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>{s.label}</div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {tab === "prints" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Storico stampe</div>
              <button onClick={() => setShowPrintForm(!showPrintForm)} style={btn()}>+ Aggiungi stampa</button>
            </div>
            {showPrintForm && (
              <Card>
                <div style={{ fontWeight: 600, marginBottom: 14 }}>Nuova stampa</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div><span style={lbl}>Nome oggetto</span><input style={inp} placeholder="es. supporto monitor" value={newPrint.name} onChange={e => setNewPrint(p => ({ ...p, name: e.target.value }))} /></div>
                    <div><span style={lbl}>Data</span><input style={inp} type="date" value={newPrint.date} onChange={e => setNewPrint(p => ({ ...p, date: e.target.value }))} /></div>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => setNewPrint(p => ({ ...p, type: "purchase" }))} style={{ ...btn(newPrint.type==="purchase" ? "#6366f1" : "#374151"), flex: 1 }}>🛒 Risparmio acquisto</button>
                    <button onClick={() => setNewPrint(p => ({ ...p, type: "time"     }))} style={{ ...btn(newPrint.type==="time"     ? "#6366f1" : "#374151"), flex: 1 }}>⏱ Risparmio tempo</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    <div>
                      <span style={lbl}>Materiale</span>
                      <select style={inp} value={newPrint.materialId} onChange={e => setNewPrint(p => ({ ...p, materialId: e.target.value }))}>
                        {settings.materials.map(m => <option key={m.id} value={m.id}>{m.name} — {formatCHF(m.costPerKg)}/kg</option>)}
                      </select>
                    </div>
                    <div><span style={lbl}>Peso (g)</span><input style={inp} type="number" placeholder="0" value={newPrint.weightG} onChange={e => setNewPrint(p => ({ ...p, weightG: e.target.value }))} /></div>
                    <div><span style={lbl}>Tempo stampa (h)</span><input style={inp} type="number" placeholder="0" value={newPrint.hours} onChange={e => setNewPrint(p => ({ ...p, hours: e.target.value }))} /></div>
                  </div>
                  {newPrint.type === "purchase" ? (
                    <div><span style={lbl}>Prezzo di mercato (CHF)</span><input style={inp} type="number" placeholder="0" value={newPrint.marketPrice} onChange={e => setNewPrint(p => ({ ...p, marketPrice: e.target.value }))} /></div>
                  ) : (
                    <div>
                      <span style={lbl}>Tempo risparmiato</span>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <input style={inp} type="number" min="0" placeholder="Ore" value={newPrint.savedHours} onChange={e => setNewPrint(p => ({ ...p, savedHours: e.target.value }))} />
                        <input style={inp} type="number" min="0" max="59" placeholder="Minuti" value={newPrint.savedMinutes} onChange={e => setNewPrint(p => ({ ...p, savedMinutes: e.target.value }))} />
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>Tariffa: {formatCHF(settings.hourlyRate)}/h</div>
                    </div>
                  )}
                  {saving > 0 && (
                    <div style={{ background: "#10b98122", borderRadius: 10, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "#10b981", fontWeight: 600 }}>Risparmio calcolato</span>
                      <span style={{ color: "#10b981", fontWeight: 800, fontSize: 18 }}>{formatCHF(saving)}</span>
                    </div>
                  )}
                  <div>
                    <span style={lbl}>Obiettivo (opzionale)</span>
                    <select style={inp} value={newPrint.goalId} onChange={e => setNewPrint(p => ({ ...p, goalId: e.target.value }))}>
                      <option value="">— Nessun obiettivo —</option>
                      {goals.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={addPrint} style={btn()}>Salva</button>
                    <button onClick={() => setShowPrintForm(false)} style={btn("#374151")}>Annulla</button>
                  </div>
                </div>
              </Card>
            )}
            {prints.length === 0 && <Card><div style={{ color: "#6b7280", textAlign: "center", padding: "20px 0" }}>Nessuna stampa registrata.</div></Card>}
            {[...prints].reverse().map(p => {
              const goal = goals.find(g => g.id === p.goalId);
              return (
                <Card key={p.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>{p.date} · {p.type==="purchase" ? "🛒 Acquisto" : "⏱ Tempo"}</div>
                      {p.type==="purchase" && <div style={{ fontSize: 12, color: "#6b7280" }}>{p.details.material} · {p.details.weightG}g · {p.details.hours}h · costo {formatCHF(p.details.printCost)}</div>}
                      {p.type==="time"     && <div style={{ fontSize: 12, color: "#6b7280" }}>{p.details.material ? `${p.details.material} · ${p.details.weightG}g · ` : ""}risparmio {(p.details.savedHours ?? p.details.hours ?? 0).toFixed(2)}h × {formatCHF(p.details.rate)}/h</div>}
                      {goal && <Badge color={goal.color}>{goal.name}</Badge>}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 18, color: "#10b981", whiteSpace: "nowrap" }}>{formatCHF(p.saving)}</div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {tab === "stats" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {prints.length === 0 ? (
              <Card><div style={{ color: "#6b7280", textAlign: "center", padding: "30px 0" }}>Aggiungi stampe per vedere le statistiche.</div></Card>
            ) : (
              <>
                <Card>
                  <div style={{ fontWeight: 700, marginBottom: 16 }}>📅 Risparmio mensile (CHF)</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={monthlyData}>
                      <XAxis dataKey="month" stroke="#6b7280" tick={{ fontSize: 12 }} />
                      <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} />
                      <Tooltip formatter={v => formatCHF(v)} contentStyle={{ background: "#1e1e2e", border: "1px solid #3a3a5e", borderRadius: 8 }} />
                      <Bar dataKey="saving" fill="#6366f1" radius={[6,6,0,0]} name="Risparmio" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
                {typeData.length > 0 && (
                  <Card>
                    <div style={{ fontWeight: 700, marginBottom: 16 }}>🔍 Tipo di risparmio</div>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                          {typeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={v => formatCHF(v)} contentStyle={{ background: "#1e1e2e", border: "1px solid #3a3a5e", borderRadius: 8 }} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </Card>
                )}
                {goalChartData.length > 0 && (
                  <Card>
                    <div style={{ fontWeight: 700, marginBottom: 16 }}>🎯 Avanzamento obiettivi (CHF)</div>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={goalChartData} layout="vertical">
                        <XAxis type="number" stroke="#6b7280" tick={{ fontSize: 12 }} />
                        <YAxis type="category" dataKey="name" stroke="#6b7280" tick={{ fontSize: 12 }} width={100} />
                        <Tooltip formatter={v => formatCHF(v)} contentStyle={{ background: "#1e1e2e", border: "1px solid #3a3a5e", borderRadius: 8 }} />
                        <Bar dataKey="salvato"   name="Salvato"   fill="#10b981" radius={[0,6,6,0]} />
                        <Bar dataKey="obiettivo" name="Obiettivo" fill="#374151" radius={[0,6,6,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                )}
                <Card>
                  <div style={{ fontWeight: 700, marginBottom: 14 }}>🏆 Top 5 risparmi</div>
                  {[...prints].sort((a,b) => b.saving - a.saving).slice(0,5).map((p,i) => (
                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i<4 ? "1px solid #2a2a4e" : "none" }}>
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <span style={{ color: ["#f59e0b","#9ca3af","#cd7c2f","#6b7280","#6b7280"][i], fontWeight: 800 }}>#{i+1}</span>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                          <div style={{ fontSize: 12, color: "#6b7280" }}>{p.date}</div>
                        </div>
                      </div>
                      <div style={{ fontWeight: 800, color: "#10b981" }}>{formatCHF(p.saving)}</div>
                    </div>
                  ))}
                </Card>
              </>
            )}
          </div>
        )}

        {tab === "settings" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <Card>
              <div style={{ fontWeight: 700, marginBottom: 16 }}>💰 Tariffe generali</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <span style={lbl}>Tariffa oraria (CHF/h)</span>
                  <input style={inp} type="number" value={settings.hourlyRate} onChange={e => saveSettings({ ...settings, hourlyRate: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <span style={lbl}>Elettricità (CHF/h di stampa)</span>
                  <input style={inp} type="number" step="0.001" value={settings.electricityCost} onChange={e => saveSettings({ ...settings, electricityCost: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
            </Card>
            <Card>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>🧵 Materiali (CHF/kg)</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 14 }}>Trascina ≡ per riordinare</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {settings.materials.map((m, i) => (
                  <div key={m.id} draggable onDragStart={() => onDragStart(i)} onDragOver={e => onDragOver(e, i)} onDragEnd={onDragEnd}
                    style={{ display: "flex", gap: 10, alignItems: "center", opacity: dragIdx===i ? 0.5 : 1, cursor: "grab" }}>
                    <span style={{ color: "#6b7280", fontSize: 18, userSelect: "none" }}>≡</span>
                    <input style={{ ...inp, width: 90 }} value={m.name} onChange={e => {
                      const mats = [...settings.materials]; mats[i] = { ...m, name: e.target.value }; saveSettings({ ...settings, materials: mats });
                    }} />
                    <input style={{ ...inp, width: 110 }} type="number" step="0.1" value={m.costPerKg} onChange={e => {
                      const mats = [...settings.materials]; mats[i] = { ...m, costPerKg: parseFloat(e.target.value) || 0 }; saveSettings({ ...settings, materials: mats });
                    }} />
                    <button onClick={() => saveSettings({ ...settings, materials: settings.materials.filter((_,j) => j !== i) })}
                      style={{ background: "none", border: "none", color: "#f43f5e", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: "0 4px" }}>×</button>
                  </div>
                ))}
                <button onClick={() => saveSettings({ ...settings, materials: [...settings.materials, { id: Date.now().toString(), name: "Nuovo", costPerKg: 20 }] })}
                  style={{ ...btn("#374151"), alignSelf: "flex-start", marginTop: 4 }}>+ Aggiungi materiale</button>
              </div>
            </Card>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Le modifiche vengono salvate automaticamente.</div>
          </div>
        )}

      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);