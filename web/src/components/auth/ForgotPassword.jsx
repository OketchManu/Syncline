// web/src/components/auth/ForgotPassword.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Zap, ArrowLeft, CheckCircle } from 'lucide-react';

const API = 'http://localhost:3001/api';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    // ── Theme detection ──────────────────────────────────────────────────────
    const [dark, setDark] = useState(() => {
        const saved = localStorage.getItem('syncline_theme');
        if (saved !== null) return saved === 'dark';
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    useEffect(() => {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e) => {
            if (!localStorage.getItem('syncline_theme')) setDark(e.matches);
        };
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    const t = dark ? tokens.dark : tokens.light;
    // ────────────────────────────────────────────────────────────────────────

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res  = await fetch(`${API}/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || 'Something went wrong'); }
            else { setSent(true); }
        } catch {
            setError('Network error — please try again.');
        }
        setLoading(false);
    };

    return (
        <div style={{ ...s.page, background: t.bg }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
                @keyframes spin    { to { transform:rotate(360deg); } }
                @keyframes fadeUp  { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
                @keyframes drift   { 0%,100% { transform:translate(0,0); } 50% { transform:translate(20px,-15px); } }
                @keyframes popIn   { 0% { transform:scale(0.6); opacity:0; } 100% { transform:scale(1); opacity:1; } }
                .fp-input:focus    { border-color:#6366f1 !important; box-shadow:0 0 0 3px rgba(99,102,241,0.18) !important; outline:none; }
                .fp-btn:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 8px 28px rgba(99,102,241,0.5) !important; }
                .fp-back:hover     { color:#a5b4fc !important; }
                .fp-input::placeholder { color: ${t.placeholder}; }
            `}</style>

            {/* Background */}
            <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }}>
                {[
                    { w:600, h:600, top:'-220px', left:'-180px', c: t.blobColor1 },
                    { w:450, h:450, bottom:'-160px', right:'-160px', c: t.blobColor2 },
                ].map((b,i)=>(
                    <div key={i} style={{
                        position:'absolute', width:b.w, height:b.h, borderRadius:'50%',
                        background:`radial-gradient(circle, ${b.c} 0%, transparent 70%)`,
                        top:b.top, left:b.left, bottom:b.bottom, right:b.right,
                        animation:`drift ${16+i*5}s infinite ease-in-out`,
                    }}/>
                ))}
            </div>

            <div style={{ ...s.wrap, animation:'fadeUp 0.4s ease both' }}>
                {/* Brand mark */}
                <div style={s.brand}>
                    <div style={s.brandIcon}><Zap size={26} color="#fff" strokeWidth={2.5}/></div>
                    <span style={{ ...s.brandName, color: t.logoText }}>Syncline</span>
                </div>

                <div style={{ ...s.card, background: t.cardBg, border: `1px solid ${t.border}`, boxShadow: t.cardShadow }}>
                    {!sent ? (
                        <>
                            {/* Back */}
                            <button className="fp-back" onClick={() => navigate('/login')} style={{ ...s.back, color: t.muted }}>
                                <ArrowLeft size={14}/> Back to login
                            </button>

                            <div style={{ marginBottom:'28px' }}>
                                <div style={{ ...s.iconWrap, background: t.iconWrapBg, border: `1px solid ${t.iconWrapBorder}` }}>
                                    <Mail size={22} color="#6366f1"/>
                                </div>
                                <h2 style={{ ...s.title, color: t.text }}>Forgot your password?</h2>
                                <p style={{ ...s.sub, color: t.muted }}>
                                    No worries. Enter your email and we'll send you a reset link right away.
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                                <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                                    <label style={{ ...s.label, color: t.label }}>Email address</label>
                                    <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
                                        <Mail size={16} style={{ position:'absolute', left:'14px', color: t.iconColor, pointerEvents:'none' }}/>
                                        <input
                                            className="fp-input"
                                            type="email" value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            placeholder="name@company.com"
                                            style={{ ...s.input, background: t.inputBg, border: `1px solid ${t.border}`, color: t.text }}
                                            required disabled={loading}
                                        />
                                    </div>
                                </div>

                                {error && (
                                    <div style={s.errBox}>
                                        <span>⚠️</span><span style={{ fontSize:'13px' }}>{error}</span>
                                    </div>
                                )}

                                <button className="fp-btn" type="submit" disabled={loading} style={{
                                    ...s.submitBtn,
                                    ...(loading ? { opacity:.65, cursor:'not-allowed', transform:'none' } : {}),
                                }}>
                                    {loading
                                        ? <><div style={s.spinner}/><span>Sending…</span></>
                                        : <><Mail size={16}/><span>Send reset link</span></>
                                    }
                                </button>
                            </form>

                            <p style={{ marginTop:'22px', textAlign:'center', fontSize:'13px', color: t.mutedAlt }}>
                                Remember your password?{' '}
                                <span onClick={() => navigate('/login')}
                                    style={{ color:'#6366f1', fontWeight:'700', cursor:'pointer' }}>
                                    Sign in
                                </span>
                            </p>
                        </>
                    ) : (
                        /* Success state */
                        <div style={{ textAlign:'center', padding:'8px 0', animation:'fadeUp 0.4s ease both' }}>
                            <div style={{ ...s.successIcon, animation:'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both' }}>
                                <CheckCircle size={32} color="#10b981" strokeWidth={2}/>
                            </div>
                            <h2 style={{ ...s.title, marginBottom:'10px', color: t.text }}>Check your email</h2>
                            <p style={{ ...s.sub, marginBottom:'6px', color: t.muted }}>
                                We sent a password reset link to
                            </p>
                            <p style={{ margin:'0 0 28px', fontSize:'14px', fontWeight:'700', color:'#a5b4fc' }}>
                                {email}
                            </p>
                            <p style={{ margin:'0 0 28px', fontSize:'12px', color: t.mutedAlt, lineHeight:1.6 }}>
                                The link expires in <strong style={{ color: t.muted }}>1 hour</strong>.
                                Check your spam folder if you don't see it.
                            </p>
                            <button onClick={() => navigate('/login')} style={{ ...s.submitBtn, width:'100%' }}
                                className="fp-btn">
                                <ArrowLeft size={16}/> Back to login
                            </button>
                            <p style={{ marginTop:'16px', fontSize:'12px', color: t.mutedAlt }}>
                                Didn't receive it?{' '}
                                <span onClick={() => { setSent(false); }}
                                    style={{ color:'#6366f1', fontWeight:'600', cursor:'pointer' }}>
                                    Try again
                                </span>
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ── Theme tokens ─────────────────────────────────────────────────────────────
const tokens = {
    dark: {
        bg:             '#080c1a',
        blobColor1:     'rgba(99,102,241,0.11)',
        blobColor2:     'rgba(139,92,246,0.09)',
        cardBg:         'rgba(15,23,42,0.88)',
        cardShadow:     '0 24px 64px rgba(0,0,0,0.6)',
        border:         'rgba(255,255,255,0.08)',
        text:           '#f1f5f9',
        logoText:       '#f1f5f9',
        label:          '#94a3b8',
        muted:          '#64748b',
        mutedAlt:       '#475569',
        iconColor:      '#64748b',
        inputBg:        'rgba(255,255,255,0.05)',
        placeholder:    '#475569',
        iconWrapBg:     'rgba(99,102,241,0.12)',
        iconWrapBorder: 'rgba(99,102,241,0.2)',
    },
    light: {
        bg:             '#f0f4ff',
        blobColor1:     'rgba(99,102,241,0.10)',
        blobColor2:     'rgba(139,92,246,0.08)',
        cardBg:         'rgba(255,255,255,0.88)',
        cardShadow:     '0 24px 64px rgba(99,102,241,0.12)',
        border:         'rgba(99,102,241,0.15)',
        text:           '#0f172a',
        logoText:       '#0f172a',
        label:          '#475569',
        muted:          '#64748b',
        mutedAlt:       '#94a3b8',
        iconColor:      '#94a3b8',
        inputBg:        'rgba(241,245,249,0.8)',
        placeholder:    '#94a3b8',
        iconWrapBg:     'rgba(99,102,241,0.08)',
        iconWrapBorder: 'rgba(99,102,241,0.15)',
    },
};
// ─────────────────────────────────────────────────────────────────────────────

const s = {
    page: {
        minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
        position:'relative', overflow:'hidden',
        padding:'24px', fontFamily:"'DM Sans', system-ui, sans-serif",
    },
    wrap:      { position:'relative', zIndex:1, width:'100%', maxWidth:'400px' },
    brand:     { display:'flex', alignItems:'center', justifyContent:'center', gap:'10px', marginBottom:'28px' },
    brandIcon: {
        width:'40px', height:'40px', background:'linear-gradient(135deg,#6366f1,#8b5cf6)',
        borderRadius:'11px', display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow:'0 6px 24px rgba(99,102,241,0.4)',
    },
    brandName: { fontSize:'20px', fontWeight:'800', letterSpacing:'-0.3px' },
    card: {
        backdropFilter:'blur(24px)',
        borderRadius:'22px',
        padding:'32px',
    },
    back: {
        display:'inline-flex', alignItems:'center', gap:'6px', background:'none', border:'none',
        fontSize:'13px', fontWeight:'600', cursor:'pointer',
        padding:0, marginBottom:'24px', transition:'color 0.2s',
    },
    iconWrap: {
        width:'52px', height:'52px', borderRadius:'14px',
        display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'18px',
    },
    title: { margin:'0 0 8px', fontSize:'21px', fontWeight:'700', letterSpacing:'-0.3px' },
    sub:   { margin:0, fontSize:'13px', lineHeight:1.6 },
    label: { fontSize:'12px', fontWeight:'600', textTransform:'uppercase', letterSpacing:'0.05em' },
    input: {
        width:'100%', padding:'12px 14px 12px 40px',
        borderRadius:'10px', fontSize:'14px',
        transition:'border-color 0.2s, box-shadow 0.2s', boxSizing:'border-box',
    },
    errBox: {
        display:'flex', alignItems:'center', gap:'8px', padding:'10px 14px',
        background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)',
        borderRadius:'10px', color:'#fca5a5',
    },
    submitBtn: {
        width:'100%', padding:'13px', display:'flex', alignItems:'center', justifyContent:'center',
        gap:'8px', background:'linear-gradient(135deg,#6366f1,#8b5cf6)', border:'none',
        borderRadius:'12px', color:'#fff', fontSize:'15px', fontWeight:'700',
        cursor:'pointer', transition:'all 0.2s', boxShadow:'0 4px 20px rgba(99,102,241,0.4)',
    },
    spinner: {
        width:'16px', height:'16px', border:'2px solid rgba(255,255,255,0.3)',
        borderTop:'2px solid #fff', borderRadius:'50%', animation:'spin 0.75s linear infinite',
    },
    successIcon: {
        width:'72px', height:'72px', borderRadius:'50%',
        background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.25)',
        display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 22px',
    },
};

export default ForgotPassword;