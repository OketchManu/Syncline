import { useState, useEffect, useCallback, useRef } from "react";
import {
  Building2, CheckCircle2, AlertCircle, ChevronRight, ChevronLeft,
  Globe, Users, Upload, X, Edit2,
  Sparkles, Lock, Check, ArrowRight, Copy, LogOut, Zap, Sun, Moon
} from "lucide-react";

// ─── Persistence helpers ──────────────────────────────────────────────────────
const STORAGE_KEY = "company-onboarding-v1";

const saveState = async (data) => {
  try {
    await window.storage.set(STORAGE_KEY, JSON.stringify(data));
  } catch (_) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (_) {}
  }
};

const loadState = async () => {
  try {
    const result = await window.storage.get(STORAGE_KEY);
    if (result?.value) return JSON.parse(result.value);
  } catch (_) {
    try {
      const local = localStorage.getItem(STORAGE_KEY);
      if (local) return JSON.parse(local);
    } catch (_) {}
  }
  return null;
};

// ─── Mock Auth Context ────────────────────────────────────────────────────────
const useAuth = () => {
  const [user, setUser] = useState({
    id: "user-1", name: "Alex Johnson", email: "alex@example.com",
    role: "owner", company_id: null,
  });
  const updateUser = useCallback((updates) => setUser((u) => ({ ...u, ...updates })), []);
  return { user, updateUser };
};

// ─── Mock API ─────────────────────────────────────────────────────────────────
const mockDB = { company: null };

const mockFetch = async (url, options = {}) => {
  await new Promise((r) => setTimeout(r, 600 + Math.random() * 300));
  const method = options.method || "GET";
  let body = null;
  if (options.body) {
    if (typeof options.body === "string") {
      try { body = JSON.parse(options.body); } catch (_) {}
    } else if (options.body instanceof FormData) {
      body = Object.fromEntries(options.body.entries());
    }
  }
  if (url.includes("/join")) {
    const code = body?.invite_code?.trim().toUpperCase();
    if (!mockDB.company || mockDB.company.invite_code !== code)
      return { ok: false, json: async () => ({ error: "Invalid or expired invite code" }) };
    mockDB.company.member_count = (mockDB.company.member_count || 1) + 1;
    return { ok: true, json: async () => ({ company: { ...mockDB.company } }) };
  }
  if (url === "/api/company" && method === "GET") {
    if (!mockDB.company) return { ok: false, json: async () => ({ error: "Not found" }) };
    return { ok: true, json: async () => ({ company: { ...mockDB.company } }) };
  }
  if (url === "/api/company" && method === "POST") {
    const id = "co-" + Math.random().toString(36).slice(2, 8);
    const inv = (body?.name?.slice(0, 4).toUpperCase().replace(/[^A-Z]/g, "X") || "COMP") + "-" +
      Math.random().toString(36).slice(2, 6).toUpperCase();
    mockDB.company = { id, ...body, invite_code: inv, member_count: 1 };
    return { ok: true, json: async () => ({ company: { ...mockDB.company } }) };
  }
  if (method === "PUT") {
    mockDB.company = { ...mockDB.company, ...body };
    return { ok: true, json: async () => ({ company: { ...mockDB.company } }) };
  }
  return { ok: false, json: async () => ({ error: "Unknown route" }) };
};

// ─── Theme tokens ─────────────────────────────────────────────────────────────
const DARK = {
  bg:           "#06080f",
  surface:      "#0c1018",
  card:         "rgba(255,255,255,0.03)",
  border:       "rgba(255,255,255,0.07)",
  borderHi:     "rgba(255,255,255,0.14)",
  text:         "#e8edf5",
  muted:        "#3a4558",
  subtle:       "#6b7a94",
  inputBg:      "rgba(255,255,255,0.04)",
  accent:       "#6366f1",
  accentBg:     "rgba(99,102,241,0.1)",
  accentBorder: "rgba(99,102,241,0.3)",
  accentText:   "#a5b4fc",
  accentGlow:   "rgba(99,102,241,0.2)",
  green:        "#34d399",
  greenBg:      "rgba(52,211,153,0.08)",
  greenBorder:  "rgba(52,211,153,0.25)",
  red:          "#f87171",
  redBg:        "rgba(248,113,113,0.07)",
  redBorder:    "rgba(248,113,113,0.22)",
  amber:        "#fbbf24",
  amberBg:      "rgba(251,191,36,0.07)",
  amberBorder:  "rgba(251,191,36,0.22)",
  shadowLg:     "0 16px 48px rgba(0,0,0,0.6)",
  bannerBg:     "linear-gradient(135deg, #312e81 0%, #4c1d95 40%, #0e7490 100%)",
  bannerDot:    "rgba(255,255,255,0.06)",
  logoBorder:   null, // computed from surface
};

const LIGHT = {
  bg:           "#f0f2f8",
  surface:      "#ffffff",
  card:         "rgba(0,0,0,0.02)",
  border:       "rgba(0,0,0,0.08)",
  borderHi:     "rgba(0,0,0,0.15)",
  text:         "#0f1623",
  muted:        "#b0bac9",
  subtle:       "#6b7a94",
  inputBg:      "rgba(0,0,0,0.03)",
  accent:       "#6366f1",
  accentBg:     "rgba(99,102,241,0.08)",
  accentBorder: "rgba(99,102,241,0.25)",
  accentText:   "#4f46e5",
  accentGlow:   "rgba(99,102,241,0.15)",
  green:        "#059669",
  greenBg:      "rgba(5,150,105,0.07)",
  greenBorder:  "rgba(5,150,105,0.2)",
  red:          "#dc2626",
  redBg:        "rgba(220,38,38,0.06)",
  redBorder:    "rgba(220,38,38,0.18)",
  amber:        "#d97706",
  amberBg:      "rgba(217,119,6,0.06)",
  amberBorder:  "rgba(217,119,6,0.18)",
  shadowLg:     "0 16px 48px rgba(0,0,0,0.12)",
  bannerBg:     "linear-gradient(135deg, #4338ca 0%, #7c3aed 40%, #0891b2 100%)",
  bannerDot:    "rgba(255,255,255,0.1)",
  logoBorder:   null,
};

const INDUSTRIES = [
  "Technology","Healthcare","Finance","Education","Retail",
  "Manufacturing","Consulting","Media & Entertainment","Real Estate",
  "Logistics","Legal","Non-profit","Other",
];
const SIZES = [
  { value: "1-10",    label: "1–10",    sub: "Startup / Solo"  },
  { value: "11-50",   label: "11–50",   sub: "Growing team"    },
  { value: "51-200",  label: "51–200",  sub: "Scale-up"        },
  { value: "201-500", label: "201–500", sub: "Mid-size"        },
  { value: "500+",    label: "500+",    sub: "Enterprise"      },
];
const STEPS = [
  { id: 1, label: "Info"     },
  { id: 2, label: "Industry" },
  { id: 3, label: "Team"     },
  { id: 4, label: "Review"   },
];

// ─── Atoms ────────────────────────────────────────────────────────────────────
const Spinner = ({ size = 16, color }) => (
  <div style={{
    width: size, height: size, flexShrink: 0,
    border: `2px solid ${color}28`, borderTop: `2px solid ${color}`,
    borderRadius: "50%", animation: "spin 0.65s linear infinite",
  }} />
);

const Field = ({ label, hint, children, tk }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    {label && (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: tk.subtle, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {label}
        </label>
        {hint && <span style={{ fontSize: 11, color: tk.muted }}>{hint}</span>}
      </div>
    )}
    {children}
  </div>
);

const AlertBox = ({ type = "error", children, tk }) => {
  const map = {
    error:   [tk.redBg,   tk.redBorder,   tk.red],
    success: [tk.greenBg, tk.greenBorder, tk.green],
    warning: [tk.amberBg, tk.amberBorder, tk.amber],
  };
  const [bg, border, color] = map[type] || map.error;
  return (
    <div style={{
      background: bg, border: `1px solid ${border}`, color,
      padding: "11px 14px", borderRadius: 10, fontSize: 13,
      display: "flex", alignItems: "flex-start", gap: 9, lineHeight: 1.55,
    }}>
      {children}
    </div>
  );
};

const PrimaryBtn = ({ children, disabled, onClick, fullWidth, tk }) => (
  <button
    onClick={disabled ? undefined : onClick}
    disabled={disabled}
    style={{
      padding: "11px 22px",
      background: disabled ? tk.inputBg : `linear-gradient(135deg, ${tk.accent} 0%, #8b5cf6 100%)`,
      border: "none", borderRadius: 10,
      color: disabled ? tk.muted : "#fff",
      fontSize: 13, fontWeight: 600,
      cursor: disabled ? "not-allowed" : "pointer",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
      fontFamily: "inherit",
      boxShadow: disabled ? "none" : `0 4px 20px ${tk.accentGlow}`,
      transition: "all 0.2s",
      width: fullWidth ? "100%" : "auto",
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </button>
);

const GhostBtn = ({ children, disabled, onClick, tk }) => (
  <button
    onClick={disabled ? undefined : onClick}
    disabled={disabled}
    style={{
      padding: "11px 18px", background: "transparent",
      border: `1px solid ${tk.border}`, borderRadius: 10,
      color: disabled ? tk.muted : tk.subtle,
      fontSize: 13, fontWeight: 500,
      cursor: disabled ? "not-allowed" : "pointer",
      display: "flex", alignItems: "center", gap: 7,
      opacity: disabled ? 0.35 : 1,
      fontFamily: "inherit", transition: "all 0.15s",
    }}
  >
    {children}
  </button>
);

// ─── Logo Upload ──────────────────────────────────────────────────────────────
const LogoUploader = ({ preview, onChange, tk }) => {
  const ref = useRef();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
      {/* Fixed-size logo box — never overlaps content */}
      <div
        onClick={() => ref.current.click()}
        style={{
          width: 72, height: 72, borderRadius: 18, flexShrink: 0,
          background: preview ? "transparent" : tk.accentBg,
          border: `2px dashed ${preview ? "transparent" : tk.accentBorder}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden", cursor: "pointer", transition: "all 0.2s",
          boxShadow: preview ? `0 4px 16px ${tk.accentGlow}` : "none",
        }}
      >
        {preview
          ? <img src={preview} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <Building2 size={26} color={tk.accentText} />}
      </div>

      {/* Text + upload btn in normal flow — no absolute positioning */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: tk.text }}>Company Logo</p>
        <label style={{
          padding: "6px 13px", background: tk.accentBg, border: `1px solid ${tk.accentBorder}`,
          borderRadius: 8, color: tk.accentText, fontSize: 12, cursor: "pointer",
          fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 5, width: "fit-content",
        }}>
          <Upload size={11} /> {preview ? "Change image" : "Upload image"}
          <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={onChange} />
        </label>
        <p style={{ margin: 0, fontSize: 11, color: tk.muted }}>PNG, JPG or SVG · Shown on your company card</p>
      </div>

      {/* Remove button — only shown when there's a preview */}
      {preview && (
        <button
          onClick={() => onChange({ target: { files: [] } })}
          style={{
            flexShrink: 0, background: tk.redBg, border: `1px solid ${tk.redBorder}`,
            borderRadius: 8, color: tk.red, cursor: "pointer", padding: "6px 8px",
            display: "flex", alignItems: "center", transition: "all 0.15s",
          }}
          title="Remove logo"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
};

// ─── SetupWizard ──────────────────────────────────────────────────────────────
const SetupWizard = ({ existingCompany, onComplete, savedDraft, onDraftChange, tk }) => {
  const [step, setStep]    = useState(1);
  const [loading, setLoad] = useState(false);
  const [error, setError]  = useState(null);

  const [logoPreview, setLogoPreview] = useState(
    savedDraft?.logoPreview || existingCompany?.logo_preview || null
  );
  const [logoFile, setLogoFile] = useState(null);
  const [form, setForm] = useState({
    name:        savedDraft?.name        || existingCompany?.name        || "",
    description: savedDraft?.description || existingCompany?.description || "",
    website:     savedDraft?.website     || existingCompany?.website     || "",
    industry:    savedDraft?.industry    || existingCompany?.industry    || "",
    size:        savedDraft?.size        || existingCompany?.size        || "",
  });

  const inputStyle = {
    width: "100%", padding: "11px 14px", background: tk.inputBg,
    border: `1px solid ${tk.border}`, borderRadius: 10, fontSize: 13,
    color: tk.text, boxSizing: "border-box", outline: "none",
    fontFamily: "inherit", transition: "border-color 0.2s, box-shadow 0.2s",
  };

  const set = (k, v) => {
    const next = { ...form, [k]: v };
    setForm(next);
    onDraftChange?.({ ...next, logoPreview });
  };

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setLogoPreview(null); setLogoFile(null);
      onDraftChange?.({ ...form, logoPreview: null });
      return;
    }
    setLogoFile(file);
    const r = new FileReader();
    r.onload = (ev) => {
      setLogoPreview(ev.target.result);
      onDraftChange?.({ ...form, logoPreview: ev.target.result });
    };
    r.readAsDataURL(file);
  };

  const canNext = () => {
    if (step === 1) return form.name.trim().length >= 2;
    if (step === 2) return !!form.industry;
    if (step === 3) return !!form.size;
    return true;
  };

  const handleSubmit = async () => {
    setLoad(true); setError(null);
    try {
      let body;
      if (logoFile) {
        body = new FormData();
        Object.entries(form).forEach(([k, v]) => v && body.append(k, v));
        body.append("logo", logoFile);
      } else {
        body = JSON.stringify({ ...form, logo_preview: logoPreview });
      }
      const method = existingCompany ? "PUT" : "POST";
      const url    = existingCompany ? `/api/company/${existingCompany.id}` : "/api/company";
      const res    = await mockFetch(url, { method, body });
      const data   = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      const c = data.company || data;
      if (logoPreview) c.logo_preview = logoPreview;
      onDraftChange?.(null);
      onComplete(c);
    } catch (err) {
      setError(err.message);
      setLoad(false);
    }
  };

  const goBack = () => { setStep((s) => s - 1); setError(null); };

  return (
    <div>
      {/* Step progress */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 32 }}>
        {STEPS.map((s, i) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "none" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: step > s.id ? tk.green : step === s.id ? tk.accent : "transparent",
                border: `2px solid ${step > s.id ? tk.green : step === s.id ? tk.accent : tk.border}`,
                color: step > s.id ? "#fff" : step === s.id ? "#fff" : tk.muted,
                transition: "all 0.3s", flexShrink: 0, fontSize: 11, fontWeight: 700,
              }}>
                {step > s.id ? <Check size={13} /> : s.id}
              </div>
              <span style={{
                fontSize: 10, fontWeight: step === s.id ? 700 : 400,
                color: step === s.id ? tk.accentText : tk.muted,
                whiteSpace: "nowrap", letterSpacing: "0.04em",
              }}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{
                flex: 1, height: 1,
                background: step > s.id ? `${tk.green}60` : tk.border,
                margin: "0 8px", marginBottom: 18, transition: "background 0.3s",
              }} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div style={{ minHeight: 290 }}>
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ marginBottom: 4 }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: tk.text }}>Company details</h3>
              <p style={{ margin: 0, fontSize: 13, color: tk.subtle }}>This information is visible to all team members.</p>
            </div>
            <LogoUploader preview={logoPreview} onChange={handleLogoChange} tk={tk} />
            <div style={{ height: 1, background: tk.border }} />
            <Field label="Company Name" hint="Required" tk={tk}>
              <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)}
                placeholder="Acme Corp" style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = tk.accentBorder; e.target.style.boxShadow = `0 0 0 3px ${tk.accentGlow}`; }}
                onBlur={(e)  => { e.target.style.borderColor = tk.border; e.target.style.boxShadow = "none"; }} />
            </Field>
            <Field label="Description" hint="Optional" tk={tk}>
              <textarea value={form.description} onChange={(e) => set("description", e.target.value)}
                placeholder="What does your company do? Keep it short and clear."
                rows={3} style={{ ...inputStyle, resize: "vertical" }}
                onFocus={(e) => { e.target.style.borderColor = tk.accentBorder; e.target.style.boxShadow = `0 0 0 3px ${tk.accentGlow}`; }}
                onBlur={(e)  => { e.target.style.borderColor = tk.border; e.target.style.boxShadow = "none"; }} />
            </Field>
            <Field label="Website" hint="Optional" tk={tk}>
              <div style={{ position: "relative" }}>
                <Globe size={13} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: tk.subtle, pointerEvents: "none" }} />
                <input type="url" value={form.website} onChange={(e) => set("website", e.target.value)}
                  placeholder="https://yourcompany.com" style={{ ...inputStyle, paddingLeft: 34 }}
                  onFocus={(e) => { e.target.style.borderColor = tk.accentBorder; e.target.style.boxShadow = `0 0 0 3px ${tk.accentGlow}`; }}
                  onBlur={(e)  => { e.target.style.borderColor = tk.border; e.target.style.boxShadow = "none"; }} />
              </div>
            </Field>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ marginBottom: 4 }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: tk.text }}>Your industry</h3>
              <p style={{ margin: 0, fontSize: 13, color: tk.subtle }}>Helps us tailor features to your workflow.</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7 }}>
              {INDUSTRIES.map((ind) => {
                const active = form.industry === ind;
                return (
                  <button key={ind} onClick={() => set("industry", ind)} style={{
                    padding: "10px", background: active ? tk.accentBg : tk.card,
                    border: `1px solid ${active ? tk.accentBorder : tk.border}`,
                    borderRadius: 10, color: active ? tk.accentText : tk.subtle,
                    fontSize: 12, fontWeight: active ? 600 : 400,
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
                    transition: "all 0.15s", textAlign: "left", fontFamily: "inherit",
                  }}>
                    {active && <Check size={10} style={{ flexShrink: 0 }} />}{ind}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ marginBottom: 4 }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: tk.text }}>Team size</h3>
              <p style={{ margin: 0, fontSize: 13, color: tk.subtle }}>Helps us set the right defaults for your plan.</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {SIZES.map((sz) => {
                const active = form.size === sz.value;
                return (
                  <button key={sz.value} onClick={() => set("size", sz.value)} style={{
                    display: "flex", alignItems: "center", gap: 14, padding: "13px 16px",
                    background: active ? tk.accentBg : tk.card,
                    border: `1px solid ${active ? tk.accentBorder : tk.border}`,
                    borderRadius: 11, cursor: "pointer", transition: "all 0.15s", fontFamily: "inherit",
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: active ? `${tk.accent}22` : tk.inputBg,
                      border: `1px solid ${active ? tk.accentBorder : tk.border}`,
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: active ? tk.accentText : tk.subtle }}>{sz.value}</span>
                    </div>
                    <div style={{ flex: 1, textAlign: "left" }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: active ? 600 : 500, color: tk.text }}>{sz.label} employees</p>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: tk.subtle }}>{sz.sub}</p>
                    </div>
                    {active && <Check size={14} color={tk.accentText} />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 4 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ marginBottom: 4 }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: tk.text }}>Review & confirm</h3>
              <p style={{ margin: 0, fontSize: 13, color: tk.subtle }}>
                Double-check everything before {existingCompany ? "saving changes" : "creating your company"}.
              </p>
            </div>
            <div style={{ background: tk.card, border: `1px solid ${tk.border}`, borderRadius: 14, overflow: "hidden" }}>
              <div style={{ padding: "16px 18px", borderBottom: `1px solid ${tk.border}`, display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14, overflow: "hidden",
                  background: tk.accentBg, border: `1px solid ${tk.accentBorder}`,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  {logoPreview
                    ? <img src={logoPreview} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <Building2 size={20} color={tk.accentText} />}
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: tk.text }}>{form.name || "—"}</p>
                  {form.website && (
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: tk.accentText }}>
                      {form.website.replace(/^https?:\/\//, "")}
                    </p>
                  )}
                </div>
              </div>
              {[
                { label: "Industry",    value: form.industry || "—" },
                { label: "Team Size",   value: SIZES.find((s) => s.value === form.size)?.label ? `${SIZES.find((s) => s.value === form.size).label} employees` : "—" },
                { label: "Description", value: form.description || "—" },
              ].map((row, i, arr) => (
                <div key={i} style={{
                  display: "flex", padding: "11px 18px",
                  borderBottom: i < arr.length - 1 ? `1px solid ${tk.border}` : "none", gap: 12,
                }}>
                  <span style={{ flex: "0 0 100px", fontSize: 11, color: tk.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", paddingTop: 1 }}>
                    {row.label}
                  </span>
                  <span style={{ flex: 1, fontSize: 13, color: row.value === "—" ? tk.muted : tk.text, lineHeight: 1.5 }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
            {error && (
              <AlertBox type="error" tk={tk}>
                <AlertCircle size={14} style={{ flexShrink: 0 }} /> {error}
              </AlertBox>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginTop: 28, paddingTop: 20, borderTop: `1px solid ${tk.border}`,
      }}>
        <GhostBtn disabled={step === 1} onClick={goBack} tk={tk}><ChevronLeft size={14} /> Back</GhostBtn>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, color: tk.muted }}>{step} of {STEPS.length}</span>
          {step < 4
            ? <PrimaryBtn disabled={!canNext()} onClick={() => setStep((s) => s + 1)} tk={tk}>
                Continue <ChevronRight size={14} />
              </PrimaryBtn>
            : <PrimaryBtn disabled={loading} onClick={handleSubmit} tk={tk}>
                {loading
                  ? <><Spinner size={13} color="#fff" /> Saving…</>
                  : <><Sparkles size={13} /> {existingCompany ? "Save Changes" : "Create Company"}</>}
              </PrimaryBtn>}
        </div>
      </div>
    </div>
  );
};

// ─── JoinCompany ──────────────────────────────────────────────────────────────
const JoinCompany = ({ onJoined, tk }) => {
  const [code, setCode]    = useState("");
  const [loading, setLoad] = useState(false);
  const [error, setError]  = useState(null);

  const inputStyle = {
    width: "100%", padding: "11px 14px", background: tk.inputBg,
    border: `1px solid ${tk.border}`, borderRadius: 10, fontSize: 13,
    color: tk.text, boxSizing: "border-box", outline: "none",
    fontFamily: "inherit", transition: "border-color 0.2s, box-shadow 0.2s",
  };

  const handleJoin = async () => {
    if (code.trim().length < 4) { setError("Enter a valid invite code"); return; }
    setLoad(true); setError(null);
    try {
      const res  = await mockFetch("/api/company/join", { method: "POST", body: JSON.stringify({ invite_code: code.trim().toUpperCase() }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid invite code");
      onJoined(data.company);
    } catch (err) {
      setError(err.message);
      setLoad(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: tk.text }}>Join with invite code</h3>
        <p style={{ margin: 0, fontSize: 13, color: tk.subtle }}>Ask your company admin to share their invite code with you.</p>
      </div>
      <div style={{ padding: 18, background: tk.card, border: `1px solid ${tk.border}`, borderRadius: 12, display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Invite Code" tk={tk}>
          <input
            type="text" value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            placeholder="e.g. ACME-X7K2" maxLength={12}
            style={{ ...inputStyle, fontSize: 18, fontFamily: "monospace", letterSpacing: "0.12em", textAlign: "center", fontWeight: 700 }}
            onFocus={(e) => { e.target.style.borderColor = tk.accentBorder; e.target.style.boxShadow = `0 0 0 3px ${tk.accentGlow}`; }}
            onBlur={(e)  => { e.target.style.borderColor = tk.border; e.target.style.boxShadow = "none"; }}
          />
        </Field>
        <PrimaryBtn disabled={loading || !code.trim()} onClick={handleJoin} fullWidth tk={tk}>
          {loading
            ? <><Spinner size={13} color="#fff" /> Joining…</>
            : <><ArrowRight size={14} /> Join Company</>}
        </PrimaryBtn>
      </div>
      {error && (
        <AlertBox type="error" tk={tk}>
          <AlertCircle size={14} style={{ flexShrink: 0 }} /> {error}
        </AlertBox>
      )}
    </div>
  );
};

// ─── CompanyCard ──────────────────────────────────────────────────────────────
const CompanyCard = ({ company, canEdit, onEdit, onLeave, tk }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    try { navigator.clipboard.writeText(company.invite_code); } catch (_) {}
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  return (
    <div style={{ background: tk.surface, border: `1px solid ${tk.border}`, borderRadius: 20, overflow: "hidden" }}>
      {/* Banner */}
      <div style={{ height: 110, background: tk.bannerBg, position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: `radial-gradient(circle, ${tk.bannerDot} 1px, transparent 1px)`, backgroundSize: "20px 20px" }} />
        {canEdit && (
          <div style={{ position: "absolute", top: 16, right: 16 }}>
            <button onClick={onEdit} style={{
              padding: "7px 13px", background: "rgba(255,255,255,0.15)",
              backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: 9, color: "#fff",
              fontSize: 12, fontWeight: 500, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit",
            }}>
              <Edit2 size={11} /> Edit
            </button>
          </div>
        )}
      </div>

      <div style={{ padding: "0 24px 26px" }}>
        {/* Logo avatar — sits below banner, clear of text flow */}
        <div style={{
          width: 72, height: 72, borderRadius: 20,
          background: "linear-gradient(135deg, #312e81, #7c3aed)",
          border: `4px solid ${tk.surface}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          marginTop: -36, marginBottom: 14,
          overflow: "hidden", flexShrink: 0,
          boxShadow: "0 8px 28px rgba(55,48,163,0.45)",
          position: "relative", zIndex: 1,
        }}>
          {company.logo_preview
            ? <img src={company.logo_preview} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <Building2 size={28} color="#fff" />}
        </div>

        {/* Name + website — starts AFTER logo in normal flow */}
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800, color: tk.text, letterSpacing: "-0.02em" }}>
            {company.name}
          </h2>
          {company.website && (
            <a href={company.website} target="_blank" rel="noreferrer"
              style={{ fontSize: 12, color: tk.accentText, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Globe size={11} />{company.website.replace(/^https?:\/\//, "")}
            </a>
          )}
          {company.description && (
            <p style={{ margin: "10px 0 0", fontSize: 13, color: tk.subtle, lineHeight: 1.7 }}>{company.description}</p>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 16 }}>
          {[
            { label: "Industry",  value: company.industry    || "—" },
            { label: "Team Size", value: company.size        || "—" },
            { label: "Members",   value: company.member_count ?? "—" },
          ].map((item, i) => (
            <div key={i} style={{ padding: "13px 10px", background: tk.card, border: `1px solid ${tk.border}`, borderRadius: 12, textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: tk.text }}>{item.value}</p>
              <p style={{ margin: "3px 0 0", fontSize: 10, color: tk.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{item.label}</p>
            </div>
          ))}
        </div>

        {/* Invite code */}
        {company.invite_code && (
          <div style={{
            padding: "14px 16px", background: tk.accentBg, border: `1px solid ${tk.accentBorder}`,
            borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12,
          }}>
            <div>
              <p style={{ margin: 0, fontSize: 10, color: tk.subtle, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                Invite Code
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 19, fontWeight: 800, color: tk.accentText, fontFamily: "monospace", letterSpacing: "0.14em" }}>
                {company.invite_code}
              </p>
            </div>
            <button onClick={copy} style={{
              padding: "8px 14px",
              background: copied ? tk.greenBg : "rgba(127,127,127,0.06)",
              border: `1px solid ${copied ? tk.greenBorder : tk.accentBorder}`,
              borderRadius: 9, color: copied ? tk.green : tk.accentText,
              fontSize: 12, cursor: "pointer", fontWeight: 600,
              display: "flex", alignItems: "center", gap: 5,
              fontFamily: "inherit", transition: "all 0.2s",
            }}>
              {copied ? <Check size={12} /> : <Copy size={12} />}{copied ? "Copied!" : "Copy"}
            </button>
          </div>
        )}

        {/* Leave */}
        <button
          onClick={onLeave}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = tk.redBorder; e.currentTarget.style.color = tk.red; e.currentTarget.style.background = tk.redBg; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = tk.border; e.currentTarget.style.color = tk.subtle; e.currentTarget.style.background = "transparent"; }}
          style={{
            width: "100%", padding: 10, background: "transparent",
            border: `1px solid ${tk.border}`, borderRadius: 10, color: tk.subtle,
            fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center",
            justifyContent: "center", gap: 7, fontFamily: "inherit", transition: "all 0.2s",
          }}
        >
          <LogOut size={12} /> Leave Company
        </button>
      </div>
    </div>
  );
};

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast = ({ toast, tk }) => {
  if (!toast) return null;
  const isErr = toast.type === "error";
  return (
    <div style={{
      position: "fixed", top: 20, right: 24, zIndex: 9999,
      background: tk.surface,
      border: `1px solid ${isErr ? tk.redBorder : tk.greenBorder}`,
      color: isErr ? tk.red : tk.green,
      padding: "13px 18px", borderRadius: 13, fontSize: 13, fontWeight: 500,
      display: "flex", alignItems: "center", gap: 8,
      boxShadow: tk.shadowLg,
      animation: "slideIn 0.25s ease",
    }}>
      {isErr ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}{toast.msg}
    </div>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function CompanyOnboarding({ dark: darkProp }) {
  const { user, updateUser } = useAuth();
  const [company,  setCompany]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [editing,  setEditing]  = useState(false);
  const [tab,      setTab]      = useState("create");
  const [toast,    setToast]    = useState(null);
  const [draft,    setDraft]    = useState(null);
  // dark mode: if parent passes `dark` prop use it, otherwise manage internally
  const [darkLocal, setDarkLocal] = useState(true);
  const dark = darkProp !== undefined ? darkProp : darkLocal;
  const tk   = dark ? DARK : LIGHT;

  const canEdit = ["owner", "admin"].includes(user?.role);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Load persisted state on mount ─────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const saved = await loadState();
      if (saved) {
        if (saved.company) {
          setCompany(saved.company);
          mockDB.company = saved.company;
          updateUser({ company_id: saved.company.id, role: saved.role || "owner" });
        }
        if (saved.tab)   setTab(saved.tab);
        if (saved.draft) setDraft(saved.draft);
      }
      setLoading(false);
    })();
  }, [updateUser]);

  // ── Persist on every relevant state change ────────────────────────────────
  // Company data is ALWAYS saved unless explicitly deleted by the owner
  useEffect(() => {
    if (loading) return;
    saveState({ company, tab, draft, role: user?.role });
  }, [company, tab, draft, loading, user?.role]);

  const handleComplete = (c) => {
    setCompany(c);
    setEditing(false);
    setDraft(null);
    updateUser({ company_id: c.id });
    showToast(editing ? "Company updated!" : "Company created! Welcome aboard 🎉");
  };

  const handleJoined = (c) => {
    setCompany(c);
    updateUser({ company_id: c.id, role: "member" });
    showToast("Successfully joined the company!");
  };

  // Only the owner/admin can delete — this clears persisted state permanently
  const handleLeave = () => {
    setCompany(null);
    mockDB.company = null;
    setDraft(null);
    updateUser({ company_id: null });
    saveState({ company: null, tab: "create", draft: null, role: "owner" });
    showToast("You've left the company.", "error");
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 14, background: tk.bg }}>
      <Spinner size={24} color={tk.accent} /><span style={{ color: tk.subtle, fontSize: 14 }}>Loading…</span>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: tk.bg, padding: "40px 20px 60px", fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif", transition: "background 0.25s" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(12px); } to { opacity: 1; transform: translateX(0); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${tk.border}; border-radius: 4px; }
        button:focus-visible { outline: 2px solid ${tk.accentBorder}; outline-offset: 2px; }
      `}</style>

      <Toast toast={toast} tk={tk} />

      <div style={{ maxWidth: 580, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 28, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 13,
              background: tk.accentBg, border: `1px solid ${tk.accentBorder}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, marginTop: 2,
            }}>
              <Zap size={18} color={tk.accentText} />
            </div>
            <div>
              <h1 style={{ margin: "0 0 3px", fontSize: 20, fontWeight: 800, color: tk.text, letterSpacing: "-0.02em" }}>
                {company ? "Company Workspace" : "Get started"}
              </h1>
              <p style={{ margin: 0, fontSize: 13, color: tk.subtle }}>
                {company
                  ? "Manage your company profile and invite team members."
                  : "Set up your company workspace or join an existing one."}
              </p>
            </div>
          </div>

          {/* Theme toggle — only shown when parent doesn't control dark prop */}
          {darkProp === undefined && (
            <button
              onClick={() => setDarkLocal((d) => !d)}
              title={dark ? "Switch to light mode" : "Switch to dark mode"}
              style={{
                flexShrink: 0, marginTop: 2,
                width: 36, height: 36, borderRadius: 10,
                background: tk.card, border: `1px solid ${tk.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: tk.subtle, transition: "all 0.2s",
              }}
            >
              {dark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          )}
        </div>

        {/* Main content */}
        {company && !editing ? (
          <CompanyCard company={company} canEdit={canEdit} onEdit={() => setEditing(true)} onLeave={handleLeave} tk={tk} />
        ) : editing ? (
          <div style={{ background: tk.surface, border: `1px solid ${tk.border}`, borderRadius: 20, padding: "26px 28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
              <div>
                <h2 style={{ margin: "0 0 2px", fontSize: 16, fontWeight: 700, color: tk.text }}>Edit Company</h2>
                <p style={{ margin: 0, fontSize: 12, color: tk.subtle }}>Changes are saved immediately.</p>
              </div>
              <button
                onClick={() => setEditing(false)}
                style={{ background: "transparent", border: `1px solid ${tk.border}`, borderRadius: 9, color: tk.subtle, cursor: "pointer", padding: 8, display: "flex", fontFamily: "inherit", transition: "all 0.15s" }}
              >
                <X size={14} />
              </button>
            </div>
            <SetupWizard existingCompany={company} onComplete={handleComplete} savedDraft={draft} onDraftChange={setDraft} tk={tk} />
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Tabs */}
            <div style={{ display: "flex", gap: 3, background: tk.surface, border: `1px solid ${tk.border}`, borderRadius: 13, padding: 5 }}>
              {[
                { id: "create", label: "Create Company", icon: <Building2 size={13} /> },
                { id: "join",   label: "Join Company",   icon: <Users size={13} /> },
              ].map((tb) => (
                <button key={tb.id} onClick={() => setTab(tb.id)} style={{
                  flex: 1, padding: "10px 18px",
                  background: tab === tb.id ? tk.accentBg : "transparent",
                  border: `1px solid ${tab === tb.id ? tk.accentBorder : "transparent"}`,
                  borderRadius: 9, color: tab === tb.id ? tk.accentText : tk.subtle,
                  fontSize: 13, fontWeight: tab === tb.id ? 600 : 400,
                  cursor: "pointer", transition: "all 0.18s", fontFamily: "inherit",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                }}>
                  {tb.icon}{tb.label}
                </button>
              ))}
            </div>

            {/* Panel */}
            <div style={{ background: tk.surface, border: `1px solid ${tk.border}`, borderRadius: 20, padding: "26px 28px" }}>
              {tab === "create"
                ? !user?.company_id
                  ? <SetupWizard onComplete={handleComplete} savedDraft={draft} onDraftChange={setDraft} tk={tk} />
                  : <AlertBox type="warning" tk={tk}><Lock size={14} style={{ flexShrink: 0 }} /> You already belong to a company. Contact your admin to make changes.</AlertBox>
                : <JoinCompany onJoined={handleJoined} tk={tk} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}