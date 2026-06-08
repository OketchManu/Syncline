// web/src/components/auth/ResetPassword.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Lock, Zap, CheckCircle, XCircle, ShieldCheck } from 'lucide-react';
import { auth } from '../../firebase.js';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';

const rules = [
    { label: 'At least 8 characters', test: p => p.length >= 8 },
    { label: 'One uppercase letter',   test: p => /[A-Z]/.test(p) },
    { label: 'One number',             test: p => /\d/.test(p) },
];

const ResetPassword = () => {
    const [searchParams] = useSearchParams();
    const oobCode = searchParams.get('oobCode') || searchParams.get('token');
    const navigate = useNavigate();

    const [email,       setEmail]       = useState('');
    const [password,    setPassword]    = useState('');
    const [confirm,     setConfirm]     = useState('');
    const [showPw,      setShowPw]      = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading,     setLoading]     = useState(false);
    const [verifying,   setVerifying]   = useState(true);
    const [codeError,   setCodeError]   = useState('');
    const [done,        setDone]        = useState(false);
    const [error,       setError]       = useState('');

    const [dark, setDark] = useState(() => {
        const saved = localStorage.getItem('syncline_theme');
        if (saved !== null) return saved === 'dark';
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    useEffect(() => {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e) => { if (!localStorage.getItem('syncline_theme')) setDark(e.matches); };
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    const t = dark ? tokens.dark : tokens.light;

    useEffect(() => {
        if (!oobCode) { navigate('/forgot-password'); return; }
        (async () => {
            try {
                const resolvedEmail = await verifyPasswordResetCode(auth, oobCode);
                setEmail(resolvedEmail);
            } catch {
                setCodeError('This reset link is invalid or has expired. Please request a new one.');
            } finally {
                setVerifying(false);
            }
        })();
    }, [oobCode, navigate]);

    const strength = rules.filter(r => r.test(password)).length;
    const strengthColors = ['#ef4444', '#ef4444', '#f59e0b', '#10b981'];
    const strengthLabels = ['', 'Weak', 'Fair', 'Strong'];

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (strength < 2) { setError('Please choose a stronger password.'); return; }
        if (password !== confirm) { setError('Passwords do not match.'); return; }
        setLoading(true);
        try {
            await confirmPasswordReset(auth, oobCode, password);
            setDone(true);
        } catch (err) {
            setError(
                err.code === 'auth/expired-action-code' ? 'This reset link has expired. Please request a new one.'
                : err.code === 'auth/invalid-action-code' ? 'This reset link is invalid. Please request a new one.'
                : 'Failed to reset password. Please try again.'
            );
        }
        setLoading(false);
    };

    return (
        <div style={{ ...s.page, background: t.bg }}>
            <style>{`
                @keyframes spin   { to { transform:rotate(360deg); } }
                @keyframes fadeUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
                @keyframes popIn  { 0%{transform:scale(0.6);opacity:0} 100%{transform:scale(1);opacity:1} }
                .rp-input:focus { border-color:#6366f1 !important; box-shadow:0 0 0 3px rgba(99,102,241,0.18) !important; outline:none; }
                .rp-btn:hover:not(:disabled) { transform:translateY(-1px); }
                .rp-input::placeholder { color: ${t.placeholder}; }
            `}</style>

            <div style={{ ...s.wrap, animation: 'fadeUp 0.4s ease both' }}>
                <div style={s.brand}>
                    <div style={s.brandIcon}><Zap size={26} color="#fff" /></div>
                    <span style={{ ...s.brandName, color: t.logoText }}>Syncline</span>
                </div>

                <div style={{ ...s.card, background: t.cardBg, border: `1px solid ${t.border}`, boxShadow: t.cardShadow }}>
                    {verifying ? (
                        <div style={{ textAlign:'center', padding:'20px 0' }}>
                            <div style={{ ...s.spinner, margin:'0 auto 16px', width:'28px', height:'28px' }} />
                            <p style={{ color:t.muted, fontSize:'14px', margin:0 }}>Verifying your reset link…</p>
                        </div>
                    ) : codeError ? (
                        <div style={{ textAlign:'center', padding:'8px 0' }}>
                            <div style={{ width:'60px',height:'60px',borderRadius:'50%',background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.25)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px' }}>
                                <XCircle size={28} color="#ef4444" />
                            </div>
                            <h2 style={{ ...s.title, color:t.text, marginBottom:'10px' }}>Link expired</h2>
                            <p style={{ ...s.sub, color:t.muted, marginBottom:'28px' }}>{codeError}</p>
                            <button className="rp-btn" onClick={() => navigate('/forgot-password')} style={{ ...s.submitBtn, width:'100%' }}>Request a new link</button>
                        </div>
                    ) : !done ? (
                        <>
                            <div style={{ marginBottom:'28px' }}>
                                <div style={{ ...s.iconWrap, background:t.iconWrapBg, border:`1px solid ${t.iconWrapBorder}` }}>
                                    <ShieldCheck size={22} color="#6366f1" />
                                </div>
                                <h2 style={{ ...s.title, color:t.text }}>Set a new password</h2>
                                <p style={{ ...s.sub, color:t.muted }}>Resetting password for <strong style={{ color:t.text }}>{email}</strong></p>
                            </div>
                            <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                                <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                                    <label style={{ ...s.label, color:t.label }}>New password</label>
                                    <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
                                        <Lock size={16} style={{ position:'absolute', left:'14px', color:t.iconColor, pointerEvents:'none' }} />
                                        <input className="rp-input" type={showPw?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Min. 8 characters"
                                            style={{ ...s.input, paddingRight:'44px', background:t.inputBg, border:`1px solid ${t.border}`, color:t.text }} required disabled={loading} />
                                        <button type="button" onClick={()=>setShowPw(!showPw)} style={s.eyeBtn}>
                                            {showPw ? <EyeOff size={16} color={t.iconColor} /> : <Eye size={16} color={t.iconColor} />}
                                        </button>
                                    </div>
                                    {password && (
                                        <div>
                                            <div style={{ display:'flex', gap:'4px', marginBottom:'6px' }}>
                                                {[1,2,3].map(i => <div key={i} style={{ flex:1,height:'3px',borderRadius:'2px',background:i<=strength?strengthColors[strength]:t.strengthBarBg,transition:'background 0.25s' }} />)}
                                            </div>
                                            <span style={{ fontSize:'11px', color:strengthColors[strength], fontWeight:'600' }}>{strengthLabels[strength]}</span>
                                        </div>
                                    )}
                                </div>
                                <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                                    <label style={{ ...s.label, color:t.label }}>Confirm password</label>
                                    <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
                                        <Lock size={16} style={{ position:'absolute', left:'14px', color:t.iconColor, pointerEvents:'none' }} />
                                        <input className="rp-input" type={showConfirm?'text':'password'} value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Re-enter your password"
                                            style={{ ...s.input, paddingRight:'44px', background:t.inputBg, color:t.text, border:`1px solid ${confirm&&confirm!==password?'rgba(239,68,68,0.4)':confirm&&confirm===password?'rgba(16,185,129,0.4)':t.border}` }}
                                            required disabled={loading} />
                                        <button type="button" onClick={()=>setShowConfirm(!showConfirm)} style={s.eyeBtn}>
                                            {showConfirm ? <EyeOff size={16} color={t.iconColor} /> : <Eye size={16} color={t.iconColor} />}
                                        </button>
                                    </div>
                                    {confirm && confirm !== password && <span style={{ fontSize:'11px', color:'#f87171' }}>Passwords don't match</span>}
                                    {confirm && confirm === password && <span style={{ fontSize:'11px', color:'#10b981', display:'flex', alignItems:'center', gap:'4px' }}><CheckCircle size={11} /> Passwords match</span>}
                                </div>
                                {error && <div style={s.errBox}><span>⚠️</span><span style={{ fontSize:'13px' }}>{error}</span></div>}
                                <button className="rp-btn" type="submit" disabled={loading} style={{ ...s.submitBtn, ...(loading?{opacity:0.65,cursor:'not-allowed'}:{}) }}>
                                    {loading ? <><div style={s.spinner}/><span>Resetting…</span></> : <><ShieldCheck size={16}/><span>Reset Password</span></>}
                                </button>
                            </form>
                        </>
                    ) : (
                        <div style={{ textAlign:'center', padding:'8px 0' }}>
                            <div style={{ ...s.successIcon }}>
                                <CheckCircle size={32} color="#10b981" strokeWidth={2} />
                            </div>
                            <h2 style={{ ...s.title, marginBottom:'10px', color:t.text }}>Password updated!</h2>
                            <p style={{ ...s.sub, marginBottom:'28px', color:t.muted }}>You can now sign in with your new password.</p>
                            <button className="rp-btn" onClick={() => navigate('/login')} style={{ ...s.submitBtn, width:'100%' }}>
                                <Zap size={16} /> Sign in now
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const tokens = {
    dark:  { bg:'#080c1a', cardBg:'rgba(15,23,42,0.88)', cardShadow:'0 24px 64px rgba(0,0,0,0.6)', border:'rgba(255,255,255,0.08)', text:'#f1f5f9', logoText:'#f1f5f9', label:'#94a3b8', muted:'#64748b', iconColor:'#64748b', inputBg:'rgba(255,255,255,0.05)', placeholder:'#475569', iconWrapBg:'rgba(99,102,241,0.12)', iconWrapBorder:'rgba(99,102,241,0.2)', strengthBarBg:'rgba(255,255,255,0.08)' },
    light: { bg:'#f0f4ff', cardBg:'rgba(255,255,255,0.88)', cardShadow:'0 24px 64px rgba(99,102,241,0.12)', border:'rgba(99,102,241,0.15)', text:'#0f172a', logoText:'#0f172a', label:'#475569', muted:'#64748b', iconColor:'#94a3b8', inputBg:'rgba(241,245,249,0.8)', placeholder:'#94a3b8', iconWrapBg:'rgba(99,102,241,0.08)', iconWrapBorder:'rgba(99,102,241,0.15)', strengthBarBg:'rgba(99,102,241,0.08)' },
};

const s = {
    page:       { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden', padding:'clamp(16px,4vw,24px)', fontFamily:"'DM Sans', system-ui, sans-serif" },
    wrap:       { position:'relative', zIndex:1, width:'100%', maxWidth:'420px' },
    brand:      { display:'flex', alignItems:'center', justifyContent:'center', gap:'10px', marginBottom:'clamp(20px,5vw,28px)' },
    brandIcon:  { width:'40px', height:'40px', background:'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius:'11px', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 6px 24px rgba(99,102,241,0.4)' },
    brandName:  { fontSize:'20px', fontWeight:'800', letterSpacing:'-0.3px' },
    card:       { backdropFilter:'blur(24px)', borderRadius:'22px', padding:'clamp(24px,6vw,32px)' },
    iconWrap:   { width:'52px', height:'52px', borderRadius:'14px', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'18px' },
    title:      { margin:'0 0 8px', fontSize:'21px', fontWeight:'700', letterSpacing:'-0.3px' },
    sub:        { margin:0, fontSize:'13px', lineHeight:1.6 },
    label:      { fontSize:'12px', fontWeight:'600', textTransform:'uppercase', letterSpacing:'0.05em' },
    input:      { width:'100%', padding:'12px 14px 12px 40px', borderRadius:'10px', fontSize:'14px', transition:'border-color 0.2s, box-shadow 0.2s', boxSizing:'border-box' },
    eyeBtn:     { position:'absolute', right:'10px', background:'none', border:'none', cursor:'pointer', padding:'6px', display:'flex', borderRadius:'6px' },
    errBox:     { display:'flex', alignItems:'center', gap:'8px', padding:'10px 14px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:'10px', color:'#fca5a5' },
    submitBtn:  { width:'100%', padding:'13px', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', background:'linear-gradient(135deg,#6366f1,#8b5cf6)', border:'none', borderRadius:'12px', color:'#fff', fontSize:'15px', fontWeight:'700', cursor:'pointer', transition:'all 0.2s', boxShadow:'0 4px 20px rgba(99,102,241,0.4)' },
    spinner:    { width:'16px', height:'16px', border:'2px solid rgba(255,255,255,0.3)', borderTop:'2px solid #fff', borderRadius:'50%', animation:'spin 0.75s linear infinite' },
    successIcon:{ width:'72px', height:'72px', borderRadius:'50%', background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.25)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 22px' },
};

export default ResetPassword;