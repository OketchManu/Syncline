// web/src/components/company/CompanyOnboarding.jsx
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { auth } from "../../firebase.js";
import {
  Building2, CheckCircle2, AlertCircle,
  Globe, Users, Upload, X, Edit2,
  Sparkles, Lock, Check, ArrowRight, Copy, Zap, Sun, Moon,
  RefreshCw, UserPlus, Shield, Briefcase, UserCheck, Trash2, Mail,
  Send, Clock, XCircle,
} from "lucide-react";

const API_BASE   = "https://syncline-1.onrender.com/api";
const API_ORIGIN = "https://syncline-1.onrender.com";

// ─── Themes ───────────────────────────────────────────────────────────────────
const DARK = {
  bg: "#06080f", surface: "#0c1018", card: "rgba(255,255,255,0.03)",
  border: "rgba(255,255,255,0.07)", borderHi: "rgba(255,255,255,0.14)",
  text: "#e8edf5", muted: "#3a4558", subtle: "#6b7a94",
  inputBg: "rgba(255,255,255,0.04)",
  accent: "#6366f1", accentBg: "rgba(99,102,241,0.1)", accentBorder: "rgba(99,102,241,0.3)",
  accentText: "#a5b4fc", accentGlow: "rgba(99,102,241,0.2)",
  green: "#34d399", greenBg: "rgba(52,211,153,0.08)", greenBorder: "rgba(52,211,153,0.25)",
  red: "#f87171", redBg: "rgba(248,113,113,0.07)", redBorder: "rgba(248,113,113,0.22)",
  amber: "#fbbf24", amberBg: "rgba(251,191,36,0.07)", amberBorder: "rgba(251,191,36,0.22)",
  shadowLg: "0 16px 48px rgba(0,0,0,0.6)",
  bannerBg: "linear-gradient(135deg,#312e81 0%,#4c1d95 40%,#0e7490 100%)",
  bannerDot: "rgba(255,255,255,0.06)",
};
const LIGHT = {
  bg: "#f0f2f8", surface: "#ffffff", card: "rgba(0,0,0,0.02)",
  border: "rgba(0,0,0,0.08)", borderHi: "rgba(0,0,0,0.15)",
  text: "#0f1623", muted: "#b0bac9", subtle: "#6b7a94",
  inputBg: "rgba(0,0,0,0.03)",
  accent: "#6366f1", accentBg: "rgba(99,102,241,0.08)", accentBorder: "rgba(99,102,241,0.25)",
  accentText: "#4f46e5", accentGlow: "rgba(99,102,241,0.15)",
  green: "#059669", greenBg: "rgba(5,150,105,0.07)", greenBorder: "rgba(5,150,105,0.2)",
  red: "#dc2626", redBg: "rgba(220,38,38,0.06)", redBorder: "rgba(220,38,38,0.18)",
  amber: "#d97706", amberBg: "rgba(217,119,6,0.06)", amberBorder: "rgba(217,119,6,0.18)",
  shadowLg: "0 16px 48px rgba(0,0,0,0.12)",
  bannerBg: "linear-gradient(135deg,#4338ca 0%,#7c3aed 40%,#0891b2 100%)",
  bannerDot: "rgba(255,255,255,0.1)",
};

const INDUSTRIES = [
  "Technology","Healthcare","Finance","Education","Retail",
  "Manufacturing","Consulting","Media & Entertainment","Real Estate",
  "Logistics","Legal","Non-profit","Other",
];
const SIZES = [
  { value:"1-10",    label:"1–10",    sub:"Startup / Solo"  },
  { value:"11-50",   label:"11–50",   sub:"Growing team"    },
  { value:"51-200",  label:"51–200",  sub:"Scale-up"        },
  { value:"201-500", label:"201–500", sub:"Mid-size"        },
  { value:"500+",    label:"500+",    sub:"Enterprise"      },
];
const ROLE_META = {
  owner:   { icon: Shield,    color: "#ef4444", label: "Owner"   },
  admin:   { icon: Shield,    color: "#6366f1", label: "Admin"   },
  manager: { icon: Briefcase, color: "#f59e0b", label: "Manager" },
  member:  { icon: UserCheck, color: "#10b981", label: "Member"  },
};

// ─── Auth helper ──────────────────────────────────────────────────────────────
async function getAuthHeaders(multipart = false) {
  const token = await auth.currentUser?.getIdToken();
  if (multipart) return { Authorization: `Bearer ${token}` };
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

// ─── Atoms ────────────────────────────────────────────────────────────────────
const Spinner = ({ size = 16, color = "#6366f1" }) => (
  <div style={{ width: size, height: size, flexShrink: 0,
    border: `2px solid ${color}28`, borderTop: `2px solid ${color}`,
    borderRadius: "50%", animation: "spin 0.65s linear infinite" }} />
);

const Avatar = ({ name, avatar, size = 36, tk }) => {
  const initials = (name||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  const src = avatar?.startsWith("http") ? avatar : avatar ? `${API_ORIGIN}${avatar}` : null;
  return src
    ? <img src={src} alt={name} style={{ width:size, height:size, borderRadius:size/2.5, objectFit:"cover", flexShrink:0 }}/>
    : <div style={{ width:size, height:size, borderRadius:size/2.5, flexShrink:0,
        background:tk.accentBg, border:`1px solid ${tk.accentBorder}`,
        display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:size*0.36, fontWeight:700, color:tk.accentText }}>
        {initials}
      </div>;
};

const Field = ({ label, hint, children, tk }) => (
  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
    {label && (
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
        <label style={{ fontSize:11, fontWeight:600, color:tk.subtle, textTransform:"uppercase", letterSpacing:"0.08em" }}>{label}</label>
        {hint && <span style={{ fontSize:11, color:tk.muted }}>{hint}</span>}
      </div>
    )}
    {children}
  </div>
);

const AlertBox = ({ type="error", children, tk }) => {
  const map = {
    error:   [tk.redBg,   tk.redBorder,   tk.red],
    success: [tk.greenBg, tk.greenBorder, tk.green],
    warning: [tk.amberBg, tk.amberBorder, tk.amber],
    info:    [tk.accentBg,tk.accentBorder,tk.accentText],
  };
  const [bg,border,color] = map[type]||map.error;
  return (
    <div style={{ background:bg, border:`1px solid ${border}`, color,
      padding:"11px 14px", borderRadius:10, fontSize:13,
      display:"flex", alignItems:"flex-start", gap:9, lineHeight:1.55 }}>
      {children}
    </div>
  );
};

const PrimaryBtn = ({ children, disabled, onClick, fullWidth, loading, tk }) => (
  <button onClick={disabled||loading ? undefined : onClick} disabled={disabled||loading}
    style={{ padding:"11px 22px",
      background: disabled||loading ? tk.inputBg : `linear-gradient(135deg,${tk.accent} 0%,#8b5cf6 100%)`,
      border:"none", borderRadius:10,
      color: disabled||loading ? tk.muted : "#fff",
      fontSize:13, fontWeight:600,
      cursor: disabled||loading ? "not-allowed" : "pointer",
      display:"flex", alignItems:"center", justifyContent:"center", gap:7,
      fontFamily:"inherit",
      boxShadow: disabled||loading ? "none" : `0 4px 20px ${tk.accentGlow}`,
      transition:"all 0.2s", width: fullWidth ? "100%" : "auto", whiteSpace:"nowrap",
    }}>
    {loading ? <><Spinner size={13} color="#fff"/> Saving…</> : children}
  </button>
);

const GhostBtn = ({ children, disabled, onClick, tk }) => (
  <button onClick={disabled ? undefined : onClick} disabled={disabled}
    style={{ padding:"11px 18px", background:"transparent",
      border:`1px solid ${tk.border}`, borderRadius:10,
      color: disabled ? tk.muted : tk.subtle,
      fontSize:13, fontWeight:500,
      cursor: disabled ? "not-allowed" : "pointer",
      display:"flex", alignItems:"center", gap:7,
      opacity: disabled ? 0.35 : 1, fontFamily:"inherit", transition:"all 0.15s",
    }}>
    {children}
  </button>
);

const Toast = ({ toast, tk }) => {
  if (!toast) return null;
  const isErr = toast.type === "error";
  return (
    <div style={{ position:"fixed", top:20, right:16, zIndex:9999,
      background:tk.surface, border:`1px solid ${isErr?tk.redBorder:tk.greenBorder}`,
      color:isErr?tk.red:tk.green, padding:"13px 18px", borderRadius:13,
      fontSize:13, fontWeight:500, display:"flex", alignItems:"center", gap:8,
      boxShadow:tk.shadowLg, animation:"slideIn 0.25s ease",
      maxWidth:"calc(100vw - 32px)", wordBreak:"break-word" }}>
      {isErr ? <AlertCircle size={14}/> : <CheckCircle2 size={14}/>}{toast.msg}
    </div>
  );
};

const CopyRow = ({ label, value, mono, tk }) => {
  const [copied,setCopied] = useState(false);
  const copy = () => {
    try { navigator.clipboard.writeText(value); } catch(_) {}
    setCopied(true); setTimeout(()=>setCopied(false), 2200);
  };
  return (
    <div style={{ padding:"13px 15px", background:tk.accentBg, border:`1px solid ${tk.accentBorder}`,
      borderRadius:12, display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
      <div style={{ minWidth:0 }}>
        <p style={{ margin:0, fontSize:10, color:tk.subtle, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.07em" }}>{label}</p>
        <p style={{ margin:"4px 0 0", fontSize:mono?17:12, fontWeight:mono?800:500, color:tk.accentText,
          fontFamily:mono?"monospace":"inherit", letterSpacing:mono?"0.12em":"normal", wordBreak:"break-all" }}>
          {value||"—"}
        </p>
      </div>
      <button onClick={copy} style={{ flexShrink:0, padding:"7px 12px",
        background:copied?tk.greenBg:"rgba(127,127,127,0.06)",
        border:`1px solid ${copied?tk.greenBorder:tk.accentBorder}`,
        borderRadius:9, color:copied?tk.green:tk.accentText, fontSize:12, cursor:"pointer",
        fontWeight:600, display:"flex", alignItems:"center", gap:5, fontFamily:"inherit", transition:"all 0.2s" }}>
        {copied?<Check size={12}/>:<Copy size={12}/>}{copied?"Copied!":"Copy"}
      </button>
    </div>
  );
};

// ─── Logo Upload ──────────────────────────────────────────────────────────────
const LogoUploader = ({ preview, onChange, tk }) => {
  const ref = useRef();
  return (
    <div style={{ display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
      <div onClick={()=>ref.current.click()} style={{ width:68, height:68, borderRadius:16, flexShrink:0,
        background:preview?"transparent":tk.accentBg,
        border:`2px dashed ${preview?"transparent":tk.accentBorder}`,
        display:"flex", alignItems:"center", justifyContent:"center",
        overflow:"hidden", cursor:"pointer", transition:"all 0.2s",
        boxShadow:preview?`0 4px 16px ${tk.accentGlow}`:"none" }}>
        {preview
          ?<img src={preview} alt="logo" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
          :<Building2 size={24} color={tk.accentText}/>}
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:5, flex:1, minWidth:0 }}>
        <p style={{ margin:0, fontSize:13, fontWeight:600, color:tk.text }}>Company Logo</p>
        <label style={{ padding:"6px 12px", background:tk.accentBg, border:`1px solid ${tk.accentBorder}`,
          borderRadius:8, color:tk.accentText, fontSize:12, cursor:"pointer",
          fontWeight:500, display:"inline-flex", alignItems:"center", gap:5, width:"fit-content" }}>
          <Upload size={11}/> {preview?"Change":"Upload"}
          <input ref={ref} type="file" accept="image/*" style={{ display:"none" }} onChange={onChange}/>
        </label>
        <p style={{ margin:0, fontSize:11, color:tk.muted }}>PNG, JPG · Max 5 MB</p>
      </div>
      {preview && (
        <button onClick={()=>onChange({target:{files:[]}})} style={{ flexShrink:0, background:tk.redBg,
          border:`1px solid ${tk.redBorder}`, borderRadius:8, color:tk.red, cursor:"pointer",
          padding:"6px 8px", display:"flex", alignItems:"center", transition:"all 0.15s" }}>
          <X size={13}/>
        </button>
      )}
    </div>
  );
};

// ─── Invite by Email ──────────────────────────────────────────────────────────
const InviteByEmail = ({ tk, onInviteSent }) => {
  const [email,    setEmail]    = useState("");
  const [role,     setRole]     = useState("member");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [success,  setSuccess]  = useState(null);
  const [invites,  setInvites]  = useState([]);
  const [loadingI, setLoadingI] = useState(true);

  const inputStyle = {
    padding:"10px 12px", background:tk.inputBg, border:`1px solid ${tk.border}`,
    borderRadius:9, fontSize:13, color:tk.text, fontFamily:"inherit", outline:"none",
    transition:"border-color 0.2s",
  };

  const loadInvites = useCallback(async () => {
    setLoadingI(true);
    try {
      const res  = await fetch(`${API_BASE}/company/invitations`, { headers: await getAuthHeaders() });
      const data = await res.json();
      if (res.ok) setInvites(Array.isArray(data.invitations) ? data.invitations : []);
    } catch(_) {}
    setLoadingI(false);
  }, []);

  useEffect(() => { loadInvites(); }, [loadInvites]);

  const send = async () => {
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setError("Enter a valid email address."); return;
    }
    setLoading(true); setError(null); setSuccess(null);
    try {
      const res  = await fetch(`${API_BASE}/company/team/invite`, {
        method:"POST", headers: await getAuthHeaders(),
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send invitation.");
      setSuccess(`Invitation sent to ${email.trim()}`);
      setEmail("");
      loadInvites();
      onInviteSent?.();
      setTimeout(() => setSuccess(null), 4000);
    } catch(err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const revoke = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/company/invitations/${id}`, {
        method:"DELETE", headers: await getAuthHeaders(),
      });
      if (res.ok) loadInvites();
    } catch(_) {}
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&send()}
          placeholder="colleague@company.com"
          style={{ ...inputStyle, flex:"1 1 180px", minWidth:0 }}
          onFocus={e=>{e.target.style.borderColor=tk.accentBorder;}}
          onBlur={e=>{e.target.style.borderColor=tk.border;}}/>
        <select value={role} onChange={e=>setRole(e.target.value)}
          style={{ ...inputStyle, background:tk.inputBg, cursor:"pointer", flex:"0 0 110px" }}
          onFocus={e=>{e.target.style.borderColor=tk.accentBorder;}}
          onBlur={e=>{e.target.style.borderColor=tk.border;}}>
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="member">Member</option>
        </select>
        <button onClick={send} disabled={loading||!email.trim()}
          style={{ padding:"10px 16px",
            background:loading||!email.trim()?tk.inputBg:`linear-gradient(135deg,${tk.accent},#8b5cf6)`,
            border:"none", borderRadius:9, color:loading||!email.trim()?tk.muted:"#fff",
            fontSize:13, fontWeight:600, cursor:loading||!email.trim()?"not-allowed":"pointer",
            display:"flex", alignItems:"center", gap:5, fontFamily:"inherit", flexShrink:0,
            boxShadow:loading||!email.trim()?"none":`0 4px 16px ${tk.accentGlow}` }}>
          {loading?<Spinner size={13} color="#fff"/>:<Send size={13}/>}
          {loading?"Sending...":"Send"}
        </button>
      </div>

      {error   && <AlertBox type="error"   tk={tk}><AlertCircle size={13}/> {error}</AlertBox>}
      {success && <AlertBox type="success" tk={tk}><CheckCircle2 size={13}/> {success}</AlertBox>}

      {/* Pending invitations list */}
      {!loadingI && invites.length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          <p style={{ margin:0, fontSize:11, fontWeight:700, color:tk.subtle, textTransform:"uppercase", letterSpacing:"0.06em" }}>
            Pending Invitations ({invites.length})
          </p>
          {invites.map(inv=>(
            <div key={inv.id} style={{ display:"flex", alignItems:"center", gap:10,
              padding:"10px 13px", background:tk.amberBg, border:`1px solid ${tk.amberBorder}`,
              borderRadius:10 }}>
              <Mail size={13} color={tk.amber} style={{ flexShrink:0 }}/>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ margin:0, fontSize:12, fontWeight:600, color:tk.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{inv.email}</p>
                <p style={{ margin:"1px 0 0", fontSize:10, color:tk.subtle }}>
                  <Clock size={9} style={{ verticalAlign:"middle" }}/> Expires {new Date(inv.expires_at).toLocaleDateString()} &middot; Role: {inv.role}
                </p>
              </div>
              <button onClick={()=>revoke(inv.id)} title="Revoke invitation"
                style={{ flexShrink:0, padding:"4px 7px", background:"transparent",
                  border:`1px solid ${tk.border}`, borderRadius:7, color:tk.muted,
                  cursor:"pointer", display:"flex", alignItems:"center", transition:"all 0.15s" }}
                onMouseEnter={e=>{e.currentTarget.style.background=tk.redBg;e.currentTarget.style.color=tk.red;e.currentTarget.style.borderColor=tk.redBorder;}}
                onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=tk.muted;e.currentTarget.style.borderColor=tk.border;}}>
                <XCircle size={12}/>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Company Edit Form (replaces SetupWizard in edit mode) ────────────────────
// This is a straightforward single-page form for editing existing company details.
// The wizard (multi-step) is only shown during initial setup.
const CompanyEditForm = ({ existingCompany, onComplete, onCancel, tk }) => {
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);
  const [logoPreview, setLogoPreview] = useState(
    existingCompany?.logo_url
      ? (existingCompany.logo_url.startsWith("http") ? existingCompany.logo_url : `${API_ORIGIN}${existingCompany.logo_url}`)
      : null
  );
  const [logoFile,  setLogoFile]  = useState(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [form, setForm] = useState({
    name:        existingCompany?.name        || "",
    description: existingCompany?.description || "",
    website:     existingCompany?.website     || "",
    industry:    existingCompany?.industry    || "",
    size:        existingCompany?.size        || "",
  });

  const inputStyle = {
    width:"100%", padding:"11px 14px", background:tk.inputBg,
    border:`1px solid ${tk.border}`, borderRadius:10, fontSize:13,
    color:tk.text, boxSizing:"border-box", outline:"none",
    fontFamily:"inherit", transition:"border-color 0.2s, box-shadow 0.2s",
  };
  const onFocus = e => { e.target.style.borderColor=tk.accentBorder; e.target.style.boxShadow=`0 0 0 3px ${tk.accentGlow}`; };
  const onBlur  = e => { e.target.style.borderColor=tk.border; e.target.style.boxShadow="none"; };
  const set     = (k,v) => setForm(f=>({...f,[k]:v}));

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) { setLogoPreview(existingCompany?.logo_url||null); setLogoFile(null); setRemoveLogo(false); return; }
    if (file.size > 5*1024*1024) { setError("Image must be under 5 MB."); return; }
    setLogoFile(file); setRemoveLogo(false);
    const r = new FileReader();
    r.onload = ev => setLogoPreview(ev.target.result);
    r.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoPreview(null); setLogoFile(null); setRemoveLogo(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError("Company name is required."); return; }
    setSaving(true); setError(null);
    try {
      let res;
      if (logoFile) {
        // Multipart — logo file included
        const body = new FormData();
        Object.entries(form).forEach(([k,v]) => { if (v) body.append(k, v); });
        body.append("logo", logoFile);
        res = await fetch(`${API_BASE}/company/details`, {
          method:"PATCH", headers: await getAuthHeaders(true), body,
        });
      } else {
        // JSON — no file, but may include removeLogo flag
        const payload = { ...form };
        if (removeLogo) payload.removeLogo = true;
        res = await fetch(`${API_BASE}/company/details`, {
          method:"PATCH", headers: await getAuthHeaders(),
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save. Please try again.");

      // Merge response with local logoPreview so the card shows the new logo immediately
      const updated = { ...(data.company||data) };
      if (logoPreview && logoFile && !updated.logo_url) updated.logo_url = logoPreview;
      if (removeLogo) updated.logo_url = null;

      onComplete(updated);
    } catch(err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      {/* Logo */}
      <Field label="Company Logo" tk={tk}>
        <LogoUploader
          preview={logoPreview}
          onChange={handleLogoChange}
          tk={tk}
          onRemove={handleRemoveLogo}
        />
        {logoPreview && (
          <button onClick={handleRemoveLogo} style={{ alignSelf:"flex-start", marginTop:4,
            background:tk.redBg, border:`1px solid ${tk.redBorder}`, borderRadius:7,
            color:tk.red, cursor:"pointer", padding:"4px 10px", fontSize:12,
            fontFamily:"inherit", display:"flex", alignItems:"center", gap:4 }}>
            <Trash2 size={11}/> Remove logo
          </button>
        )}
      </Field>

      <div style={{ height:1, background:tk.border }}/>

      {/* Company name */}
      <Field label="Company Name" hint="Required" tk={tk}>
        <input type="text" value={form.name} onChange={e=>set("name",e.target.value)}
          placeholder="Acme Corp" style={inputStyle} onFocus={onFocus} onBlur={onBlur}/>
      </Field>

      {/* Industry + Size in 2 cols */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,150px),1fr))", gap:12 }}>
        <Field label="Industry" tk={tk}>
          <select value={form.industry} onChange={e=>set("industry",e.target.value)}
            style={{ ...inputStyle, background:tk.inputBg, cursor:"pointer" }}
            onFocus={onFocus} onBlur={onBlur}>
            <option value="">Select…</option>
            {INDUSTRIES.map(i=><option key={i} value={i}>{i}</option>)}
          </select>
        </Field>
        <Field label="Team Size" tk={tk}>
          <select value={form.size} onChange={e=>set("size",e.target.value)}
            style={{ ...inputStyle, background:tk.inputBg, cursor:"pointer" }}
            onFocus={onFocus} onBlur={onBlur}>
            <option value="">Select…</option>
            {SIZES.map(s=><option key={s.value} value={s.value}>{s.label} employees</option>)}
          </select>
        </Field>
      </div>

      {/* Website */}
      <Field label="Website" hint="Optional" tk={tk}>
        <div style={{ position:"relative" }}>
          <Globe size={13} style={{ position:"absolute", left:13, top:"50%", transform:"translateY(-50%)", color:tk.subtle, pointerEvents:"none" }}/>
          <input type="url" value={form.website} onChange={e=>set("website",e.target.value)}
            placeholder="https://yourcompany.com"
            style={{ ...inputStyle, paddingLeft:34 }}
            onFocus={onFocus} onBlur={onBlur}/>
        </div>
      </Field>

      {/* Description */}
      <Field label="Description" hint="Optional" tk={tk}>
        <textarea value={form.description} onChange={e=>set("description",e.target.value)}
          placeholder="What does your company do?" rows={3}
          style={{ ...inputStyle, resize:"vertical" }}
          onFocus={onFocus} onBlur={onBlur}/>
      </Field>

      {error && <AlertBox type="error" tk={tk}><AlertCircle size={14} style={{flexShrink:0}}/> {error}</AlertBox>}

      <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
        <GhostBtn onClick={onCancel} tk={tk}><X size={14}/> Cancel</GhostBtn>
        <PrimaryBtn onClick={handleSave} disabled={!form.name.trim()} loading={saving} tk={tk}>
          <Sparkles size={13}/> Save Changes
        </PrimaryBtn>
      </div>
    </div>
  );
};

// ─── SetupWizard (initial setup only — multi-step) ────────────────────────────

// ─── CompanyCard ──────────────────────────────────────────────────────────────
const CompanyCard = ({ company, companyName, canEdit, onEdit, tk }) => {
  const inviteCode = company?.invite_code;
  const inviteLink = inviteCode ? `${window.location.origin}/join?code=${inviteCode}` : null;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
      <div style={{ background:tk.surface, border:`1px solid ${tk.border}`, borderRadius:20, overflow:"hidden" }}>
        <div style={{ height:100, background:tk.bannerBg, position:"relative" }}>
          <div style={{ position:"absolute", inset:0, backgroundImage:`radial-gradient(circle,${tk.bannerDot} 1px,transparent 1px)`, backgroundSize:"20px 20px" }}/>
          {canEdit&&(
            <div style={{ position:"absolute", top:14, right:14 }}>
              <button onClick={onEdit} style={{ padding:"7px 13px",
                background:"rgba(255,255,255,0.15)", backdropFilter:"blur(8px)",
                border:"1px solid rgba(255,255,255,0.25)", borderRadius:9,
                color:"#fff", fontSize:12, fontWeight:500, cursor:"pointer",
                display:"flex", alignItems:"center", gap:5, fontFamily:"inherit" }}>
                <Edit2 size={11}/> Edit Details
              </button>
            </div>
          )}
        </div>
        <div style={{ padding:"0 22px 24px" }}>
          <div style={{ width:66, height:66, borderRadius:18,
            background:"linear-gradient(135deg,#312e81,#7c3aed)",
            border:`4px solid ${tk.surface}`, display:"flex", alignItems:"center", justifyContent:"center",
            marginTop:-33, marginBottom:13, overflow:"hidden", flexShrink:0,
            boxShadow:"0 8px 24px rgba(55,48,163,0.4)", position:"relative", zIndex:1 }}>
            {company?.logo_url
              ?<img src={company.logo_url.startsWith("http")?company.logo_url:`${API_ORIGIN}${company.logo_url}`} alt="logo" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
              :<Building2 size={26} color="#fff"/>}
          </div>
          <div style={{ marginBottom:14 }}>
            <h2 style={{ margin:"0 0 3px", fontSize:20, fontWeight:800, color:tk.text, letterSpacing:"-0.02em" }}>{companyName}</h2>
            {company?.website&&<a href={company.website} target="_blank" rel="noreferrer" style={{ fontSize:12, color:tk.accentText, textDecoration:"none", display:"inline-flex", alignItems:"center", gap:3 }}><Globe size={10}/>{company.website.replace(/^https?:\/\//,"")}</a>}
            {company?.description&&<p style={{ margin:"9px 0 0", fontSize:13, color:tk.subtle, lineHeight:1.7 }}>{company.description}</p>}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,80px),1fr))", gap:7 }}>
            {[{label:"Industry",value:company?.industry||"—"},{label:"Team Size",value:company?.size||"—"},{label:"Members",value:company?.member_count??"—"}].map((item,i)=>(
              <div key={i} style={{ padding:"11px 8px", background:tk.card, border:`1px solid ${tk.border}`, borderRadius:11, textAlign:"center" }}>
                <p style={{ margin:0, fontSize:14, fontWeight:700, color:tk.text }}>{item.value}</p>
                <p style={{ margin:"2px 0 0", fontSize:9, color:tk.muted, textTransform:"uppercase", letterSpacing:"0.06em" }}>{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {inviteCode?(
        <div style={{ background:tk.surface, border:`1px solid ${tk.border}`, borderRadius:15, padding:"18px 20px", display:"flex", flexDirection:"column", gap:11 }}>
          <div style={{ display:"flex", alignItems:"center", gap:7 }}>
            <UserPlus size={14} color={tk.accentText}/>
            <h3 style={{ margin:0, fontSize:13, fontWeight:700, color:tk.text }}>Invite Team Members</h3>
          </div>
          <p style={{ margin:0, fontSize:12, color:tk.subtle, lineHeight:1.6 }}>Share this code or link. Members need a personal Syncline account.</p>
          <CopyRow label="Invite Code" value={inviteCode} mono tk={tk}/>
          {inviteLink&&<CopyRow label="Invite Link" value={inviteLink} tk={tk}/>}
        </div>
      ):(
        <AlertBox type="info" tk={tk}>
          <Lock size={13} style={{flexShrink:0}}/> Complete your company details to generate an invite code.
        </AlertBox>
      )}
    </div>
  );
};

// ─── MembersList ──────────────────────────────────────────────────────────────
const MembersList = ({ members, currentUserId, canEdit, onRemove, onRoleChange, tk }) => {
  const [busy, setBusy] = useState({});
  const safe = Array.isArray(members) ? members : [];
  if (safe.length === 0) return <p style={{ margin:0, fontSize:13, color:tk.muted, padding:"8px 0" }}>No members yet.</p>;

  const doRole = async (userId, role) => {
    setBusy(b=>({...b,[userId]:true}));
    await onRoleChange(userId, role);
    setBusy(b=>({...b,[userId]:false}));
  };
  const doRemove = async (userId) => {
    if (!window.confirm("Remove this member from the company?")) return;
    setBusy(b=>({...b,[userId]:true}));
    await onRemove(userId);
    setBusy(b=>({...b,[userId]:false}));
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
      {safe.map(m=>{
        const meta = ROLE_META[m.role]||ROLE_META.member;
        const RIcon = meta.icon;
        const isMe  = m.id === currentUserId;
        return (
          <div key={m.id} style={{ display:"flex", alignItems:"center", gap:11, padding:"11px 13px",
            background:isMe?tk.accentBg:tk.card, border:`1px solid ${isMe?tk.accentBorder:tk.border}`,
            borderRadius:11, opacity:busy[m.id]?0.6:1, transition:"opacity 0.2s" }}>
            <Avatar name={m.full_name} avatar={m.avatar_url} size={36} tk={tk}/>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ margin:0, fontSize:13, fontWeight:600, color:tk.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {m.full_name} {isMe&&<span style={{ fontSize:10, color:tk.accentText, fontWeight:500 }}>(you)</span>}
              </p>
              <p style={{ margin:"1px 0 0", fontSize:11, color:tk.subtle, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{m.email}</p>
            </div>
            {canEdit && !isMe && m.role !== "owner" ? (
              <select value={m.role} disabled={busy[m.id]} onChange={e=>doRole(m.id,e.target.value)}
                style={{ padding:"4px 7px", fontSize:11, fontWeight:600, background:tk.inputBg,
                  border:`1px solid ${tk.border}`, borderRadius:7, color:meta.color,
                  cursor:"pointer", fontFamily:"inherit", outline:"none" }}>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="member">Member</option>
              </select>
            ):(
              <span style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, fontWeight:600,
                color:meta.color, padding:"3px 8px", borderRadius:6,
                background:`${meta.color}14`, border:`1px solid ${meta.color}30` }}>
                <RIcon size={10}/> {meta.label}
              </span>
            )}
            {canEdit && !isMe && m.role !== "owner" && (
              <button onClick={()=>doRemove(m.id)} disabled={busy[m.id]} title="Remove member"
                style={{ flexShrink:0, padding:"5px 7px", background:"transparent",
                  border:`1px solid ${tk.border}`, borderRadius:7, color:tk.muted,
                  cursor:"pointer", display:"flex", alignItems:"center", transition:"all 0.15s" }}
                onMouseEnter={e=>{e.currentTarget.style.background=tk.redBg;e.currentTarget.style.color=tk.red;e.currentTarget.style.borderColor=tk.redBorder;}}
                onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=tk.muted;e.currentTarget.style.borderColor=tk.border;}}>
                <Trash2 size={12}/>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── JoinRequestsPanel ────────────────────────────────────────────────────────
const JoinRequestsPanel = ({ onAccepted, tk }) => {
  const [requests, setRequests] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [busy,     setBusy]     = useState({});
  const [msg,      setMsg]      = useState(null);

  const load = useCallback(async () => {
    try {
      const res  = await fetch(`${API_BASE}/company/join-requests`, { headers: await getAuthHeaders() });
      const data = await res.json();
      if (res.ok) setRequests(Array.isArray(data.requests) ? data.requests : []);
    } catch(_) {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const resolve = async (id, action) => {
    setBusy(b=>({...b,[id]:true}));
    try {
      const res  = await fetch(`${API_BASE}/company/join-requests/${id}/${action}`, { method:"PATCH", headers:await getAuthHeaders() });
      const data = await res.json();
      setMsg({ text:data.message||`Request ${action}d`, type:action==="accept"?"success":"error" });
      setTimeout(()=>setMsg(null), 3000);
      if (action==="accept") onAccepted?.();
      load();
    } catch(_) {}
    setBusy(b=>({...b,[id]:false}));
  };

  const pending  = requests.filter(r=>r.status==="pending");
  const resolved = requests.filter(r=>r.status!=="pending");

  if (loading) return <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 0", color:tk.subtle, fontSize:13 }}><Spinner size={13} color={tk.accent}/> Loading…</div>;
  if (requests.length===0) return <p style={{ margin:0, fontSize:13, color:tk.muted, padding:"8px 0" }}>No join requests yet.</p>;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
      {msg&&<AlertBox type={msg.type} tk={tk}>{msg.type==="success"?<CheckCircle2 size={13} style={{flexShrink:0}}/>:<AlertCircle size={13} style={{flexShrink:0}}/>} {msg.text}</AlertBox>}
      {pending.length>0&&(
        <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
          <p style={{ margin:0, fontSize:11, fontWeight:700, color:tk.subtle, textTransform:"uppercase", letterSpacing:"0.07em" }}>Pending ({pending.length})</p>
          {pending.map(r=>(
            <div key={r.id} style={{ display:"flex", alignItems:"center", gap:11, padding:"11px 13px",
              background:tk.amberBg, border:`1px solid ${tk.amberBorder}`, borderRadius:11 }}>
              <Avatar name={r.full_name} avatar={r.avatar_url} size={36} tk={tk}/>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ margin:0, fontSize:13, fontWeight:600, color:tk.text }}>{r.full_name}</p>
                <p style={{ margin:"1px 0 0", fontSize:11, color:tk.subtle }}>{r.email}</p>
              </div>
              <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                <button onClick={()=>resolve(r.id,"accept")} disabled={busy[r.id]} style={{ padding:"6px 11px", background:tk.greenBg, border:`1px solid ${tk.greenBorder}`, borderRadius:8, color:tk.green, fontSize:12, fontWeight:600, cursor:busy[r.id]?"not-allowed":"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:4 }}><Check size={11}/> Accept</button>
                <button onClick={()=>resolve(r.id,"decline")} disabled={busy[r.id]} style={{ padding:"6px 11px", background:tk.redBg, border:`1px solid ${tk.redBorder}`, borderRadius:8, color:tk.red, fontSize:12, fontWeight:600, cursor:busy[r.id]?"not-allowed":"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:4 }}><X size={11}/> Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {resolved.length>0&&(
        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
          <p style={{ margin:0, fontSize:11, fontWeight:700, color:tk.subtle, textTransform:"uppercase", letterSpacing:"0.07em" }}>Resolved</p>
          {resolved.map(r=>(
            <div key={r.id} style={{ display:"flex", alignItems:"center", gap:9, padding:"9px 13px",
              background:tk.card, border:`1px solid ${tk.border}`, borderRadius:10, opacity:0.75 }}>
              <Avatar name={r.full_name} avatar={r.avatar_url} size={28} tk={tk}/>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ margin:0, fontSize:12, fontWeight:500, color:tk.text }}>{r.full_name}</p>
                <p style={{ margin:"1px 0 0", fontSize:11, color:tk.muted }}>{r.email}</p>
              </div>
              <span style={{ fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:6,
                background:r.status==="accepted"?tk.greenBg:tk.redBg,
                color:r.status==="accepted"?tk.green:tk.red,
                border:`1px solid ${r.status==="accepted"?tk.greenBorder:tk.redBorder}`,
                textTransform:"uppercase", letterSpacing:"0.05em" }}>
                {r.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── JoinView (personal account — join a company) ─────────────────────────────
const JoinView = ({ tk }) => {
  const { updateUser } = useAuth();
  const [code,         setCode]         = useState("");
  const [loading,      setLoading]      = useState(false);
  const [checking,     setChecking]     = useState(true);
  const [error,        setError]        = useState(null);
  const [joinStatus,   setJoinStatus]   = useState(null);
  const [joinedCompany,setJoinedCompany]= useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlCode = params.get("code");
    if (urlCode) setCode(urlCode.toUpperCase());
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch(`${API_BASE}/company/my-status`, { headers: await getAuthHeaders() });
        const data = await res.json();
        if (res.ok && data.status) {
          setJoinStatus(data.status);
          setJoinedCompany(data.company);
          if (data.status==="accepted" && updateUser) updateUser({ company_id: data.company?.id });
        }
      } catch(_) {}
      setChecking(false);
    })();
  }, [updateUser]);

  useEffect(() => {
    if (joinStatus !== "pending") return;
    const iv = setInterval(async () => {
      try {
        const res  = await fetch(`${API_BASE}/company/my-status`, { headers: await getAuthHeaders() });
        const data = await res.json();
        if (res.ok && data.status && data.status !== joinStatus) {
          setJoinStatus(data.status); setJoinedCompany(data.company);
          if (data.status==="accepted" && updateUser) updateUser({ company_id: data.company?.id });
        }
      } catch(_) {}
    }, 8000);
    return () => clearInterval(iv);
  }, [joinStatus, updateUser]);

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) { setError("Enter a valid invite code."); return; }
    setLoading(true); setError(null);
    try {
      const res  = await fetch(`${API_BASE}/company/join/${trimmed}`, { method:"POST", headers: await getAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error||"Invalid invite code.");
      setJoinStatus(data.status||"pending"); setJoinedCompany(data.company);
      if (updateUser) updateUser({ company_id: data.company?.id });
    } catch(err) { setError(err.message); }
    finally { setLoading(false); }
  };

  if (checking) return <div style={{ display:"flex", alignItems:"center", gap:9, padding:20, color:tk.subtle, fontSize:13 }}><Spinner size={14} color={tk.accent}/> Checking status…</div>;

  if (joinStatus==="accepted") return (
    <AlertBox type="success" tk={tk}>
      <CheckCircle2 size={14} style={{flexShrink:0}}/>
      <div><strong>You are a member of {joinedCompany?.name}!</strong><br/>
        <span style={{fontSize:12}}>Tasks assigned to you will appear in your Tasks section.</span></div>
    </AlertBox>
  );

  if (joinStatus==="pending") return (
    <div style={{ background:tk.amberBg, border:`1px solid ${tk.amberBorder}`, borderRadius:14, padding:"18px 20px", display:"flex", flexDirection:"column", gap:11 }}>
      <div style={{ display:"flex", alignItems:"center", gap:9 }}>
        <div style={{ width:9, height:9, borderRadius:"50%", background:tk.amber, animation:"pulse 2s infinite" }}/>
        <span style={{ fontSize:13, fontWeight:700, color:tk.amber }}>Request pending approval</span>
      </div>
      <p style={{ margin:0, fontSize:13, color:tk.text, lineHeight:1.6 }}>
        Your request to join <strong>{joinedCompany?.name}</strong> has been sent. An admin will review it shortly.
      </p>
    </div>
  );

  if (joinStatus==="declined") return (
    <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
      <AlertBox type="error" tk={tk}>
        <AlertCircle size={14} style={{flexShrink:0}}/>
        <div>Your request to join <strong>{joinedCompany?.name}</strong> was declined. Try a different code or contact the admin.</div>
      </AlertBox>
      <JoinFormInner code={code} setCode={setCode} loading={loading} error={error} onJoin={handleJoin} tk={tk}/>
    </div>
  );

  return <JoinFormInner code={code} setCode={setCode} loading={loading} error={error} onJoin={handleJoin} tk={tk}/>;
};

const JoinFormInner = ({ code, setCode, loading, error, onJoin, tk }) => (
  <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
    <AlertBox type="info" tk={tk}>
      <Users size={14} style={{flexShrink:0}}/> Ask your company admin for the invite code shown in their workspace.
    </AlertBox>
    <div style={{ background:tk.surface, border:`1px solid ${tk.border}`, borderRadius:15, padding:"20px", display:"flex", flexDirection:"column", gap:11 }}>
      <div>
        <h3 style={{ margin:"0 0 3px", fontSize:15, fontWeight:700, color:tk.text }}>Enter invite code</h3>
        <p style={{ margin:0, fontSize:12, color:tk.subtle }}>Looks like <span style={{ fontFamily:"monospace", color:tk.accentText }}>SYNC-XXXXXX</span></p>
      </div>
      <input type="text" value={code}
        onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g,""))}
        onKeyDown={e=>e.key==="Enter"&&onJoin()}
        placeholder="XXXX-XXXXXX" maxLength={12}
        style={{ width:"100%", padding:"12px 14px", background:tk.inputBg, border:`1px solid ${tk.border}`, borderRadius:10,
          fontSize:20, color:tk.text, boxSizing:"border-box", outline:"none", fontFamily:"monospace",
          letterSpacing:"0.14em", textAlign:"center", fontWeight:800, transition:"border-color 0.2s" }}
        onFocus={e=>{e.target.style.borderColor=tk.accentBorder;e.target.style.boxShadow=`0 0 0 3px ${tk.accentGlow}`;}}
        onBlur={e=>{e.target.style.borderColor=tk.border;e.target.style.boxShadow="none";}}/>
      <button onClick={onJoin} disabled={loading||!code.trim()} style={{ width:"100%", padding:"12px",
        background:loading||!code.trim()?tk.inputBg:`linear-gradient(135deg,${tk.accent} 0%,#8b5cf6 100%)`,
        border:"none", borderRadius:10, color:loading||!code.trim()?tk.muted:"#fff",
        fontSize:13, fontWeight:600, cursor:loading||!code.trim()?"not-allowed":"pointer",
        display:"flex", alignItems:"center", justifyContent:"center", gap:7, fontFamily:"inherit",
        boxShadow:loading||!code.trim()?"none":`0 4px 20px ${tk.accentGlow}`, transition:"all 0.2s" }}>
        {loading?<><Spinner size={13} color="#fff"/> Sending request…</>:<><ArrowRight size={14}/> Request to Join</>}
      </button>
      {error&&<AlertBox type="error" tk={tk}><AlertCircle size={14} style={{flexShrink:0}}/> {error}</AlertBox>}
    </div>
  </div>
);

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

  const isCompanyAccount = user?.accountType==="company" || user?.account_type==="company";
  const companyName      = company?.name || user?.companyName || user?.company_name || "Your Company";

  // FIX: owner is now included in canEdit
  const canEdit = isCompanyAccount && ["owner","admin","manager"].includes(user?.role);

  const showToast = (msg, type="success") => {
    setToast({ msg, type });
    setTimeout(()=>setToast(null), 3500);
  };

  const fetchTeam = useCallback(async () => {
    if (!isCompanyAccount || !user?.company_id) { setLoading(false); return; }
    setLoading(true); setFetchErr(null);
    try {
      const res  = await fetch(`${API_BASE}/company/team`, { headers: await getAuthHeaders() });
      const data = await res.json();
      if (res.ok) {
        setCompany(data.company||null);
        setMembers(Array.isArray(data.members)?data.members:[]);
      } else {
        setFetchErr(data.error||"Could not load company.");
      }
    } catch(_) {
      setFetchErr("Network error — could not load company.");
    } finally {
      setLoading(false);
    }
  }, [isCompanyAccount, user?.company_id]);

  useEffect(() => { fetchTeam(); }, [fetchTeam]);

  const handleEditComplete = async (updatedCompany) => {
    setCompany(updatedCompany);
    setEditing(false);
    if (updateUser) updateUser({ company_id: updatedCompany.id });
    showToast("Company details saved successfully!");
    // Re-fetch to get server-confirmed values including logo_url
    setTimeout(() => fetchTeam(), 800);
  };

  const handleRoleChange = async (userId, role) => {
    try {
      const res  = await fetch(`${API_BASE}/company/team/${userId}/role`, {
        method:"PATCH", headers:await getAuthHeaders(), body:JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast("Role updated.");
      fetchTeam();
    } catch(err) {
      showToast(err.message||"Failed to update role.", "error");
    }
  };

  const handleRemoveMember = async (userId) => {
    try {
      const res  = await fetch(`${API_BASE}/company/team/${userId}`, {
        method:"DELETE", headers:await getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast("Member removed.");
      fetchTeam();
    } catch(err) {
      showToast(err.message||"Failed to remove member.", "error");
    }
  };

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:300, gap:14 }}>
      <Spinner size={22} color="#6366f1"/>
      <span style={{ color:"#6b7a94", fontSize:14 }}>Loading…</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ minHeight:"100%", background:"transparent", padding:"28px 16px 60px",
      fontFamily:"'DM Sans','Segoe UI',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes spin    { to   { transform: rotate(360deg); } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(12px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes pulse   { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${tk.border}; border-radius: 4px; }
        button:focus-visible { outline: 2px solid ${tk.accentBorder}; outline-offset: 2px; }
      `}</style>

      <Toast toast={toast} tk={tk}/>

      <div style={{ maxWidth:580, margin:"0 auto", display:"flex", flexDirection:"column", gap:18 }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"flex-start", gap:13 }}>
            <div style={{ width:40, height:40, borderRadius:12, background:tk.accentBg, border:`1px solid ${tk.accentBorder}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:2 }}>
              <Zap size={17} color={tk.accentText}/>
            </div>
            <div>
              <h1 style={{ margin:"0 0 2px", fontSize:19, fontWeight:800, color:tk.text, letterSpacing:"-0.02em" }}>
                {isCompanyAccount ? "Company Workspace" : "Join a Company"}
              </h1>
              <p style={{ margin:0, fontSize:13, color:tk.subtle }}>
                {isCompanyAccount
                  ? "Manage your company profile, team members and invitations."
                  : "Enter an invite code or open an invite link to join your team."}
              </p>
            </div>
          </div>
          {darkProp===undefined&&(
            <button onClick={()=>setDarkLocal(d=>!d)} style={{ flexShrink:0, marginTop:2, width:34, height:34, borderRadius:9, background:tk.card, border:`1px solid ${tk.border}`, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:tk.subtle, transition:"all 0.2s" }}>
              {dark?<Sun size={14}/>:<Moon size={14}/>}
            </button>
          )}
        </div>

        {fetchErr&&(
          <AlertBox type="warning" tk={tk}>
            <AlertCircle size={14} style={{flexShrink:0}}/> {fetchErr}{" "}
            <button onClick={fetchTeam} style={{ background:"none", border:"none", color:tk.amber, cursor:"pointer", fontWeight:600, padding:"0 0 0 4px", fontFamily:"inherit", fontSize:13, display:"inline-flex", alignItems:"center", gap:3 }}>
              <RefreshCw size={11}/> Retry
            </button>
          </AlertBox>
        )}

        {/* Company account view */}
        {isCompanyAccount && (
          <>
            {editing ? (
              <div style={{ background:tk.surface, border:`1px solid ${tk.border}`, borderRadius:18, padding:"22px 24px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
                  <div>
                    <h2 style={{ margin:"0 0 2px", fontSize:15, fontWeight:700, color:tk.text }}>Edit Company Details</h2>
                    <p style={{ margin:0, fontSize:12, color:tk.subtle }}>Changes are saved permanently to your workspace.</p>
                  </div>
                  <button onClick={()=>setEditing(false)} style={{ background:"transparent", border:`1px solid ${tk.border}`, borderRadius:8, color:tk.subtle, cursor:"pointer", padding:7, display:"flex", transition:"all 0.15s" }}>
                    <X size={13}/>
                  </button>
                </div>
                {/* Use edit form (not wizard) for editing existing companies */}
                <CompanyEditForm
                  existingCompany={company}
                  onComplete={handleEditComplete}
                  onCancel={()=>setEditing(false)}
                  tk={tk}
                />
              </div>
            ) : (
              <>
                {!company?.industry && (
                  <AlertBox type="info" tk={tk}>
                    <Sparkles size={14} style={{flexShrink:0}}/>
                    <div>
                      <strong>Complete your company setup</strong> to generate an invite code and start adding team members.{" "}
                      <button onClick={()=>setEditing(true)} style={{ background:"none", border:"none", color:tk.accentText, cursor:"pointer", fontWeight:700, padding:0, fontFamily:"inherit", fontSize:13, textDecoration:"underline" }}>
                        Set up now →
                      </button>
                    </div>
                  </AlertBox>
                )}

                <CompanyCard company={company} companyName={companyName} canEdit={canEdit} onEdit={()=>setEditing(true)} tk={tk}/>

                {/* Team Members */}
                <div style={{ background:tk.surface, border:`1px solid ${tk.border}`, borderRadius:14, padding:"18px 20px" }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:13 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                      <Users size={14} color={tk.accentText}/>
                      <h3 style={{ margin:0, fontSize:13, fontWeight:700, color:tk.text }}>
                        Team Members <span style={{ fontSize:12, color:tk.muted, fontWeight:400 }}>({members.length})</span>
                      </h3>
                    </div>
                    <button onClick={fetchTeam} style={{ background:"none", border:`1px solid ${tk.border}`, borderRadius:7, color:tk.subtle, cursor:"pointer", padding:"5px 7px", display:"flex", alignItems:"center" }}>
                      <RefreshCw size={12}/>
                    </button>
                  </div>
                  <MembersList members={members} currentUserId={user?.id} canEdit={canEdit} onRemove={handleRemoveMember} onRoleChange={handleRoleChange} tk={tk}/>
                </div>

                {/* Email invitations (owner + admin only) */}
                {["owner","admin"].includes(user?.role) && (
                  <div style={{ background:tk.surface, border:`1px solid ${tk.border}`, borderRadius:14, padding:"18px 20px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:13 }}>
                      <Mail size={14} color={tk.accentText}/>
                      <h3 style={{ margin:0, fontSize:13, fontWeight:700, color:tk.text }}>Invite by Email</h3>
                    </div>
                    <p style={{ margin:"0 0 12px", fontSize:12, color:tk.subtle, lineHeight:1.6 }}>
                      Send a direct invite link to a colleague. They'll get an email with a private join link.
                    </p>
                    <InviteByEmail tk={tk} onInviteSent={fetchTeam}/>
                  </div>
                )}

                {/* Join requests (owner + admin + manager) */}
                {canEdit && (
                  <div style={{ background:tk.surface, border:`1px solid ${tk.border}`, borderRadius:14, padding:"18px 20px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:13 }}>
                      <UserPlus size={14} color={tk.accentText}/>
                      <h3 style={{ margin:0, fontSize:13, fontWeight:700, color:tk.text }}>Join Requests</h3>
                    </div>
                    <JoinRequestsPanel onAccepted={fetchTeam} tk={tk}/>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Personal account — join view */}
        {!isCompanyAccount && <JoinView tk={tk}/>}
      </div>
    </div>
  );
}