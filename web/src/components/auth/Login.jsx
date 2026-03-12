// web/src/components/auth/Login.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, Zap } from 'lucide-react';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
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

        const result = await login(email, password);

        if (result.success) {
            navigate('/dashboard');
        } else {
            setError(result.error);
        }

        setLoading(false);
    };

    const handleGoogleLogin = () => {
        alert('🚧 Google OAuth integration coming soon! This is a demo feature.');
    };

    return (
        <div style={{ ...styles.container, background: t.bg }}>
            {/* Animated background */}
            <div style={styles.bgAnimation}>
                <div style={{ ...styles.circle1, background: t.blob1 }}></div>
                <div style={{ ...styles.circle2, background: t.blob2 }}></div>
                <div style={{ ...styles.circle3, background: t.blob3 }}></div>
            </div>

            <div style={styles.content}>
                {/* Logo section */}
                <div style={styles.logoSection}>
                    <div style={styles.logoIcon}>
                        <Zap size={40} color="#fff" />
                    </div>
                    <h1 style={{ ...styles.logo, color: t.logoText }}>Syncline</h1>
                    <p style={{ ...styles.tagline, color: t.muted }}>Real-Time Operations Platform</p>
                </div>

                {/* Main card */}
                <div style={{ ...styles.card, background: t.cardBg, border: `1px solid ${t.border}`, boxShadow: t.cardShadow }}>
                    <div style={styles.cardHeader}>
                        <h2 style={{ ...styles.title, color: t.text }}>Welcome Back</h2>
                        <p style={{ ...styles.subtitle, color: t.muted }}>Sign in to continue to your workspace</p>
                    </div>

                    {/* Social login — Google only */}
                    <div style={styles.socialButtons}>
                        <button
                            type="button"
                            style={{ ...styles.socialBtn, width: '100%', justifyContent: 'center', background: t.inputBg, border: `1px solid ${t.border}`, color: t.text }}
                            onClick={handleGoogleLogin}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                            </svg>
                            <span>Continue with Google</span>
                        </button>
                    </div>

                    <div style={{ ...styles.divider, borderTop: `1px solid ${t.border}` }}>
                        <span style={{ ...styles.dividerText, background: t.cardBg, color: t.muted }}>or continue with email</span>
                    </div>

                    {/* Login form */}
                    <form onSubmit={handleSubmit} style={styles.form}>
                        <div style={styles.inputGroup}>
                            <label style={{ ...styles.label, color: t.label }}>Email Address</label>
                            <div style={styles.inputWrapper}>
                                <Mail size={20} style={{ ...styles.inputIcon, color: t.iconColor }} />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@company.com"
                                    style={{ ...styles.input, background: t.inputBg, border: `1px solid ${t.border}`, color: t.text }}
                                    required
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div style={styles.inputGroup}>
                            <div style={styles.labelRow}>
                                <label style={{ ...styles.label, color: t.label }}>Password</label>
                                <span
                                    style={styles.forgotLink}
                                    onClick={() => navigate('/forgot-password')}
                                >
                                    Forgot password?
                                </span>
                            </div>
                            <div style={styles.inputWrapper}>
                                <Lock size={20} style={{ ...styles.inputIcon, color: t.iconColor }} />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    style={{ ...styles.input, background: t.inputBg, border: `1px solid ${t.border}`, color: t.text }}
                                    required
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{ ...styles.eyeBtn, color: t.iconColor }}
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div style={styles.error}>
                                <span>⚠️</span>
                                <span>{error}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            style={{...styles.submitBtn, ...(loading ? styles.submitBtnDisabled : {})}}
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <div style={styles.spinner}></div>
                                    <span>Signing in...</span>
                                </>
                            ) : (
                                <>
                                    <Zap size={20} />
                                    <span>Sign In</span>
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer */}
                    <div style={styles.footer}>
                        <p style={{ ...styles.footerText, color: t.muted }}>
                            Don't have an account?{' '}
                            <span
                                style={styles.link}
                                onClick={() => navigate('/register')}
                            >
                                Sign up for free
                            </span>
                        </p>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(20px); }
                }
                @keyframes pulse {
                    0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
                    50% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.3; }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                input::placeholder { color: ${t.placeholder}; }
            `}</style>
        </div>
    );
};

// ── Theme tokens ─────────────────────────────────────────────────────────────
const tokens = {
    dark: {
        bg:          '#0a0e27',
        blob1:       'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
        blob2:       'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)',
        blob3:       'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)',
        cardBg:      'rgba(15, 23, 42, 0.8)',
        cardShadow:  '0 20px 60px rgba(0, 0, 0, 0.5)',
        border:      'rgba(255, 255, 255, 0.1)',
        text:        '#fff',
        logoText:    '#fff',
        label:       '#e2e8f0',
        muted:       '#94a3b8',
        iconColor:   '#64748b',
        inputBg:     'rgba(255, 255, 255, 0.05)',
        placeholder: '#64748b',
    },
    light: {
        bg:          '#f0f4ff',
        blob1:       'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
        blob2:       'radial-gradient(circle, rgba(139,92,246,0.10) 0%, transparent 70%)',
        blob3:       'radial-gradient(circle, rgba(59,130,246,0.10) 0%, transparent 70%)',
        cardBg:      'rgba(255, 255, 255, 0.85)',
        cardShadow:  '0 20px 60px rgba(99, 102, 241, 0.12)',
        border:      'rgba(99, 102, 241, 0.15)',
        text:        '#0f172a',
        logoText:    '#0f172a',
        label:       '#1e293b',
        muted:       '#64748b',
        iconColor:   '#94a3b8',
        inputBg:     'rgba(241, 245, 249, 0.8)',
        placeholder: '#94a3b8',
    },
};
// ─────────────────────────────────────────────────────────────────────────────

const styles = {
    container: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        padding: '20px'
    },
    bgAnimation: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        overflow: 'hidden'
    },
    circle1: {
        position: 'absolute',
        width: '500px',
        height: '500px',
        borderRadius: '50%',
        top: '-250px',
        left: '-250px',
        animation: 'float 20s infinite ease-in-out'
    },
    circle2: {
        position: 'absolute',
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        bottom: '-200px',
        right: '-200px',
        animation: 'float 15s infinite ease-in-out reverse'
    },
    circle3: {
        position: 'absolute',
        width: '300px',
        height: '300px',
        borderRadius: '50%',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        animation: 'pulse 10s infinite ease-in-out'
    },
    content: {
        position: 'relative',
        zIndex: 1,
        width: '100%',
        maxWidth: '480px'
    },
    logoSection: {
        textAlign: 'center',
        marginBottom: '40px'
    },
    logoIcon: {
        width: '80px',
        height: '80px',
        margin: '0 auto 20px',
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        borderRadius: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 10px 40px rgba(99,102,241,0.4)'
    },
    logo: {
        fontSize: '32px',
        fontWeight: '700',
        margin: '0 0 8px 0',
        letterSpacing: '-0.5px'
    },
    tagline: {
        fontSize: '14px',
        margin: 0
    },
    card: {
        backdropFilter: 'blur(20px)',
        borderRadius: '24px',
        padding: '40px',
    },
    cardHeader: {
        marginBottom: '30px'
    },
    title: {
        fontSize: '24px',
        fontWeight: '600',
        margin: '0 0 8px 0'
    },
    subtitle: {
        fontSize: '14px',
        margin: 0
    },
    socialButtons: {
        marginBottom: '24px'
    },
    socialBtn: {
        padding: '12px',
        borderRadius: '12px',
        fontSize: '14px',
        fontWeight: '500',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.3s'
    },
    divider: {
        position: 'relative',
        textAlign: 'center',
        margin: '24px 0',
    },
    dividerText: {
        position: 'absolute',
        top: '-10px',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '0 12px',
        fontSize: '12px',
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
    },
    inputGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
    },
    labelRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    label: {
        fontSize: '14px',
        fontWeight: '500',
    },
    forgotLink: {
        fontSize: '13px',
        color: '#6366f1',
        textDecoration: 'none',
        fontWeight: '500',
        cursor: 'pointer'
    },
    inputWrapper: {
        position: 'relative',
        display: 'flex',
        alignItems: 'center'
    },
    inputIcon: {
        position: 'absolute',
        left: '16px',
        pointerEvents: 'none'
    },
    input: {
        width: '100%',
        padding: '14px 16px 14px 48px',
        borderRadius: '12px',
        fontSize: '15px',
        outline: 'none',
        transition: 'all 0.3s',
        boxSizing: 'border-box',
        fontFamily: 'inherit'
    },
    eyeBtn: {
        position: 'absolute',
        right: '12px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '8px',
        display: 'flex',
        alignItems: 'center',
        borderRadius: '8px'
    },
    error: {
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        color: '#fca5a5',
        padding: '12px 16px',
        borderRadius: '12px',
        fontSize: '14px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    },
    submitBtn: {
        padding: '14px 24px',
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        border: 'none',
        borderRadius: '12px',
        color: '#fff',
        fontSize: '15px',
        fontWeight: '600',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        transition: 'all 0.3s',
        boxShadow: '0 4px 20px rgba(99, 102, 241, 0.4)'
    },
    submitBtnDisabled: {
        opacity: 0.6,
        cursor: 'not-allowed'
    },
    spinner: {
        width: '20px',
        height: '20px',
        border: '2px solid rgba(255,255,255,0.3)',
        borderTop: '2px solid #fff',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
    },
    footer: {
        marginTop: '24px',
        textAlign: 'center'
    },
    footerText: {
        fontSize: '14px',
    },
    link: {
        color: '#6366f1',
        fontWeight: '600',
        cursor: 'pointer'
    }
};

export default Login;