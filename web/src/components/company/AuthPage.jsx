import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
    Mail, Lock, User, Building2, Eye, EyeOff,
    AlertCircle, CheckCircle2, Loader2, ArrowRight,
    RotateCcw, Zap
} from 'lucide-react';

// ─── Minimal theme (matches Syncline dark) ────────────────────────────────────
const T = {
    bg:           '#05080f',
    surface:      '#0a0f1e',
    card:         '#0f1628',
    border:       'rgba(255,255,255,0.07)',
    borderMid:    'rgba(255,255,255,0.13)',
    text:         '#94a3b8',
    textPrimary:  '#f0f4ff',
    textMuted:    '#3d4f6e',
    accent:       '#7c3aed',
    accentLight:  '#a78bfa',
    accentBg:     'rgba(124,58,237,0.1)',
    accentBorder: 'rgba(124,58,237,0.28)',
    accentGrad:   'linear-gradient(135deg,#7c3aed 0%,#5b21b6 100%)',
    inputBg:      'rgba(255,255,255,0.04)',
    danger:       '#ef4444',
    dangerBg:     'rgba(239,68,68,0.1)',
    dangerBorder: 'rgba(239,68,68,0.25)',
    success:      '#10b981',
    successBg:    'rgba(16,185,129,0.1)',
    successBorder:'rgba(16,185,129,0.25)',
    google:       '#ffffff',
    googleBg:     'rgba(255,255,255,0.06)',
    googleBorder: 'rgba(255,255,255,0.14)',
};

// ─── Tiny atoms ───────────────────────────────────────────────────────────────
const Spinner = () => (
    <Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
);

const FieldInput = ({ icon: Icon, label, type = 'text', value, onChange, placeholder, right }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</label>
        <div style={{ position: 'relative' }}>
            {Icon && <Icon size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: T.textMuted, pointerEvents: 'none' }} />}
            <input
                type={type} value={value} onChange={onChange} placeholder={placeholder}
                style={{ width: '100%', padding: `10px 40px 10px ${Icon ? 36 : 13}px`, background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 13, color: T.textPrimary, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.2s, box-shadow 0.2s' }}
                onFocus={e => { e.target.style.borderColor = T.accentBorder; e.target.style.boxShadow = `0 0 0 3px ${T.accentBg}`; }}
                onBlur={e => { e.target.style.borderColor = T.border; e.target.style.boxShadow = 'none'; }}
            />
            {right && <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>{right}</div>}
        </div>
    </div>
);

const Alert = ({ type, children }) => {
    const isErr = type === 'error';
    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '11px 14px', background: isErr ? T.dangerBg : T.successBg, border: `1px solid ${isErr ? T.dangerBorder : T.successBorder}`, borderRadius: 10, fontSize: 13, color: isErr ? T.danger : T.success, lineHeight: 1.55 }}>
            {isErr ? <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> : <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: 1 }} />}
            <span>{children}</span>
        </div>
    );
};

const Divider = ({ label }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
        <div style={{ flex: 1, height: 1, background: T.border }} />
        <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 500 }}>{label}</span>
        <div style={{ flex: 1, height: 1, background: T.border }} />
    </div>
);

// ─── Google Button ────────────────────────────────────────────────────────────
const GoogleButton = ({ onClick, loading, label = 'Continue with Google' }) => (
    <button onClick={onClick} disabled={loading}
        style={{ width: '100%', padding: '11px', background: T.googleBg, border: `1px solid ${T.googleBorder}`, borderRadius: 10, color: T.google, fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, fontFamily: 'inherit', transition: 'all 0.2s', opacity: loading ? 0.6 : 1 }}
        onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = T.googleBg; }}>
        {loading ? <Spinner /> : (
            /* Google "G" SVG */
            <svg width="16" height="16" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                <path fill="none" d="M0 0h48v48H0z"/>
            </svg>
        )}
        {label}
    </button>
);

// ─── Password strength ────────────────────────────────────────────────────────
const PasswordStrength = ({ password }) => {
    if (!password) return null;
    const strength = password.length < 6 ? 1 : password.length < 8 ? 2 : password.length < 12 ? 3 : 4;
    const colors   = ['', '#ef4444', '#f59e0b', '#3b82f6', '#10b981'];
    const labels   = ['', 'Too weak', 'Weak', 'Good', 'Strong'];
    return (
        <div style={{ marginTop: 6 }}>
            <div style={{ display: 'flex', gap: 3, marginBottom: 3 }}>
                {[1,2,3,4].map(i => (
                    <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= strength ? colors[strength] : T.border, transition: 'background 0.2s' }} />
                ))}
            </div>
            <span style={{ fontSize: 10, color: colors[strength], fontWeight: 600 }}>{labels[strength]}</span>
        </div>
    );
};

// ─── Forgot Password Screen ───────────────────────────────────────────────────
const ForgotPasswordForm = ({ onBack }) => {
    const { resetPassword } = useAuth();
    const [email,   setEmail]   = useState('');
    const [loading, setLoading] = useState(false);
    const [result,  setResult]  = useState(null);

    const handleSubmit = async () => {
        if (!email.trim()) return;
        setLoading(true);
        const res = await resetPassword(email.trim());
        setResult(res);
        setLoading(false);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
                <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800, color: T.textPrimary }}>Reset password</h2>
                <p style={{ margin: 0, fontSize: 13, color: T.text }}>We'll send a reset link to your email.</p>
            </div>

            {result?.success
                ? <Alert type="success">Check your inbox — a reset link has been sent to <strong>{email}</strong>.</Alert>
                : <>
                    {result?.error && <Alert type="error">{result.error}</Alert>}
                    <FieldInput icon={Mail} label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
                    <button onClick={handleSubmit} disabled={loading || !email.trim()}
                        style={{ width: '100%', padding: '12px', background: loading || !email.trim() ? T.inputBg : T.accentGrad, border: 'none', borderRadius: 10, color: loading || !email.trim() ? T.textMuted : '#fff', fontSize: 13, fontWeight: 600, cursor: loading || !email.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontFamily: 'inherit', boxShadow: loading || !email.trim() ? 'none' : '0 4px 18px rgba(124,58,237,0.35)', transition: 'all 0.2s' }}>
                        {loading ? <><Spinner /> Sending…</> : <>Send reset link <ArrowRight size={14} /></>}
                    </button>
                </>
            }

            <button onClick={onBack} style={{ background: 'none', border: 'none', color: T.accentLight, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, padding: 0, fontFamily: 'inherit' }}>
                <RotateCcw size={12} /> Back to sign in
            </button>
        </div>
    );
};

// ─── Main AuthPage ────────────────────────────────────────────────────────────
export default function AuthPage({ onAuthenticated }) {
    const { login, register, loginWithGoogle, registerWithGoogle } = useAuth();

    const [mode,        setMode]        = useState('login');   // 'login' | 'register' | 'forgot'
    const [accountType, setAccountType] = useState('personal');
    const [email,       setEmail]       = useState('');
    const [password,    setPassword]    = useState('');
    const [confirmPw,   setConfirmPw]   = useState('');
    const [fullName,    setFullName]    = useState('');
    const [companyName, setCompanyName] = useState('');
    const [showPw,      setShowPw]      = useState(false);
    const [loading,     setLoading]     = useState(false);
    const [googleLoad,  setGoogleLoad]  = useState(false);
    const [error,       setError]       = useState(null);
    const [success,     setSuccess]     = useState(null);

    const isRegister = mode === 'register';

    const reset = () => { setError(null); setSuccess(null); };
    const switchMode = (m) => { reset(); setMode(m); };

    // ── Email submit ──────────────────────────────────────────────────────────
    const handleSubmit = async () => {
        reset();
        if (!email.trim() || !password) { setError('Please fill in all fields.'); return; }
        if (isRegister) {
            if (!fullName.trim()) { setError('Please enter your full name.'); return; }
            if (password !== confirmPw) { setError('Passwords do not match.'); return; }
            if (password.length < 6)   { setError('Password must be at least 6 characters.'); return; }
            if (accountType === 'company' && !companyName.trim()) { setError('Please enter your company name.'); return; }
        }

        setLoading(true);
        const res = isRegister
            ? await register(email.trim(), password, fullName.trim(), accountType, companyName.trim() || null)
            : await login(email.trim(), password);
        setLoading(false);

        if (!res.success) { setError(res.error); return; }
        if (res.emailVerificationSent) {
            setSuccess(`Account created! A verification email has been sent to ${email}. You can continue using the app.`);
        }
        onAuthenticated?.();
    };

    // ── Google submit ─────────────────────────────────────────────────────────
    const handleGoogle = async () => {
        reset();
        setGoogleLoad(true);

        const res = isRegister
            ? await registerWithGoogle(
                accountType || 'personal',
                accountType === 'company' ? companyName.trim() || null : null,
            )
            : await loginWithGoogle();

        setGoogleLoad(false);

        if (res.success) {
            onAuthenticated?.();
            return;
        }
        if (res.needsRegistration) {
            setError('No Syncline account found for this Google account. Please register first.');
            switchMode('register');
            if (res.googleUser?.email) setEmail(res.googleUser.email);
            if (res.googleUser?.fullName) setFullName(res.googleUser.fullName);
            return;
        }
        if (res.error) setError(res.error);
    };

    return (
        <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif" }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
                * { box-sizing: border-box; }
            `}</style>

            <div style={{ width: '100%', maxWidth: 420, animation: 'fadeUp 0.3s ease' }}>
                {/* Logo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32, justifyContent: 'center' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: T.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 18px rgba(124,58,237,0.4)' }}>
                        <Zap size={18} color="#fff" />
                    </div>
                    <span style={{ fontSize: 20, fontWeight: 800, color: T.textPrimary, letterSpacing: '-0.3px' }}>Syncline</span>
                </div>

                {/* Card */}
                <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, padding: '32px 28px', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>

                    {/* ── Forgot password screen ── */}
                    {mode === 'forgot'
                        ? <ForgotPasswordForm onBack={() => switchMode('login')} />
                        : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            {/* Header */}
                            <div>
                                <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800, color: T.textPrimary, letterSpacing: '-0.3px' }}>
                                    {isRegister ? 'Create your account' : 'Welcome back'}
                                </h1>
                                <p style={{ margin: 0, fontSize: 13, color: T.text }}>
                                    {isRegister ? 'Set up your Syncline workspace.' : 'Sign in to continue to Syncline.'}
                                </p>
                            </div>

                            {/* Account type toggle — register only */}
                            {isRegister && (
                                <div style={{ display: 'flex', background: T.inputBg, borderRadius: 10, padding: 4, border: `1px solid ${T.border}` }}>
                                    {['personal', 'company'].map(type => (
                                        <button key={type} onClick={() => setAccountType(type)}
                                            style={{ flex: 1, padding: '8px', background: accountType === type ? T.accentBg : 'none', border: `1px solid ${accountType === type ? T.accentBorder : 'transparent'}`, borderRadius: 7, color: accountType === type ? T.accentLight : T.textMuted, fontSize: 12, fontWeight: accountType === type ? 700 : 400, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit', transition: 'all 0.15s' }}>
                                            {type === 'personal' ? <User size={13} /> : <Building2 size={13} />}
                                            {type === 'personal' ? 'Personal' : 'Company'}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Google button */}
                            <GoogleButton onClick={handleGoogle} loading={googleLoad}
                                label={isRegister ? 'Sign up with Google' : 'Continue with Google'} />

                            <Divider label="or" />

                            {/* Alerts */}
                            {error   && <Alert type="error">{error}</Alert>}
                            {success && <Alert type="success">{success}</Alert>}

                            {/* Fields */}
                            {isRegister && (
                                <FieldInput icon={User} label="Full Name" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Smith" />
                            )}

                            {isRegister && accountType === 'company' && (
                                <FieldInput icon={Building2} label="Company Name" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Acme Corp" />
                            )}

                            <FieldInput icon={Mail} label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />

                            <div>
                                <FieldInput icon={Lock} label="Password" type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder={isRegister ? 'Min. 6 characters' : 'Your password'}
                                    right={
                                        <button type="button" onClick={() => setShowPw(!showPw)} style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer', display: 'flex', padding: 2 }}>
                                            {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                    }
                                />
                                {isRegister && <PasswordStrength password={password} />}
                            </div>

                            {isRegister && (
                                <FieldInput icon={Lock} label="Confirm Password" type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Re-enter password" />
                            )}

                            {/* Forgot password link */}
                            {!isRegister && (
                                <button onClick={() => switchMode('forgot')} style={{ background: 'none', border: 'none', color: T.accentLight, fontSize: 12, cursor: 'pointer', textAlign: 'right', padding: '0', fontFamily: 'inherit', alignSelf: 'flex-end', marginTop: -8 }}>
                                    Forgot password?
                                </button>
                            )}

                            {/* Submit */}
                            <button onClick={handleSubmit} disabled={loading}
                                style={{ width: '100%', padding: '12px', background: loading ? T.inputBg : T.accentGrad, border: 'none', borderRadius: 10, color: loading ? T.textMuted : '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit', boxShadow: loading ? 'none' : '0 4px 18px rgba(124,58,237,0.38)', transition: 'all 0.2s' }}
                                onKeyDown={e => e.key === 'Enter' && handleSubmit()}>
                                {loading ? <><Spinner />{isRegister ? 'Creating account…' : 'Signing in…'}</> : <>{isRegister ? 'Create account' : 'Sign in'} <ArrowRight size={15} /></>}
                            </button>

                            {/* Switch mode */}
                            <p style={{ margin: 0, fontSize: 13, color: T.text, textAlign: 'center' }}>
                                {isRegister ? 'Already have an account? ' : "Don't have an account? "}
                                <button onClick={() => switchMode(isRegister ? 'login' : 'register')}
                                    style={{ background: 'none', border: 'none', color: T.accentLight, fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                                    {isRegister ? 'Sign in' : 'Create one'}
                                </button>
                            </p>
                        </div>
                    )}
                </div>

                <p style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: T.textMuted }}>
                    By continuing you agree to Syncline's Terms of Service and Privacy Policy.
                </p>
            </div>
        </div>
    );
}