// web/src/components/auth/Register.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Eye, EyeOff, Mail, Lock, User, Zap, CheckCircle2,
    Building2, UserCircle, ArrowLeft, Globe, FileText,
} from 'lucide-react';

const Register = () => {
    const navigate  = useNavigate();
    const location  = useLocation();

    // ── If arriving from Login's "not registered" Google redirect,
    //    pull the pre-filled Google profile from router state.
    const incomingGoogleProfile = location.state?.googleProfile || null;
    const fromGoogleLogin       = location.state?.fromGoogleLogin || false;

    const [step,          setStep]          = useState(fromGoogleLogin ? 1 : 1);
    const [accountType,   setAccountType]   = useState('');
    const [email,         setEmail]         = useState(incomingGoogleProfile?.email    || '');
    const [password,      setPassword]      = useState('');
    const [fullName,      setFullName]      = useState(incomingGoogleProfile?.fullName || '');
    const [companyName,   setCompanyName]   = useState('');
    const [industry,      setIndustry]      = useState('');
    const [description,   setDescription]   = useState('');
    const [website,       setWebsite]       = useState('');
    const [showPassword,  setShowPassword]  = useState(false);
    const [error,         setError]         = useState('');
    const [loading,       setLoading]       = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);

    // Show a helpful banner when redirected from login
    const [googleBanner, setGoogleBanner] = useState(
        fromGoogleLogin
            ? `No Syncline account found for ${incomingGoogleProfile?.email || 'your Google account'}. Please register below.`
            : ''
    );

    const { register, registerWithGoogle } = useAuth();

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

    const INDUSTRIES = [
        'Technology', 'Healthcare', 'Finance', 'Education', 'Retail',
        'Manufacturing', 'Consulting', 'Media & Entertainment', 'Real Estate',
        'Logistics', 'Legal', 'Non-profit', 'Other',
    ];

    const getPasswordStrength = () => {
        if (password.length === 0) return { strength: 0, label: '', color: '#64748b' };
        if (password.length < 6)   return { strength: 33, label: 'Weak',   color: '#ef4444' };
        if (password.length < 10)  return { strength: 66, label: 'Good',   color: '#f59e0b' };
        return                            { strength: 100, label: 'Strong', color: '#10b981' };
    };
    const passwordStrength = getPasswordStrength();

    const isDisabled = loading || googleLoading;

    const handleAccountTypeSelect = (type) => {
        setAccountType(type);
        setStep(2);
    };

    const handleBackToType = () => {
        setStep(1);
        setAccountType('');
        setError('');
    };

    // ── Email / password register ─────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (fromGoogleLogin) return;
        setError('');

        if (!fullName.trim()) {
            setError('Full name is required');
            return;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        if (accountType === 'company' && !companyName.trim()) {
            setError('Company name is required');
            return;
        }

        setLoading(true);

        const result = await register(
            email,
            password,
            fullName,
            accountType,
            accountType === 'company' ? companyName : null,
            accountType === 'company' ? { industry, description, website } : null,
        );

        if (result.success) {
            navigate('/dashboard');
        } else {
            setError(result.error || 'Registration failed. Please try again.');
        }

        setLoading(false);
    };

    // ── Google register ───────────────────────────────────────────────────────
    // Uses registerWithGoogle (not loginWithGoogle) so it always creates the account.
    const handleGoogleSignup = async () => {
        setError('');

        if (!accountType) {
            setError('Please select an account type first.');
            return;
        }
        if (accountType === 'company' && !companyName.trim()) {
            setError('Company name is required');
            return;
        }

        setGoogleLoading(true);

        const result = await registerWithGoogle(
            accountType || 'personal',
            accountType === 'company' ? companyName || null : null,
            accountType === 'company' ? { industry, description, website } : null,
        );

        if (result.success) {
            navigate('/dashboard');
        } else if (result.error) {
            setError(result.error);
        }

        setGoogleLoading(false);
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
                    <p style={{ ...styles.tagline, color: t.muted }}>
                        {step === 1 ? 'Choose your account type' : 'Complete your registration'}
                    </p>
                </div>

                {/* Main card */}
                <div style={{ ...styles.card, background: t.cardBg, border: `1px solid ${t.border}`, boxShadow: t.cardShadow }}>

                    {/* ── Banner when redirected from a failed Google login ── */}
                    {googleBanner && (
                        <div style={{
                            background: 'rgba(99,102,241,0.1)',
                            border: '1px solid rgba(99,102,241,0.3)',
                            color: '#a5b4fc',
                            padding: '12px 16px',
                            borderRadius: '12px',
                            fontSize: '14px',
                            marginBottom: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                        }}>
                            <span>ℹ️ {googleBanner}</span>
                            <button
                                onClick={() => setGoogleBanner('')}
                                style={{ background: 'none', border: 'none', color: '#a5b4fc', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}
                            >×</button>
                        </div>
                    )}

                    {/* ── STEP 1: Account type ── */}
                    {step === 1 ? (
                        <>
                            <div style={styles.cardHeader}>
                                <h2 style={{ ...styles.title, color: t.text }}>Get Started</h2>
                                <p style={{ ...styles.subtitle, color: t.muted }}>Select the account type that fits your needs</p>
                            </div>

                            <div style={styles.accountTypeGrid}>
                                {/* Personal */}
                                <button
                                    type="button"
                                    style={{ ...styles.accountTypeCard, background: t.accountCardBg, border: `2px solid ${t.accountCardBorder}` }}
                                    onClick={() => handleAccountTypeSelect('personal')}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = '#6366f1';
                                        e.currentTarget.style.transform   = 'translateY(-4px)';
                                        e.currentTarget.style.boxShadow   = '0 10px 30px rgba(99,102,241,0.2)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = t.accountCardBorder;
                                        e.currentTarget.style.transform   = 'translateY(0)';
                                        e.currentTarget.style.boxShadow   = 'none';
                                    }}
                                >
                                    <div style={styles.accountTypeIcon}>
                                        <UserCircle size={32} color="#6366f1" />
                                    </div>
                                    <h3 style={{ ...styles.accountTypeTitle, color: t.text }}>Personal</h3>
                                    <p style={{ ...styles.accountTypeDescription, color: t.muted }}>
                                        Perfect for personal task management and productivity
                                    </p>
                                    <ul style={styles.featureList}>
                                        {['Personal task management', 'Real-time updates', 'Priority tracking'].map(f => (
                                            <li key={f} style={styles.featureItem}>
                                                <CheckCircle2 size={16} color="#10b981" />
                                                <span style={{ color: t.muted }}>{f}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    <div style={{ ...styles.selectButton, background: t.selectBtnBg, border: `1px solid ${t.selectBtnBorder}`, color: '#6366f1' }}>
                                        Select Personal →
                                    </div>
                                </button>

                                {/* Company */}
                                <button
                                    type="button"
                                    style={{ ...styles.accountTypeCard, ...styles.accountTypeCardFeatured }}
                                    onClick={() => handleAccountTypeSelect('company')}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = '#8b5cf6';
                                        e.currentTarget.style.transform   = 'translateY(-4px)';
                                        e.currentTarget.style.boxShadow   = '0 10px 30px rgba(139,92,246,0.2)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)';
                                        e.currentTarget.style.transform   = 'translateY(0)';
                                        e.currentTarget.style.boxShadow   = 'none';
                                    }}
                                >
                                    <div style={styles.featuredBadge}>RECOMMENDED</div>
                                    <div style={{ ...styles.accountTypeIcon, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                                        <Building2 size={32} color="#fff" />
                                    </div>
                                    <h3 style={{ ...styles.accountTypeTitle, color: t.text }}>Company</h3>
                                    <p style={{ ...styles.accountTypeDescription, color: t.muted }}>
                                        Complete solution for teams and organizations
                                    </p>
                                    <ul style={styles.featureList}>
                                        {['Team collaboration', 'Progress monitoring', 'Advanced analytics', 'Team management'].map(f => (
                                            <li key={f} style={styles.featureItem}>
                                                <CheckCircle2 size={16} color="#10b981" />
                                                <span style={{ color: t.muted }}>{f}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    <div style={{ ...styles.selectButton, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff' }}>
                                        Select Company →
                                    </div>
                                </button>
                            </div>

                            <div style={styles.footer}>
                                <p style={{ ...styles.footerText, color: t.muted }}>
                                    Already have an account?{' '}
                                    <span style={styles.link} onClick={() => navigate('/login')}>Sign in here</span>
                                </p>
                            </div>
                        </>
                    ) : (
                        /* ── STEP 2: Registration form ── */
                        <>
                            <div style={styles.cardHeader}>
                                <button
                                    type="button"
                                    onClick={handleBackToType}
                                    style={{ ...styles.backButton, background: t.inputBg, border: `1px solid ${t.border}`, color: t.muted }}
                                >
                                    <ArrowLeft size={16} />
                                    <span>Back</span>
                                </button>
                                <h2 style={{ ...styles.title, color: t.text }}>
                                    {accountType === 'company' ? '🏢 Company Account' : '👤 Personal Account'}
                                </h2>
                                <p style={{ ...styles.subtitle, color: t.muted }}>
                                    {accountType === 'company' ? 'Set up your company workspace' : 'Create your personal account'}
                                </p>
                            </div>

                            {/* Google signup — uses registerWithGoogle so it always creates */}
                            <div style={styles.socialButtons}>
                                <button
                                    type="button"
                                    style={{
                                        ...styles.socialBtn,
                                        width: '100%',
                                        justifyContent: 'center',
                                        background: t.inputBg,
                                        border: `1px solid ${t.border}`,
                                        color: t.text,
                                        opacity: isDisabled ? 0.6 : 1,
                                        cursor:  isDisabled ? 'not-allowed' : 'pointer',
                                    }}
                                    onClick={handleGoogleSignup}
                                    disabled={isDisabled}
                                >
                                    {googleLoading ? (
                                        <div style={styles.spinner} />
                                    ) : (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                        </svg>
                                    )}
                                    <span>{googleLoading ? 'Signing up…' : 'Continue with Google'}</span>
                                </button>
                            </div>

                            <div style={{ ...styles.divider, borderTop: `1px solid ${t.border}` }}>
                                <span style={{ ...styles.dividerText, background: t.cardBg, color: t.muted }}>or continue with email</span>
                            </div>

                            <form onSubmit={handleSubmit} style={styles.form}>
                                {accountType === 'company' && (
                                    <>
                                        {/* Company name */}
                                        <div style={styles.inputGroup}>
                                            <label style={{ ...styles.label, color: t.label }}>Company Name *</label>
                                            <div style={styles.inputWrapper}>
                                                <Building2 size={20} style={{ ...styles.inputIcon, color: t.iconColor }} />
                                                <input
                                                    type="text"
                                                    value={companyName}
                                                    onChange={(e) => setCompanyName(e.target.value)}
                                                    placeholder="Acme Inc."
                                                    style={{ ...styles.input, background: t.inputBg, border: `1px solid ${t.border}`, color: t.text }}
                                                    required
                                                    disabled={isDisabled}
                                                />
                                            </div>
                                        </div>

                                        {/* Industry */}
                                        <div style={styles.inputGroup}>
                                            <label style={{ ...styles.label, color: t.label }}>Industry</label>
                                            <div style={styles.inputWrapper}>
                                                <select
                                                    value={industry}
                                                    onChange={(e) => setIndustry(e.target.value)}
                                                    disabled={isDisabled}
                                                    style={{ ...styles.input, paddingLeft: '16px', cursor: 'pointer', background: t.inputBg, color: industry ? t.text : t.iconColor, border: `1px solid ${t.border}` }}
                                                >
                                                    <option value="">Select industry…</option>
                                                    {INDUSTRIES.map(i => (
                                                        <option key={i} value={i} style={{ background: dark ? '#0a0e27' : '#fff', color: dark ? '#fff' : '#0f172a' }}>{i}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        {/* Website */}
                                        <div style={styles.inputGroup}>
                                            <label style={{ ...styles.label, color: t.label }}>
                                                Website <span style={{ color: t.iconColor, fontWeight: 400, fontSize: 12 }}>(optional)</span>
                                            </label>
                                            <div style={styles.inputWrapper}>
                                                <Globe size={20} style={{ ...styles.inputIcon, color: t.iconColor }} />
                                                <input
                                                    type="url"
                                                    value={website}
                                                    onChange={(e) => setWebsite(e.target.value)}
                                                    placeholder="https://yourcompany.com"
                                                    style={{ ...styles.input, background: t.inputBg, border: `1px solid ${t.border}`, color: t.text }}
                                                    disabled={isDisabled}
                                                />
                                            </div>
                                        </div>

                                        {/* Description */}
                                        <div style={styles.inputGroup}>
                                            <label style={{ ...styles.label, color: t.label }}>
                                                Description <span style={{ color: t.iconColor, fontWeight: 400, fontSize: 12 }}>(optional)</span>
                                            </label>
                                            <div style={styles.inputWrapper}>
                                                <FileText size={20} style={{ ...styles.inputIcon, top: '14px', position: 'absolute', color: t.iconColor }} />
                                                <textarea
                                                    value={description}
                                                    onChange={(e) => setDescription(e.target.value)}
                                                    placeholder="What does your company do?"
                                                    disabled={isDisabled}
                                                    rows={3}
                                                    style={{ ...styles.input, paddingTop: '12px', resize: 'vertical', minHeight: '80px', background: t.inputBg, border: `1px solid ${t.border}`, color: t.text }}
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* Full name */}
                                <div style={styles.inputGroup}>
                                    <label style={{ ...styles.label, color: t.label }}>Full Name *</label>
                                    <div style={styles.inputWrapper}>
                                        <User size={20} style={{ ...styles.inputIcon, color: t.iconColor }} />
                                        <input
                                            type="text"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            placeholder="John Doe"
                                            style={{ ...styles.input, background: t.inputBg, border: `1px solid ${t.border}`, color: t.text }}
                                            required
                                            disabled={isDisabled}
                                        />
                                    </div>
                                </div>

                                {/* Email */}
                                <div style={styles.inputGroup}>
                                    <label style={{ ...styles.label, color: t.label }}>Email Address *</label>
                                    <div style={styles.inputWrapper}>
                                        <Mail size={20} style={{ ...styles.inputIcon, color: t.iconColor }} />
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="name@company.com"
                                            style={{ ...styles.input, background: t.inputBg, border: `1px solid ${t.border}`, color: t.text }}
                                            required
                                            disabled={isDisabled || fromGoogleLogin}
                                            readOnly={fromGoogleLogin}
                                        />
                                    </div>
                                </div>

                                {/* Password — hidden when arriving from Google login redirect
                                    since they'll complete registration via the Google button */}
                                {!fromGoogleLogin && (
                                    <div style={styles.inputGroup}>
                                        <label style={{ ...styles.label, color: t.label }}>Password *</label>
                                        <div style={styles.inputWrapper}>
                                            <Lock size={20} style={{ ...styles.inputIcon, color: t.iconColor }} />
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder="Create a strong password"
                                                style={{ ...styles.input, background: t.inputBg, border: `1px solid ${t.border}`, color: t.text }}
                                                required
                                                disabled={isDisabled}
                                                minLength={6}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                style={{ ...styles.eyeBtn, color: t.iconColor }}
                                                disabled={isDisabled}
                                            >
                                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                            </button>
                                        </div>

                                        {password && (
                                            <div style={styles.strengthContainer}>
                                                <div style={styles.strengthBar}>
                                                    <div style={{ ...styles.strengthFill, width: `${passwordStrength.strength}%`, background: passwordStrength.color }} />
                                                </div>
                                                <span style={{ ...styles.strengthLabel, color: passwordStrength.color }}>
                                                    {passwordStrength.label}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {error && (
                                    <div style={styles.error}>
                                        <span>⚠️</span>
                                        <span>{error}</span>
                                    </div>
                                )}

                                {/* Only show the email submit button when NOT coming from a Google login redirect
                                    (in that case the user should click "Continue with Google" above) */}
                                {!fromGoogleLogin && (
                                    <button
                                        type="submit"
                                        style={{ ...styles.submitBtn, ...(isDisabled ? styles.submitBtnDisabled : {}) }}
                                        disabled={isDisabled}
                                    >
                                        {loading ? (
                                            <>
                                                <div style={styles.spinner}></div>
                                                <span>Creating account…</span>
                                            </>
                                        ) : (
                                            <>
                                                <Zap size={20} />
                                                <span>Create {accountType === 'company' ? 'Company' : 'Personal'} Account</span>
                                            </>
                                        )}
                                    </button>
                                )}

                                <p style={{ fontSize: '11px', color: '#3d4f6e', textAlign: 'center', marginTop: '12px' }}>
  By registering you agree to our{' '}
  <a href="/terms.html" target="_blank" style={{ color: '#a78bfa' }}>Terms of Service</a>
  {' '}and{' '}
  <a href="/privacy.html" target="_blank" style={{ color: '#a78bfa' }}>Privacy Policy</a>.
</p>
                            </form>

                            <div style={styles.footer}>
                                <p style={{ ...styles.footerText, color: t.muted }}>
                                    Already have an account?{' '}
                                    <span style={styles.link} onClick={() => navigate('/login')}>Sign in here</span>
                                </p>
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
                input::placeholder, textarea::placeholder { color: ${t.placeholder}; }
            `}</style>
        </div>
    );
};

// ── Theme tokens ──────────────────────────────────────────────────────────────
const tokens = {
    dark: {
        bg:                '#0a0e27',
        blob1:             'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
        blob2:             'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)',
        blob3:             'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)',
        cardBg:            'rgba(15, 23, 42, 0.8)',
        cardShadow:        '0 20px 60px rgba(0, 0, 0, 0.5)',
        border:            'rgba(255, 255, 255, 0.1)',
        text:              '#fff',
        logoText:          '#fff',
        label:             '#e2e8f0',
        muted:             '#94a3b8',
        iconColor:         '#64748b',
        inputBg:           'rgba(255, 255, 255, 0.05)',
        placeholder:       '#64748b',
        accountCardBg:     'rgba(255, 255, 255, 0.03)',
        accountCardBorder: 'rgba(255, 255, 255, 0.1)',
        selectBtnBg:       'rgba(99,102,241,0.1)',
        selectBtnBorder:   'rgba(99,102,241,0.3)',
    },
    light: {
        bg:                '#f0f4ff',
        blob1:             'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
        blob2:             'radial-gradient(circle, rgba(139,92,246,0.10) 0%, transparent 70%)',
        blob3:             'radial-gradient(circle, rgba(59,130,246,0.10) 0%, transparent 70%)',
        cardBg:            'rgba(255, 255, 255, 0.85)',
        cardShadow:        '0 20px 60px rgba(99,102,241,0.12)',
        border:            'rgba(99,102,241,0.15)',
        text:              '#0f172a',
        logoText:          '#0f172a',
        label:             '#1e293b',
        muted:             '#64748b',
        iconColor:         '#94a3b8',
        inputBg:           'rgba(241, 245, 249, 0.8)',
        placeholder:       '#94a3b8',
        accountCardBg:     'rgba(241, 245, 249, 0.6)',
        accountCardBorder: 'rgba(99,102,241,0.12)',
        selectBtnBg:       'rgba(99,102,241,0.08)',
        selectBtnBorder:   'rgba(99,102,241,0.25)',
    },
};

const styles = {
    container: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', padding: '20px' },
    bgAnimation: { position: 'absolute', width: '100%', height: '100%', overflow: 'hidden' },
    circle1: { position: 'absolute', width: '500px', height: '500px', borderRadius: '50%', top: '-250px', right: '-250px', animation: 'float 20s infinite ease-in-out' },
    circle2: { position: 'absolute', width: '400px', height: '400px', borderRadius: '50%', bottom: '-200px', left: '-200px', animation: 'float 15s infinite ease-in-out reverse' },
    circle3: { position: 'absolute', width: '300px', height: '300px', borderRadius: '50%', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', animation: 'pulse 10s infinite ease-in-out' },
    content: { position: 'relative', zIndex: 1, width: '100%', maxWidth: '900px' },
    logoSection: { textAlign: 'center', marginBottom: '40px' },
    logoIcon: { width: '80px', height: '80px', margin: '0 auto 20px', background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 40px rgba(99,102,241,0.4)' },
    logo: { fontSize: '32px', fontWeight: '700', margin: '0 0 8px 0', letterSpacing: '-0.5px' },
    tagline: { fontSize: '14px', margin: 0 },
    card: { backdropFilter: 'blur(20px)', borderRadius: '24px', padding: '40px' },
    cardHeader: { marginBottom: '30px', position: 'relative' },
    backButton: { position: 'absolute', top: '-50px', left: '0', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', cursor: 'pointer', transition: 'all 0.3s', display: 'flex', alignItems: 'center', gap: '6px' },
    title: { fontSize: '24px', fontWeight: '600', margin: '0 0 8px 0' },
    subtitle: { fontSize: '14px', margin: 0 },
    accountTypeGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '30px' },
    accountTypeCard: { borderRadius: '16px', padding: '30px', cursor: 'pointer', transition: 'all 0.3s', textAlign: 'center', position: 'relative' },
    accountTypeCardFeatured: { border: '2px solid rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.05)' },
    featuredBadge: { position: 'absolute', top: '16px', right: '16px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontSize: '10px', fontWeight: '700', padding: '4px 10px', borderRadius: '12px', letterSpacing: '0.5px' },
    accountTypeIcon: { width: '64px', height: '64px', margin: '0 auto 20px', background: 'rgba(99,102,241,0.1)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    accountTypeTitle: { fontSize: '20px', fontWeight: '600', margin: '0 0 8px 0' },
    accountTypeDescription: { fontSize: '14px', margin: '0 0 20px 0', lineHeight: '1.5' },
    featureList: { listStyle: 'none', padding: 0, margin: '0 0 24px 0', textAlign: 'left' },
    featureItem: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', marginBottom: '10px' },
    selectButton: { padding: '12px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: '600', transition: 'all 0.3s' },
    socialButtons: { marginBottom: '24px' },
    socialBtn: { padding: '12px', borderRadius: '12px', fontSize: '14px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.3s' },
    divider: { position: 'relative', textAlign: 'center', margin: '24px 0' },
    dividerText: { position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', padding: '0 12px', fontSize: '12px' },
    form: { display: 'flex', flexDirection: 'column', gap: '20px' },
    inputGroup: { display: 'flex', flexDirection: 'column', gap: '8px' },
    label: { fontSize: '14px', fontWeight: '500' },
    inputWrapper: { position: 'relative', display: 'flex', alignItems: 'center' },
    inputIcon: { position: 'absolute', left: '16px', pointerEvents: 'none' },
    input: { width: '100%', padding: '14px 16px 14px 48px', borderRadius: '12px', fontSize: '15px', outline: 'none', transition: 'all 0.3s', boxSizing: 'border-box', fontFamily: 'inherit' },
    eyeBtn: { position: 'absolute', right: '12px', background: 'none', border: 'none', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', borderRadius: '8px' },
    strengthContainer: { display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' },
    strengthBar: { flex: 1, height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' },
    strengthFill: { height: '100%', transition: 'all 0.3s', borderRadius: '2px' },
    strengthLabel: { fontSize: '12px', fontWeight: '500', minWidth: '50px' },
    error: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', padding: '12px 16px', borderRadius: '12px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' },
    submitBtn: { padding: '14px 24px', background: 'linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '15px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.3s', boxShadow: '0 4px 20px rgba(99,102,241,0.4)' },
    submitBtnDisabled: { opacity: 0.6, cursor: 'not-allowed' },
    spinner: { width: '20px', height: '20px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
    terms: { fontSize: '12px', textAlign: 'center', margin: '0' },
    termsLink: { color: '#6366f1', cursor: 'pointer' },
    footer: { marginTop: '24px', textAlign: 'center' },
    footerText: { fontSize: '14px' },
    link: { color: '#6366f1', fontWeight: '600', cursor: 'pointer' },
};

export default Register;