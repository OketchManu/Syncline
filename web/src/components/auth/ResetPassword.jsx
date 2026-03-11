// web/src/components/auth/ResetPassword.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Lock, Zap, CheckCircle, XCircle, ShieldCheck } from 'lucide-react';

const API = 'http://localhost:3001/api';

const rules = [
    { label: 'At least 8 characters', test: p => p.length >= 8 },
    { label: 'One uppercase letter',   test: p => /[A-Z]/.test(p) },
    { label: 'One number',             test: p => /\d/.test(p) },
];

const ResetPassword = () => {
    const [searchParams]  = useSearchParams();
    const token           = searchParams.get('token');
    const navigate        = useNavigate();

    const [password,     setPassword]     = useState('');
    const [confirm,      setConfirm]      = useState('');
    const [showPw,       setShowPw]       = useState(false);
    const [showConfirm,  setShowConfirm]  = useState(false);
    const [loading,      setLoading]      = useState(false);
    const [done,         setDone]         = useState(false);
    const [error,        setError]        = useState('');

    // Redirect if no token in URL
    useEffect(() => {
        if (!token) navigate('/forgot-password');
    }, [token, navigate]);

    const strength = rules.filter(r => r.test(password)).length;
    const strengthColors  = ['#ef4444','#ef4444','#f59e0b','#10b981'];
    const strengthLabels  = ['','Weak','Fair','Strong'];

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (strength < 2) { setError('Please choose a stronger password.'); return; }
        if (password !== confirm) { setError('Passwords do not match.'); return; }

        setLoading(true);
        try {
            const res  = await fetch(`${API}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || 'Reset failed.'); }
            else { setDone(true); }
        } catch {
            setError('Network error — please try again.');
        }
        setLoading(false);
    };

    return (
        <div style={s.page}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
                @keyframes spin   { to { transform:rotate(360deg); } }
                @keyframes fadeUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
                @keyframes drift  { 0%,100% { transform:translate(0,0); } 50% { transform:translate(20px,-15px); } }
                @keyframes popIn  { 0% { transform:scale(0.6); opacity:0; } 100% { transform:scale(1); opacity:1; } }
                .rp-input:focus   { border-color:#6366f1 !important; box-shadow:0 0 0 3px rgba(99,102,241,0.18) !important; outline:none; }
                .rp-btn:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 8px 28px rgba(99,102,241,0.5) !important; }
            `}</style>

            {/* Background blobs */}
            <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }}>
                {[
                    { w:600, h:600, top:'-200px', left:'-180px', c:'rgba(99,102,241,0.11)' },
                    { w:450, h:450, bottom:'-160px', right:'-160px', c:'rgba(139,92,246,0.09)' },
                ].map((b,i) => (
                    <div key={i} style={{
                        position:'absolute', width:b.w, height:b.h, borderRadius:'50%',
                        background:`radial-gradient(circle, ${b.c} 0%, transparent 70%)`,
                        top:b.top, left:b.left, bottom:b.bottom, right:b.right,
                        animation:`drift ${16+i*5}s infinite ease-in-out`,
                    }}/>
                ))}
            </div>

            <div style={{ ...s.wrap, animation:'fadeUp 0.4s ease both' }}>
                {/* Brand */}
                <div style={s.brand}>
                    <div style={s.brandIcon}><Zap size={26} color="#fff" strokeWidth={2.5}/></div>
                    <span style={s.brandName}>Syncline</span>
                </div>

                <div style={s.card}>
                    {!done ? (
                        <>
                            <div style={{ marginBottom:'28px' }}>
                                <div style={s.iconWrap}>
                                    <ShieldCheck size={22} color="#6366f1"/>
                                </div>
                                <h2 style={s.title}>Set a new password</h2>
                                <p style={s.sub}>Choose something secure that you haven't used before.</p>
                            </div>

                            <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                                {/* New password */}
                                <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                                    <label style={s.label}>New password</label>
                                    <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
                                        <Lock size={16} style={{ position:'absolute', left:'14px', color:'#64748b', pointerEvents:'none' }}/>
                                        <input
                                            className="rp-input"
                                            type={showPw ? 'text' : 'password'}
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            placeholder="Min. 8 characters"
                                            style={{ ...s.input, paddingRight:'44px' }}
                                            required disabled={loading}
                                        />
                                        <button type="button" onClick={() => setShowPw(!showPw)} style={s.eyeBtn}>
                                            {showPw ? <EyeOff size={16} color="#64748b"/> : <Eye size={16} color="#64748b"/>}
                                        </button>
                                    </div>

                                    {/* Strength bar */}
                                    {password && (
                                        <div>
                                            <div style={{ display:'flex', gap:'4px', marginBottom:'6px' }}>
                                                {[1,2,3].map(i => (
                                                    <div key={i} style={{
                                                        flex:1, height:'3px', borderRadius:'2px',
                                                        background: i <= strength ? strengthColors[strength] : 'rgba(255,255,255,0.08)',
                                                        transition:'background 0.25s',
                                                    }}/>
                                                ))}
                                            </div>
                                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                                <span style={{ fontSize:'11px', color: strengthColors[strength], fontWeight:'600' }}>
                                                    {strengthLabels[strength]}
                                                </span>
                                                <div style={{ display:'flex', gap:'10px' }}>
                                                    {rules.map((r,i) => (
                                                        <span key={i} style={{ display:'flex', alignItems:'center', gap:'3px', fontSize:'10px', color: r.test(password) ? '#10b981' : '#475569' }}>
                                                            {r.test(password)
                                                                ? <CheckCircle size={10} color="#10b981"/>
                                                                : <XCircle    size={10} color="#475569"/>
                                                            }
                                                            {r.label}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Confirm password */}
                                <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                                    <label style={s.label}>Confirm password</label>
                                    <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
                                        <Lock size={16} style={{ position:'absolute', left:'14px', color:'#64748b', pointerEvents:'none' }}/>
                                        <input
                                            className="rp-input"
                                            type={showConfirm ? 'text' : 'password'}
                                            value={confirm}
                                            onChange={e => setConfirm(e.target.value)}
                                            placeholder="Re-enter your password"
                                            style={{
                                                ...s.input, paddingRight:'44px',
                                                ...(confirm && confirm !== password
                                                    ? { borderColor:'rgba(239,68,68,0.4)' }
                                                    : confirm && confirm === password
                                                        ? { borderColor:'rgba(16,185,129,0.4)' }
                                                        : {}
                                                ),
                                            }}
                                            required disabled={loading}
                                        />
                                        <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={s.eyeBtn}>
                                            {showConfirm ? <EyeOff size={16} color="#64748b"/> : <Eye size={16} color="#64748b"/>}
                                        </button>
                                    </div>
                                    {confirm && confirm !== password && (
                                        <span style={{ fontSize:'11px', color:'#f87171', marginTop:'2px' }}>Passwords don't match</span>
                                    )}
                                    {confirm && confirm === password && (
                                        <span style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'11px', color:'#10b981', marginTop:'2px' }}>
                                            <CheckCircle size={11}/> Passwords match
                                        </span>
                                    )}
                                </div>

                                {error && (
                                    <div style={s.errBox}>
                                        <span>⚠️</span><span style={{ fontSize:'13px' }}>{error}</span>
                                    </div>
                                )}

                                <button className="rp-btn" type="submit" disabled={loading} style={{
                                    ...s.submitBtn,
                                    ...(loading ? { opacity:.65, cursor:'not-allowed', transform:'none' } : {}),
                                }}>
                                    {loading
                                        ? <><div style={s.spinner}/><span>Resetting…</span></>
                                        : <><ShieldCheck size={16}/><span>Reset Password</span></>
                                    }
                                </button>
                            </form>
                        </>
                    ) : (
                        /* Success */
                        <div style={{ textAlign:'center', padding:'8px 0', animation:'fadeUp 0.4s ease both' }}>
                            <div style={{ ...s.successIcon, animation:'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both' }}>
                                <CheckCircle size={32} color="#10b981" strokeWidth={2}/>
                            </div>
                            <h2 style={{ ...s.title, marginBottom:'10px' }}>Password updated!</h2>
                            <p style={{ ...s.sub, marginBottom:'28px' }}>
                                Your password has been reset successfully. You can now sign in with your new password.
                            </p>
                            <button className="rp-btn" onClick={() => navigate('/login')} style={{ ...s.submitBtn, width:'100%' }}>
                                <Zap size={16}/> Sign in now
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const s = {
    page: {
        minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
        background:'#080c1a', position:'relative', overflow:'hidden',
        padding:'24px', fontFamily:"'DM Sans', system-ui, sans-serif",
    },
    wrap:      { position:'relative', zIndex:1, width:'100%', maxWidth:'420px' },
    brand:     { display:'flex', alignItems:'center', justifyContent:'center', gap:'10px', marginBottom:'28px' },
    brandIcon: {
        width:'40px', height:'40px', background:'linear-gradient(135deg,#6366f1,#8b5cf6)',
        borderRadius:'11px', display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow:'0 6px 24px rgba(99,102,241,0.4)',
    },
    brandName: { fontSize:'20px', fontWeight:'800', color:'#f1f5f9', letterSpacing:'-0.3px' },
    card: {
        background:'rgba(15,23,42,0.88)', backdropFilter:'blur(24px)',
        border:'1px solid rgba(255,255,255,0.08)', borderRadius:'22px',
        padding:'32px', boxShadow:'0 24px 64px rgba(0,0,0,0.6)',
    },
    iconWrap: {
        width:'52px', height:'52px', borderRadius:'14px',
        background:'rgba(99,102,241,0.12)', border:'1px solid rgba(99,102,241,0.2)',
        display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'18px',
    },
    title: { margin:'0 0 8px', fontSize:'21px', fontWeight:'700', color:'#f1f5f9', letterSpacing:'-0.3px' },
    sub:   { margin:0, fontSize:'13px', color:'#64748b', lineHeight:1.6 },
    label: { fontSize:'12px', fontWeight:'600', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em' },
    input: {
        width:'100%', padding:'12px 14px 12px 40px',
        background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.09)',
        borderRadius:'10px', fontSize:'14px', color:'#f1f5f9',
        transition:'border-color 0.2s, box-shadow 0.2s', boxSizing:'border-box',
    },
    eyeBtn: {
        position:'absolute', right:'10px', background:'none', border:'none',
        cursor:'pointer', padding:'6px', display:'flex', borderRadius:'6px',
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

export default ResetPassword;