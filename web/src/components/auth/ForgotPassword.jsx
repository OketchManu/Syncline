// web/src/components/auth/ForgotPassword.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Zap, ArrowLeft, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const ForgotPassword = () => {
    const [email,   setEmail]   = useState('');
    const [error,   setError]   = useState('');
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    const { resetPassword } = useAuth();
    const navigate = useNavigate();

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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess(false);

        if (!email.trim()) {
            setError('Please enter your email address.');
            return;
        }

        setLoading(true);
        const result = await resetPassword(email.trim());
        setLoading(false);

        if (result.success) {
            setSuccess(true);
        } else {
            setError(result.error || 'Failed to send reset email. Please try again.');
        }
    };

    return (
        <div style={{ ...styles.container, background: t.bg }}>
            <div style={styles.bgAnimation}>
                <div style={{ ...styles.circle1, background: t.blob1 }} />
                <div style={{ ...styles.circle2, background: t.blob2 }} />
                <div style={{ ...styles.circle3, background: t.blob3 }} />
            </div>

            <div style={styles.content}>
                <div style={styles.logoSection}>
                    <div style={styles.logoIcon}>
                        <Zap size={40} color="#fff" />
                    </div>
                    <h1 style={{ ...styles.logo, color: t.logoText }}>Syncline</h1>
                    <p style={{ ...styles.tagline, color: t.muted }}>Real-Time Operations Platform</p>
                </div>

                <div style={{ ...styles.card, background: t.cardBg, border: `1px solid ${t.border}`, boxShadow: t.cardShadow }}>
                    {success ? (
                        <div style={styles.successBlock}>
                            <div style={styles.successIcon}>
                                <CheckCircle size={32} color="#10b981" />
                            </div>
                            <h2 style={{ ...styles.title, color: t.text }}>Check your inbox</h2>
                            <p style={{ ...styles.subtitle, color: t.muted }}>
                                We sent a password reset link to <strong style={{ color: t.text }}>{email}</strong>.
                                Click the link in the email to set a new password.
                            </p>
                            <button
                                type="button"
                                style={styles.submitBtn}
                                onClick={() => navigate('/login')}
                            >
                                <Zap size={20} />
                                <span>Back to Sign In</span>
                            </button>
                        </div>
                    ) : (
                        <>
                            <div style={styles.cardHeader}>
                                <h2 style={{ ...styles.title, color: t.text }}>Reset your password</h2>
                                <p style={{ ...styles.subtitle, color: t.muted }}>
                                    Enter your email and we'll send you a reset link.
                                </p>
                            </div>

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
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                {error && (
                                    <div style={{ ...styles.error, color: t.errorText }}>
                                        <span>⚠️</span>
                                        <span>{error}</span>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    style={{ ...styles.submitBtn, ...(loading ? styles.submitBtnDisabled : {}) }}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <>
                                            <div style={styles.spinner} />
                                            <span>Sending link…</span>
                                        </>
                                    ) : (
                                        <>
                                            <Mail size={20} />
                                            <span>Send Reset Link</span>
                                        </>
                                    )}
                                </button>
                            </form>

                            <div style={styles.footer}>
                                <button
                                    type="button"
                                    style={{ ...styles.backLink, color: t.muted }}
                                    onClick={() => navigate('/login')}
                                    disabled={loading}
                                >
                                    <ArrowLeft size={16} />
                                    <span>Back to Sign In</span>
                                </button>
                            </div>
                        </>
                    )}
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
        errorText:   '#fca5a5',
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
        errorText:   '#dc2626',
    },
};

const styles = {
    container: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        padding: '20px',
    },
    bgAnimation: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
    },
    circle1: {
        position: 'absolute',
        width: '500px',
        height: '500px',
        borderRadius: '50%',
        top: '-250px',
        left: '-250px',
        animation: 'float 20s infinite ease-in-out',
    },
    circle2: {
        position: 'absolute',
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        bottom: '-200px',
        right: '-200px',
        animation: 'float 15s infinite ease-in-out reverse',
    },
    circle3: {
        position: 'absolute',
        width: '300px',
        height: '300px',
        borderRadius: '50%',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        animation: 'pulse 10s infinite ease-in-out',
    },
    content: {
        position: 'relative',
        zIndex: 1,
        width: '100%',
        maxWidth: '480px',
    },
    logoSection: {
        textAlign: 'center',
        marginBottom: '40px',
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
        boxShadow: '0 10px 40px rgba(99,102,241,0.4)',
    },
    logo: {
        fontSize: '32px',
        fontWeight: '700',
        margin: '0 0 8px 0',
        letterSpacing: '-0.5px',
    },
    tagline: {
        fontSize: '14px',
        margin: 0,
    },
    card: {
        backdropFilter: 'blur(20px)',
        borderRadius: '24px',
        padding: '40px',
    },
    cardHeader: {
        marginBottom: '30px',
    },
    title: {
        fontSize: '24px',
        fontWeight: '600',
        margin: '0 0 8px 0',
    },
    subtitle: {
        fontSize: '14px',
        margin: 0,
        lineHeight: 1.6,
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
    },
    inputGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    },
    label: {
        fontSize: '14px',
        fontWeight: '500',
    },
    inputWrapper: {
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
    },
    inputIcon: {
        position: 'absolute',
        left: '16px',
        pointerEvents: 'none',
    },
    input: {
        width: '100%',
        padding: '14px 16px 14px 48px',
        borderRadius: '12px',
        fontSize: '15px',
        outline: 'none',
        transition: 'all 0.3s',
        boxSizing: 'border-box',
        fontFamily: 'inherit',
    },
    error: {
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        padding: '12px 16px',
        borderRadius: '12px',
        fontSize: '14px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
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
        boxShadow: '0 4px 20px rgba(99, 102, 241, 0.4)',
        width: '100%',
    },
    submitBtnDisabled: {
        opacity: 0.6,
        cursor: 'not-allowed',
    },
    spinner: {
        width: '20px',
        height: '20px',
        border: '2px solid rgba(255,255,255,0.3)',
        borderTop: '2px solid #fff',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
    },
    footer: {
        marginTop: '24px',
        textAlign: 'center',
    },
    backLink: {
        background: 'none',
        border: 'none',
        fontSize: '14px',
        fontWeight: '500',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: 0,
        fontFamily: 'inherit',
    },
    successBlock: {
        textAlign: 'center',
    },
    successIcon: {
        width: '72px',
        height: '72px',
        borderRadius: '50%',
        background: 'rgba(16, 185, 129, 0.1)',
        border: '1px solid rgba(16, 185, 129, 0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 20px',
    },
};

export default ForgotPassword;
