import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  Building2, CheckCircle2, AlertCircle, ChevronRight, ChevronLeft,
  Globe, Users, Upload, X, Edit2,
  Sparkles, Lock, Check, ArrowRight, Copy, Zap, Sun, Moon,
  RefreshCw, UserPlus, Shield, Briefcase, UserCheck, Trash2
} from "lucide-react";

// ─── API helpers ──────────────────────────────────────────────────────────────
const API_BASE = "https://syncline-1.onrender.com";

const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
});

const authHeadersMultipart = () => ({
  Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
});

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

const ROLE_META = {
  admin:   { icon: Shield,    color: "#6366f1", label: "Admin"   },
  manager: { icon: Briefcase, color: "#f59e0b", label: "Manager" },
  member:  { icon: UserCheck, color: "#10b981", label: "Member"  },
};

// ─── Atoms ────────────────────────────────────────────────────────────────────
const Spinner = ({ size = 16, color = "#6366f1" }) => (
  <div style={{
    width: size, height: size, flexShrink: 0,
    border: `2px solid ${color}28`, borderTop: `2px solid ${color}`,
    borderRadius: "50%", animation: "spin 0.65s linear infinite",
  }} />
);

const Avatar = ({ name, avatar, size = 36, tk }) => {
  const initials = (name || "?").split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase();
 const API_ORIGIN = import.meta.env.VITE_API_URL || 'https://syncline-1.onrender.com';
const avatarSrc = avatar?.startsWith("http") ? avatar : avatar ? `${API_ORIGIN}${avatar}` : null;
  return avatarSrc
    ? <img src={avatarSrc} alt={name} style={{ width: size, height: size, borderRadius: size / 2.5, objectFit: "cover", flexShrink: 0 }} />
    : (
      <div style={{
        width: size, height: size, borderRadius: size / 2.5, flexShrink: 0,
        background: tk.accentBg, border: `1px solid ${tk.accentBorder}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.36, fontWeight: 700, color: tk.accentText,
      }}>
        {initials}
      </div>
    );
};

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
    info:    [tk.accentBg, tk.accentBorder, tk.accentText],
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
      boxShadow: tk.shadowLg, animation: "slideIn 0.25s ease",
    }}>
      {isErr ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}{toast.msg}
    </div>
  );
};

const CopyRow = ({ label, value, mono, tk }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    try { navigator.clipboard.writeText(value); } catch (_) {}
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };
  return (
    <div style={{
      padding: "14px 16px", background: tk.accentBg, border: `1px solid ${tk.accentBorder}`,
      borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 10, color: tk.subtle, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>
          {label}
        </p>
        <p style={{
          margin: "4px 0 0", fontSize: mono ? 19 : 12, fontWeight: mono ? 800 : 500,
          color: tk.accentText, fontFamily: mono ? "monospace" : "inherit",
          letterSpacing: mono ? "0.14em" : "normal", wordBreak: "break-all",
        }}>
          {value || "—"}
        </p>
      </div>
      <button onClick={copy} style={{
        flexShrink: 0, padding: "8px 14px",
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
  );
};

// ─── Logo Upload ──────────────────────────────────────────────────────────────
const LogoUploader = ({ preview, onChange, tk }) => {
  const ref = useRef();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
      <div onClick={() => ref.current.click()} style={{
        width: 72, height: 72, borderRadius: 18, flexShrink: 0,
        background: preview ? "transparent" : tk.accentBg,
        border: `2px dashed ${preview ? "transparent" : tk.accentBorder}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden", cursor: "pointer", transition: "all 0.2s",
        boxShadow: preview ? `0 4px 16px ${tk.accentGlow}` : "none",
      }}>
        {preview
          ? <img src={preview} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <Building2 size={26} color={tk.accentText} />}
      </div>
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
      {preview && (
        <button onClick={() => onChange({ target: { files: [] } })} style={{
          flexShrink: 0, background: tk.redBg, border: `1px solid ${tk.redBorder}`,
          borderRadius: 8, color: tk.red, cursor: "pointer", padding: "6px 8px",
          display: "flex", alignItems: "center", transition: "all 0.15s",
        }}>
          <X size={13} />
        </button>
      )}
    </div>
  );
};

// ─── SetupWizard ──────────────────────────────────────────────────────────────
// When opened from the Edit button, if the company already has name+industry
// (saved at registration), we show a compact editor:
//   • Logo upload (primary — this is what they're here for)
//   • Editable fields pre-filled from registration
// If the company has NO details yet, the full 4-step wizard is shown instead.
const SetupWizard = ({ existingCompany, onComplete, tk }) => {
  const hasCore = !!(existingCompany?.name && existingCompany?.industry);
  const [step, setStep]   = useState(hasCore ? 0 : 1); // 0 = compact, 1-4 = wizard
  const [saving, setSave] = useState(false);
  const [error, setError] = useState(null);

  const [logoPreview, setLogoPreview] = useState(existingCompany?.logo_url || null);
  const [logoFile, setLogoFile]       = useState(null);
  const [form, setForm] = useState({
    name:        existingCompany?.name        || "",
    description: existingCompany?.description || "",
    website:     existingCompany?.website     || "",
    industry:    existingCompany?.industry    || "",
    size:        existingCompany?.size        || "",
  });

  const inputStyle = {
    width: "100%", padding: "11px 14px", background: tk.inputBg,
    border: `1px solid ${tk.border}`, borderRadius: 10, fontSize: 13,
    color: tk.text, boxSizing: "border-box", outline: "none",
    fontFamily: "inherit", transition: "border-color 0.2s, box-shadow 0.2s",
  };
  const iF = (e) => { e.target.style.borderColor = tk.accentBorder; e.target.style.boxShadow = `0 0 0 3px ${tk.accentGlow}`; };
  const iB = (e) => { e.target.style.borderColor = tk.border; e.target.style.boxShadow = "none"; };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) { setLogoPreview(null); setLogoFile(null); return; }
    setLogoFile(file);
    const r = new FileReader();
    r.onload = (ev) => setLogoPreview(ev.target.result);
    r.readAsDataURL(file);
  };

  const canNext = () => {
    if (step === 1) return form.name.trim().length >= 2;
    if (step === 2) return !!form.industry;
    if (step === 3) return !!form.size;
    return true;
  };

  const handleSubmit = async () => {
    setSave(true); setError(null);
    try {
      let res;
      if (logoFile) {
        const body = new FormData();
        Object.entries(form).forEach(([k, v]) => v && body.append(k, v));
        body.append("logo", logoFile);
        res = await fetch(`${API_BASE}/company/details`, {
          method: "PATCH", headers: authHeadersMultipart(), body,
        });
      } else {
        res = await fetch(`${API_BASE}/company/details`, {
          method: "PATCH", headers: authHeaders(),
          body: JSON.stringify(form),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save company details");
      const c = data.company || data;
      if (logoPreview && !c.logo_url) c.logo_url = logoPreview;
      onComplete(c);
    } catch (err) {
      setError(err.message);
      setSave(false);
    }
  };

  // ── COMPACT EDITOR (company has details from registration) ──────────────────
  if (step === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Logo — primary focus */}
        <div style={{ padding: "18px 20px", background: tk.accentBg, border: `1px solid ${tk.accentBorder}`, borderRadius: 14 }}>
          <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: tk.text }}>Company Logo</p>
          <p style={{ margin: "0 0 14px", fontSize: 12, color: tk.subtle }}>Add your logo to make your workspace feel like home.</p>
          <LogoUploader preview={logoPreview} onChange={handleLogoChange} tk={tk} />
        </div>

        <div style={{ height: 1, background: tk.border }} />
        <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: tk.subtle, textTransform: "uppercase", letterSpacing: "0.07em" }}>
          Company Details — pre-filled from registration
        </p>

        <Field label="Company Name" tk={tk}>
          <input type="text" value={form.name} onChange={e => set("name", e.target.value)}
            style={inputStyle} onFocus={iF} onBlur={iB} />
        </Field>

        <div style={{ display: "grid",gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: 12 }}>
          <Field label="Industry" tk={tk}>
            <select value={form.industry} onChange={e => set("industry", e.target.value)}
              style={{ ...inputStyle, background: "rgba(255,255,255,0.04)", cursor: "pointer" }}
              onFocus={iF} onBlur={iB}>
              <option value="">Select…</option>
              {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </Field>
          <Field label="Team Size" tk={tk}>
            <select value={form.size} onChange={e => set("size", e.target.value)}
              style={{ ...inputStyle, background: "rgba(255,255,255,0.04)", cursor: "pointer" }}
              onFocus={iF} onBlur={iB}>
              <option value="">Select…</option>
              {SIZES.map(s => <option key={s.value} value={s.value}>{s.label} employees</option>)}
            </select>
          </Field>
        </div>

        <Field label="Website" tk={tk}>
          <input type="url" value={form.website} onChange={e => set("website", e.target.value)}
            placeholder="https://yourcompany.com" style={inputStyle} onFocus={iF} onBlur={iB} />
        </Field>

        <Field label="Description" tk={tk}>
          <textarea value={form.description} onChange={e => set("description", e.target.value)}
            placeholder="What does your company do?" rows={3}
            style={{ ...inputStyle, resize: "vertical" }} onFocus={iF} onBlur={iB} />
        </Field>

        {error && (
          <AlertBox type="error" tk={tk}>
            <AlertCircle size={14} style={{ flexShrink: 0 }} /> {error}
          </AlertBox>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <PrimaryBtn disabled={saving} onClick={handleSubmit} tk={tk}>
            {saving ? <><Spinner size={13} color="#fff" /> Saving…</> : <><Sparkles size={13} /> Save Changes</>}
          </PrimaryBtn>
        </div>
      </div>
    );
  }

  // ── FULL 4-STEP WIZARD (no details yet) ────────────────────────────────────
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
              <span style={{ fontSize: 10, fontWeight: step === s.id ? 700 : 400, color: step === s.id ? tk.accentText : tk.muted, whiteSpace: "nowrap", letterSpacing: "0.04em" }}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 1, background: step > s.id ? `${tk.green}60` : tk.border, margin: "0 8px", marginBottom: 18, transition: "background 0.3s" }} />
            )}
          </div>
        ))}
      </div>

      <div style={{ minHeight: 290 }}>
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: tk.text }}>Company details</h3>
              <p style={{ margin: 0, fontSize: 13, color: tk.subtle }}>This information is visible to all team members.</p>
            </div>
            <LogoUploader preview={logoPreview} onChange={handleLogoChange} tk={tk} />
            <div style={{ height: 1, background: tk.border }} />
            <Field label="Company Name" hint="Required" tk={tk}>
              <input type="text" value={form.name} onChange={e => set("name", e.target.value)}
                placeholder="Acme Corp" style={inputStyle} onFocus={iF} onBlur={iB} />
            </Field>
            <Field label="Description" hint="Optional" tk={tk}>
              <textarea value={form.description} onChange={e => set("description", e.target.value)}
                placeholder="What does your company do?" rows={3} style={{ ...inputStyle, resize: "vertical" }} onFocus={iF} onBlur={iB} />
            </Field>
            <Field label="Website" hint="Optional" tk={tk}>
              <div style={{ position: "relative" }}>
                <Globe size={13} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: tk.subtle, pointerEvents: "none" }} />
                <input type="url" value={form.website} onChange={e => set("website", e.target.value)}
                  placeholder="https://yourcompany.com" style={{ ...inputStyle, paddingLeft: 34 }} onFocus={iF} onBlur={iB} />
              </div>
            </Field>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: tk.text }}>Your industry</h3>
              <p style={{ margin: 0, fontSize: 13, color: tk.subtle }}>Helps us tailor features to your workflow.</p>
            </div>
            <div style={{ display: "grid",gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 110px), 1fr))', gap: 7 }}>
              {INDUSTRIES.map(ind => {
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
            <div>
              <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: tk.text }}>Team size</h3>
              <p style={{ margin: 0, fontSize: 13, color: tk.subtle }}>Helps us set the right defaults for your plan.</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {SIZES.map(sz => {
                const active = form.size === sz.value;
                return (
                  <button key={sz.value} onClick={() => set("size", sz.value)} style={{
                    display: "flex", alignItems: "center", gap: 14, padding: "13px 16px",
                    background: active ? tk.accentBg : tk.card,
                    border: `1px solid ${active ? tk.accentBorder : tk.border}`,
                    borderRadius: 11, cursor: "pointer", transition: "all 0.15s", fontFamily: "inherit",
                  }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: active ? `${tk.accent}22` : tk.inputBg, border: `1px solid ${active ? tk.accentBorder : tk.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
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
            <div>
              <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: tk.text }}>Review & confirm</h3>
              <p style={{ margin: 0, fontSize: 13, color: tk.subtle }}>Complete your company setup.</p>
            </div>
            <div style={{ background: tk.card, border: `1px solid ${tk.border}`, borderRadius: 14, overflow: "hidden" }}>
              <div style={{ padding: "16px 18px", borderBottom: `1px solid ${tk.border}`, display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, overflow: "hidden", background: tk.accentBg, border: `1px solid ${tk.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {logoPreview ? <img src={logoPreview} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Building2 size={20} color={tk.accentText} />}
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: tk.text }}>{form.name || "—"}</p>
                  {form.website && <p style={{ margin: "2px 0 0", fontSize: 12, color: tk.accentText }}>{form.website.replace(/^https?:\/\//, "")}</p>}
                </div>
              </div>
              {[
                { label: "Industry",    value: form.industry || "—" },
                { label: "Team Size",   value: SIZES.find(s => s.value === form.size)?.label ? `${SIZES.find(s => s.value === form.size).label} employees` : "—" },
                { label: "Description", value: form.description || "—" },
              ].map((row, i, arr) => (
                <div key={i} style={{ display: "flex", padding: "11px 18px", borderBottom: i < arr.length - 1 ? `1px solid ${tk.border}` : "none", gap: 12 }}>
                  <span style={{ flex: "0 0 100px", fontSize: 11, color: tk.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", paddingTop: 1 }}>{row.label}</span>
                  <span style={{ flex: 1, fontSize: 13, color: row.value === "—" ? tk.muted : tk.text, lineHeight: 1.5 }}>{row.value}</span>
                </div>
              ))}
            </div>
            {error && <AlertBox type="error" tk={tk}><AlertCircle size={14} style={{ flexShrink: 0 }} /> {error}</AlertBox>}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 28, paddingTop: 20, borderTop: `1px solid ${tk.border}` }}>
        <GhostBtn disabled={step === 1} onClick={() => { setStep(s => s - 1); setError(null); }} tk={tk}>
          <ChevronLeft size={14} /> Back
        </GhostBtn>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, color: tk.muted }}>{step} of {STEPS.length}</span>
          {step < 4
            ? <PrimaryBtn disabled={!canNext()} onClick={() => setStep(s => s + 1)} tk={tk}>
                Continue <ChevronRight size={14} />
              </PrimaryBtn>
            : <PrimaryBtn disabled={saving} onClick={handleSubmit} tk={tk}>
                {saving ? <><Spinner size={13} color="#fff" /> Saving…</> : <><Sparkles size={13} /> Complete Setup</>}
              </PrimaryBtn>}
        </div>
      </div>
    </div>
  );
};


// ─── CompanyCard ──────────────────────────────────────────────────────────────
const CompanyCard = ({ company, companyName, canEdit, onEdit, tk }) => {
  const inviteCode = company?.invite_code;
  const inviteLink = inviteCode ? `${window.location.origin}/join?code=${inviteCode}` : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ background: tk.surface, border: `1px solid ${tk.border}`, borderRadius: 20, overflow: "hidden" }}>
        {/* Banner */}
        <div style={{ height: 110, background: tk.bannerBg, position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: `radial-gradient(circle, ${tk.bannerDot} 1px, transparent 1px)`, backgroundSize: "20px 20px" }} />
          {canEdit && (
            <div style={{ position: "absolute", top: 16, right: 16 }}>
              <button onClick={onEdit} style={{
                padding: "7px 13px", background: "rgba(255,255,255,0.15)",
                backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.25)",
                borderRadius: 9, color: "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit",
              }}>
                <Edit2 size={11} /> Edit Details
              </button>
            </div>
          )}
        </div>

        <div style={{ padding: "0 24px 26px" }}>
          {/* Logo */}
          <div style={{
            width: 72, height: 72, borderRadius: 20,
            background: "linear-gradient(135deg, #312e81, #7c3aed)",
            border: `4px solid ${tk.surface}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            marginTop: -36, marginBottom: 14, overflow: "hidden", flexShrink: 0,
            boxShadow: "0 8px 28px rgba(55,48,163,0.45)", position: "relative", zIndex: 1,
          }}>
            {company?.logo_url
              ? <img src={company.logo_url} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <Building2 size={28} color="#fff" />}
          </div>

          <div style={{ marginBottom: 16 }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800, color: tk.text, letterSpacing: "-0.02em" }}>
              {companyName}
            </h2>
            {company?.website && (
              <a href={company.website} target="_blank" rel="noreferrer"
                style={{ fontSize: 12, color: tk.accentText, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Globe size={11} />{company.website.replace(/^https?:\/\//, "")}
              </a>
            )}
            {company?.description && (
              <p style={{ margin: "10px 0 0", fontSize: 13, color: tk.subtle, lineHeight: 1.7 }}>{company.description}</p>
            )}
          </div>

          {/* Stats */}
          <div style={{ display: "grid",gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 90px), 1fr))', gap: 8 }}>
            {[
              { label: "Industry",  value: company?.industry     || "—" },
              { label: "Team Size", value: company?.size         || "—" },
              { label: "Members",   value: company?.member_count ?? "—" },
            ].map((item, i) => (
              <div key={i} style={{ padding: "13px 10px", background: tk.card, border: `1px solid ${tk.border}`, borderRadius: 12, textAlign: "center" }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: tk.text }}>{item.value}</p>
                <p style={{ margin: "3px 0 0", fontSize: 10, color: tk.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Invite section */}
      {inviteCode ? (
        <div style={{ background: tk.surface, border: `1px solid ${tk.border}`, borderRadius: 16, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <UserPlus size={15} color={tk.accentText} />
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: tk.text }}>Invite Team Members</h3>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: tk.subtle, lineHeight: 1.6 }}>
            Share this code or link. Colleagues need a <strong>personal Syncline account</strong> to join.
          </p>
          <CopyRow label="Invite Code" value={inviteCode} mono tk={tk} />
          {inviteLink && <CopyRow label="Invite Link" value={inviteLink} tk={tk} />}
        </div>
      ) : (
        <AlertBox type="info" tk={tk}>
          <Lock size={13} style={{ flexShrink: 0 }} />
          Complete your company details to generate an invite code.
        </AlertBox>
      )}
    </div>
  );
};

// ─── MembersList ──────────────────────────────────────────────────────────────
const MembersList = ({ members, canEdit, onRemove, onRoleChange, tk }) => {
  const [busy, setBusy] = useState({});

  const safeMembers = Array.isArray(members) ? members : [];
  if (safeMembers.length === 0) return (
    <p style={{ margin: 0, fontSize: 13, color: tk.muted, padding: "8px 0" }}>No members yet.</p>
  );

  const handleRoleChange = async (userId, role) => {
    setBusy(b => ({ ...b, [userId]: true }));
    await onRoleChange(userId, role);
    setBusy(b => ({ ...b, [userId]: false }));
  };

  const handleRemove = async (userId) => {
    if (!window.confirm("Remove this person from the company?")) return;
    setBusy(b => ({ ...b, [userId]: true }));
    await onRemove(userId);
    setBusy(b => ({ ...b, [userId]: false }));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {safeMembers.map((m) => {
        const meta = ROLE_META[m.role] || ROLE_META.member;
        const RoleIcon = meta.icon;
        return (
          <div key={m.id} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 14px", background: tk.card,
            border: `1px solid ${tk.border}`, borderRadius: 12,
            opacity: busy[m.id] ? 0.6 : 1, transition: "opacity 0.2s",
          }}>
            <Avatar name={m.full_name} avatar={m.avatar_url} size={38} tk={tk} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: tk.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {m.full_name}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: tk.subtle, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {m.email}
              </p>
            </div>
            {/* Role badge / selector */}
            {canEdit ? (
              <select
                value={m.role}
                disabled={busy[m.id]}
                onChange={(e) => handleRoleChange(m.id, e.target.value)}
                style={{
                  padding: "4px 8px", fontSize: 11, fontWeight: 600,
                  background: tk.inputBg, border: `1px solid ${tk.border}`,
                  borderRadius: 7, color: meta.color, cursor: "pointer",
                  fontFamily: "inherit", outline: "none",
                }}
              >
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="member">Member</option>
              </select>
            ) : (
              <span style={{
                display: "flex", alignItems: "center", gap: 4,
                fontSize: 11, fontWeight: 600, color: meta.color,
                padding: "3px 8px", borderRadius: 6,
                background: `${meta.color}14`, border: `1px solid ${meta.color}30`,
              }}>
                <RoleIcon size={10} /> {meta.label}
              </span>
            )}
            {canEdit && (
              <button
                onClick={() => handleRemove(m.id)}
                disabled={busy[m.id]}
                title="Remove from company"
                style={{
                  flexShrink: 0, padding: "5px 7px",
                  background: "transparent", border: `1px solid ${tk.border}`,
                  borderRadius: 7, color: tk.muted, cursor: "pointer",
                  display: "flex", alignItems: "center", transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = tk.redBg; e.currentTarget.style.color = tk.red; e.currentTarget.style.borderColor = tk.redBorder; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = tk.muted; e.currentTarget.style.borderColor = tk.border; }}
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── JoinRequestsPanel ───────────────────────────────────────────────────────
const JoinRequestsPanel = ({ onAccepted, tk }) => {
  const [requests, setRequests] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [busy,     setBusy]     = useState({});
  const [msg,      setMsg]      = useState(null);

  const load = useCallback(async () => {
    try {
      const res  = await fetch(`${API_BASE}/company/join-requests`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) setRequests(Array.isArray(data.requests) ? data.requests : []);
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const resolve = async (id, action) => {
    setBusy(b => ({ ...b, [id]: true }));
    try {
      const res  = await fetch(`${API_BASE}/company/join-requests/${id}/${action}`, {
        method: "PATCH", headers: authHeaders(),
      });
      const data = await res.json();
      const type = action === "accept" ? "success" : "error";
      setMsg({ text: data.message || `Request ${action}d`, type });
      setTimeout(() => setMsg(null), 3000);
      if (action === "accept") onAccepted?.();
      load();
    } catch (_) {}
    setBusy(b => ({ ...b, [id]: false }));
  };

  const pending  = requests.filter(r => r.status === "pending");
  const resolved = requests.filter(r => r.status !== "pending");

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 0", color: tk.subtle, fontSize: 13 }}>
      <Spinner size={13} color={tk.accent} /> Loading…
    </div>
  );

  if (requests.length === 0) return (
    <p style={{ margin: 0, fontSize: 13, color: tk.muted, padding: "8px 0" }}>No join requests yet.</p>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {msg && (
        <AlertBox type={msg.type} tk={tk}>
          {msg.type === "success"
            ? <CheckCircle2 size={13} style={{ flexShrink: 0 }} />
            : <AlertCircle size={13} style={{ flexShrink: 0 }} />}
          {msg.text}
        </AlertBox>
      )}

      {pending.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: tk.subtle, textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Pending ({pending.length})
          </p>
          {pending.map(r => (
            <div key={r.id} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 14px", background: tk.amberBg,
              border: `1px solid ${tk.amberBorder}`, borderRadius: 12,
            }}>
              <Avatar name={r.full_name} avatar={r.avatar_url} size={38} tk={tk} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: tk.text }}>{r.full_name}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: tk.subtle }}>{r.email}</p>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => resolve(r.id, "accept")} disabled={busy[r.id]} style={{
                  padding: "6px 12px", background: tk.greenBg, border: `1px solid ${tk.greenBorder}`,
                  borderRadius: 8, color: tk.green, fontSize: 12, fontWeight: 600,
                  cursor: busy[r.id] ? "not-allowed" : "pointer", fontFamily: "inherit",
                  display: "flex", alignItems: "center", gap: 4,
                }}>
                  <Check size={11} /> Accept
                </button>
                <button onClick={() => resolve(r.id, "decline")} disabled={busy[r.id]} style={{
                  padding: "6px 12px", background: tk.redBg, border: `1px solid ${tk.redBorder}`,
                  borderRadius: 8, color: tk.red, fontSize: 12, fontWeight: 600,
                  cursor: busy[r.id] ? "not-allowed" : "pointer", fontFamily: "inherit",
                  display: "flex", alignItems: "center", gap: 4,
                }}>
                  <X size={11} /> Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: tk.subtle, textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Resolved
          </p>
          {resolved.map(r => (
            <div key={r.id} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px", background: tk.card,
              border: `1px solid ${tk.border}`, borderRadius: 10, opacity: 0.75,
            }}>
              <Avatar name={r.full_name} avatar={r.avatar_url} size={30} tk={tk} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: tk.text }}>{r.full_name}</p>
                <p style={{ margin: "1px 0 0", fontSize: 11, color: tk.muted }}>{r.email}</p>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
                background: r.status === "accepted" ? tk.greenBg : tk.redBg,
                color: r.status === "accepted" ? tk.green : tk.red,
                border: `1px solid ${r.status === "accepted" ? tk.greenBorder : tk.redBorder}`,
                textTransform: "uppercase", letterSpacing: "0.05em",
              }}>
                {r.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── JoinForm ─────────────────────────────────────────────────────────────────
const JoinForm = ({ code, setCode, loading, error, onJoin, tk }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <AlertBox type="info" tk={tk}>
      <Users size={14} style={{ flexShrink: 0 }} />
      Ask your company admin for the exact invite code shown in their workspace.
    </AlertBox>
    <div style={{ background: tk.surface, border: `1px solid ${tk.border}`, borderRadius: 16, padding: "22px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: tk.text }}>Enter invite code</h3>
        <p style={{ margin: 0, fontSize: 12, color: tk.subtle }}>Looks like <span style={{ fontFamily: "monospace", color: tk.accentText }}>SYNC-XXXXXX</span></p>
      </div>
      <input
        type="text" value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
        onKeyDown={(e) => e.key === "Enter" && onJoin()}
        placeholder="XXXX-XXXXXX" maxLength={12}
        style={{
          width: "100%", padding: "12px 14px", background: tk.inputBg,
          border: `1px solid ${tk.border}`, borderRadius: 10,
          fontSize: 20, color: tk.text, boxSizing: "border-box", outline: "none",
          fontFamily: "monospace", letterSpacing: "0.14em", textAlign: "center",
          fontWeight: 800, transition: "border-color 0.2s, box-shadow 0.2s",
        }}
        onFocus={(e) => { e.target.style.borderColor = tk.accentBorder; e.target.style.boxShadow = `0 0 0 3px ${tk.accentGlow}`; }}
        onBlur={(e)  => { e.target.style.borderColor = tk.border; e.target.style.boxShadow = "none"; }}
      />
      <button onClick={onJoin} disabled={loading || !code.trim()} style={{
        width: "100%", padding: "12px",
        background: loading || !code.trim() ? tk.inputBg : `linear-gradient(135deg, ${tk.accent} 0%, #8b5cf6 100%)`,
        border: "none", borderRadius: 10,
        color: loading || !code.trim() ? tk.muted : "#fff",
        fontSize: 13, fontWeight: 600,
        cursor: loading || !code.trim() ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
        fontFamily: "inherit",
        boxShadow: loading || !code.trim() ? "none" : `0 4px 20px ${tk.accentGlow}`,
        transition: "all 0.2s",
      }}>
        {loading
          ? <><Spinner size={13} color="#fff" /> Sending request…</>
          : <><ArrowRight size={14} /> Request to Join</>}
      </button>
      {error && (
        <AlertBox type="error" tk={tk}>
          <AlertCircle size={14} style={{ flexShrink: 0 }} /> {error}
        </AlertBox>
      )}
    </div>
  </div>
);

// ─── JoinView (personal accounts only) ───────────────────────────────────────
const JoinView = ({ tk }) => {
  const { updateUser } = useAuth();
  const [code,         setCode]         = useState("");
  const [loading,      setLoading]      = useState(false);
  const [checking,     setChecking]     = useState(true);
  const [error,        setError]        = useState(null);
  const [joinStatus,   setJoinStatus]   = useState(null);
  const [joinedCompany, setJoinedCompany] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlCode = params.get("code");
    if (urlCode) setCode(urlCode.toUpperCase());
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch(`${API_BASE}/company/my-status`, { headers: authHeaders() });
        const data = await res.json();
        if (res.ok && data.status) {
          setJoinStatus(data.status);
          setJoinedCompany(data.company);
          if (data.status === "accepted" && updateUser)
            updateUser({ company_id: data.company?.id });
        }
      } catch (_) {}
      setChecking(false);
    })();
  }, [updateUser]);

  // Poll while pending
  useEffect(() => {
    if (joinStatus !== "pending") return;
    const interval = setInterval(async () => {
      try {
        const res  = await fetch(`${API_BASE}/company/my-status`, { headers: authHeaders() });
        const data = await res.json();
        if (res.ok && data.status && data.status !== joinStatus) {
          setJoinStatus(data.status);
          setJoinedCompany(data.company);
          if (data.status === "accepted" && updateUser)
            updateUser({ company_id: data.company?.id });
        }
      } catch (_) {}
    }, 8000);
    return () => clearInterval(interval);
  }, [joinStatus, updateUser]);

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) { setError("Enter a valid invite code"); return; }
    setLoading(true); setError(null);
    try {
      const res  = await fetch(`${API_BASE}/company/join/${trimmed}`, {
        method: "POST", headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid invite code");
      setJoinStatus(data.status || "pending");
      setJoinedCompany(data.company);
      if (updateUser) updateUser({ company_id: data.company?.id });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (checking) return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 20, color: tk.subtle, fontSize: 13 }}>
      <Spinner size={14} color={tk.accent} /> Checking status…
    </div>
  );

  if (joinStatus === "accepted") return (
    <AlertBox type="success" tk={tk}>
      <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
      <div>
        <strong>You are a member of {joinedCompany?.name}!</strong><br />
        <span style={{ fontSize: 12 }}>Tasks assigned to you by the company will appear in your Tasks section.</span>
      </div>
    </AlertBox>
  );

  if (joinStatus === "pending") return (
    <div style={{ background: tk.amberBg, border: `1px solid ${tk.amberBorder}`, borderRadius: 14, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: tk.amber, animation: "pulse 2s infinite" }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: tk.amber }}>Request pending approval</span>
      </div>
      <p style={{ margin: 0, fontSize: 13, color: tk.text, lineHeight: 1.6 }}>
        Your request to join <strong>{joinedCompany?.name}</strong> has been sent.
        An admin will review it — this page updates automatically.
      </p>
      <p style={{ margin: 0, fontSize: 11, color: tk.subtle }}>Once approved you can see tasks assigned to you by the company.</p>
    </div>
  );

  if (joinStatus === "declined") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <AlertBox type="error" tk={tk}>
        <AlertCircle size={14} style={{ flexShrink: 0 }} />
        <div>
          Your request to join <strong>{joinedCompany?.name}</strong> was declined.
          You can try a different invite code or contact the company admin.
        </div>
      </AlertBox>
      <JoinForm code={code} setCode={setCode} loading={loading} error={error} onJoin={handleJoin} tk={tk} />
    </div>
  );

  return <JoinForm code={code} setCode={setCode} loading={loading} error={error} onJoin={handleJoin} tk={tk} />;
};

// ─── Main export ──────────────────────────────────────────────────────────────
export default function CompanyOnboarding({ dark: darkProp }) {
  const { user, updateUser } = useAuth();

  const [company,   setCompany]   = useState(null);
  const [members,   setMembers]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [editing,   setEditing]   = useState(false);
  const [fetchErr,  setFetchErr]  = useState(null);
  const [toast,     setToast]     = useState(null);
  const [darkLocal, setDarkLocal] = useState(true);

  const dark = darkProp !== undefined ? darkProp : darkLocal;
  const tk   = dark ? DARK : LIGHT;

  const isCompanyAccount =
    user?.accountType === "company" ||
    user?.account_type === "company";

  const companyName = company?.name
    || user?.companyName
    || user?.company_name
    || "Your Company";

  const canEdit = isCompanyAccount && ["admin", "manager"].includes(user?.role);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchTeam = useCallback(async () => {
    if (!isCompanyAccount || !user?.company_id) { setLoading(false); return; }
    setLoading(true); setFetchErr(null);
    try {
      const res  = await fetch(`${API_BASE}/company/team`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) {
        setCompany(data.company || null);
        setMembers(Array.isArray(data.members) ? data.members : []);
      } else {
        setFetchErr(data.error || "Could not load company.");
      }
    } catch (_) {
      setFetchErr("Network error — could not load company.");
    } finally {
      setLoading(false);
    }
  }, [isCompanyAccount, user?.company_id]);

  useEffect(() => { fetchTeam(); }, [fetchTeam]);

  const handleWizardComplete = (c) => {
    // Use the returned company object directly — don't re-fetch which can
    // race against the DB write and show stale data.
    setCompany(c);
    setEditing(false);
    if (updateUser) updateUser({ company_id: c.id });
    showToast("Company details saved!");
    // Refresh members list only (not company object)
    fetch(`${API_BASE}/company/team`, { headers: authHeaders() })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data.members)) setMembers(data.members);
        // Only update company if the returned object has more data than what we already have
        if (data.company && data.company.invite_code) setCompany(prev => ({ ...data.company, ...c }));
      })
      .catch(() => {});
  };

  const handleRoleChange = async (userId, role) => {
    try {
      const res  = await fetch(`${API_BASE}/company/team/${userId}/role`, {
        method: "PATCH", headers: authHeaders(),
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast("Role updated.");
      fetchTeam();
    } catch (err) {
      showToast(err.message || "Failed to update role.", "error");
    }
  };

  const handleRemoveMember = async (userId) => {
    try {
      const res  = await fetch(`${API_BASE}/company/team/${userId}`, {
        method: "DELETE", headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast("Member removed.");
      fetchTeam();
    } catch (err) {
      showToast(err.message || "Failed to remove member.", "error");
    }
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300, gap: 14 }}>
      <Spinner size={24} color="#6366f1" />
      <span style={{ color: "#6b7a94", fontSize: 14 }}>Loading…</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{
      minHeight: "100%", background: "transparent",
      padding: "32px 20px 60px",
      fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(12px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes pulse   { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${tk.border}; border-radius: 4px; }
        button:focus-visible { outline: 2px solid ${tk.accentBorder}; outline-offset: 2px; }
      `}</style>

      <Toast toast={toast} tk={tk} />

      <div style={{ maxWidth: 600, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
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
                {isCompanyAccount ? "Company Workspace" : "Join a Company"}
              </h1>
              <p style={{ margin: 0, fontSize: 13, color: tk.subtle }}>
                {isCompanyAccount
                  ? "Manage your company profile, team members and invitations."
                  : "Enter an invite code or open an invite link to join your team."}
              </p>
            </div>
          </div>
          {darkProp === undefined && (
            <button onClick={() => setDarkLocal(d => !d)} style={{
              flexShrink: 0, marginTop: 2, width: 36, height: 36, borderRadius: 10,
              background: tk.card, border: `1px solid ${tk.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: tk.subtle, transition: "all 0.2s",
            }}>
              {dark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          )}
        </div>

        {/* Fetch error */}
        {fetchErr && (
          <AlertBox type="warning" tk={tk}>
            <AlertCircle size={14} style={{ flexShrink: 0 }} />
            {fetchErr}{" "}
            <button onClick={fetchTeam} style={{
              background: "none", border: "none", color: tk.amber, cursor: "pointer",
              fontWeight: 600, padding: "0 0 0 4px", fontFamily: "inherit", fontSize: 13,
              display: "inline-flex", alignItems: "center", gap: 3,
            }}>
              <RefreshCw size={11} /> Retry
            </button>
          </AlertBox>
        )}

        {/* ── COMPANY ACCOUNT ── */}
        {isCompanyAccount && (
          <>
            {editing ? (
              /* ── Edit wizard ── */
              <div style={{ background: tk.surface, border: `1px solid ${tk.border}`, borderRadius: 20, padding: "26px 28px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
                  <div>
                    <h2 style={{ margin: "0 0 2px", fontSize: 16, fontWeight: 700, color: tk.text }}>
                      {"Edit Company Details"}
                    </h2>
                    <p style={{ margin: 0, fontSize: 12, color: tk.subtle }}>
                      {"Update your company information."}
                    </p>
                  </div>
                  <button onClick={() => setEditing(false)} style={{
                    background: "transparent", border: `1px solid ${tk.border}`, borderRadius: 9,
                    color: tk.subtle, cursor: "pointer", padding: 8,
                    display: "flex", fontFamily: "inherit", transition: "all 0.15s",
                  }}>
                    <X size={14} />
                  </button>
                </div>
                <SetupWizard existingCompany={company} onComplete={handleWizardComplete} tk={tk} />
              </div>
            ) : (
              <>
                {/* ── Prompt to complete setup if no industry/size yet ── */}
                {!company?.industry && (
                  <AlertBox type="info" tk={tk}>
                    <Sparkles size={14} style={{ flexShrink: 0 }} />
                    <div>
                      <strong>Complete your company setup</strong> to generate an invite code and start adding team members.{" "}
                      <button onClick={() => setEditing(true)} style={{
                        background: "none", border: "none", color: tk.accentText,
                        cursor: "pointer", fontWeight: 700, padding: 0, fontFamily: "inherit",
                        fontSize: 13, textDecoration: "underline",
                      }}>
                        Set up now →
                      </button>
                    </div>
                  </AlertBox>
                )}

                {/* ── Company card + invite ── */}
                <CompanyCard
                  company={company}
                  companyName={companyName}
                  canEdit={canEdit}
                  onEdit={() => setEditing(true)}
                  tk={tk}
                />

                {/* ── Team members ── */}
                <div style={{ background: tk.surface, border: `1px solid ${tk.border}`, borderRadius: 16, padding: "20px 22px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Users size={15} color={tk.accentText} />
                      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: tk.text }}>
                        Team Members <span style={{ fontSize: 12, color: tk.muted, fontWeight: 400 }}>({members.length})</span>
                      </h3>
                    </div>
                    <button onClick={fetchTeam} style={{
                      background: "none", border: `1px solid ${tk.border}`, borderRadius: 7,
                      color: tk.subtle, cursor: "pointer", padding: "5px 7px",
                      display: "flex", alignItems: "center",
                    }}>
                      <RefreshCw size={12} />
                    </button>
                  </div>
                  <MembersList
                    members={members}
                    canEdit={canEdit}
                    onRemove={handleRemoveMember}
                    onRoleChange={handleRoleChange}
                    tk={tk}
                  />
                </div>

                {/* ── Join requests (admin/manager only) ── */}
                {canEdit && (
                  <div style={{ background: tk.surface, border: `1px solid ${tk.border}`, borderRadius: 16, padding: "20px 22px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                      <UserPlus size={15} color={tk.accentText} />
                      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: tk.text }}>Join Requests</h3>
                    </div>
                    <JoinRequestsPanel onAccepted={fetchTeam} tk={tk} />
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── PERSONAL ACCOUNT ── */}
        {!isCompanyAccount && <JoinView tk={tk} />}

      </div>
    </div>
  );
}