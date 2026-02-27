// web/src/components/auth/Login.jsx
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, Chrome, Github, Zap } from 'lucide-react';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

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

    const handleGithubLogin = () => {
        alert('🚧 GitHub OAuth integration coming soon! This is a demo feature.');
    };

    return (
        <div style={styles.container}>
            {/* Animated background */}
            <div style={styles.bgAnimation}>
                <div style={styles.circle1}></div>
                <div style={styles.circle2}></div>
                <div style={styles.circle3}></div>
            </div>

            <div style={styles.content}>
                {/* Logo section */}
                <div style={styles.logoSection}>
                    <div style={styles.logoIcon}>
                        <Zap size={40} color="#fff" />
                    </div>
                    <h1 style={styles.logo}>Syncline</h1>
                    <p style={styles.tagline}>Real-Time Operations Platform</p>
                </div>

                {/* Main card */}
                <div style={styles.card}>
                    <div style={styles.cardHeader}>
                        <h2 style={styles.title}>Welcome Back</h2>
                        <p style={styles.subtitle}>Sign in to continue to your workspace</p>
                    </div>

                    {/* Social login */}
                    <div style={styles.socialButtons}>
                        <button 
                            type="button"
                            style={styles.socialBtn}
                            onClick={handleGoogleLogin}
                        >
                            <Chrome size={20} />
                            <span>Google</span>
                        </button>
                        <button 
                            type="button"
                            style={styles.socialBtn}
                            onClick={handleGithubLogin}
                        >
                            <Github size={20} />
                            <span>GitHub</span>
                        </button>
                    </div>

                    <div style={styles.divider}>
                        <span style={styles.dividerText}>or continue with email</span>
                    </div>

                    {/* Login form */}
                    <form onSubmit={handleSubmit} style={styles.form}>
                        <div style={styles.inputGroup}>
                            <label style={styles.label}>Email Address</label>
                            <div style={styles.inputWrapper}>
                                <Mail size={20} style={styles.inputIcon} />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@company.com"
                                    style={styles.input}
                                    required
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div style={styles.inputGroup}>
                            <div style={styles.labelRow}>
                                <label style={styles.label}>Password</label>
                               <span 
    style={styles.forgotLink}
    onClick={() => alert('🚧 Password reset coming soon!')}
>
    Forgot password?
</span>
                            </div>
                            <div style={styles.inputWrapper}>
                                <Lock size={20} style={styles.inputIcon} />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    style={styles.input}
                                    required
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={styles.eyeBtn}
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
                        <p style={styles.footerText}>
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
        </div>
    );
};

const styles = {
    container: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0e27',
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
        background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
        top: '-250px',
        left: '-250px',
        animation: 'float 20s infinite ease-in-out'
    },
    circle2: {
        position: 'absolute',
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)',
        bottom: '-200px',
        right: '-200px',
        animation: 'float 15s infinite ease-in-out reverse'
    },
    circle3: {
        position: 'absolute',
        width: '300px',
        height: '300px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)',
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
        color: '#fff',
        margin: '0 0 8px 0',
        letterSpacing: '-0.5px'
    },
    tagline: {
        color: '#94a3b8',
        fontSize: '14px',
        margin: 0
    },
    card: {
        background: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '24px',
        padding: '40px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
    },
    cardHeader: {
        marginBottom: '30px'
    },
    title: {
        fontSize: '24px',
        fontWeight: '600',
        color: '#fff',
        margin: '0 0 8px 0'
    },
    subtitle: {
        fontSize: '14px',
        color: '#94a3b8',
        margin: 0
    },
    socialButtons: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px',
        marginBottom: '24px'
    },
    socialBtn: {
        padding: '12px',
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        color: '#fff',
        fontSize: '14px',
        fontWeight: '500',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        transition: 'all 0.3s'
    },
    divider: {
        position: 'relative',
        textAlign: 'center',
        margin: '24px 0',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)'
    },
    dividerText: {
        position: 'absolute',
        top: '-10px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(15, 23, 42, 0.8)',
        padding: '0 12px',
        fontSize: '12px',
        color: '#94a3b8'
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
        color: '#e2e8f0'
    },
    forgotLink: {
        fontSize: '13px',
        color: '#6366f1',
        textDecoration: 'none',
        fontWeight: '500'
    },
    inputWrapper: {
        position: 'relative',
        display: 'flex',
        alignItems: 'center'
    },
    inputIcon: {
        position: 'absolute',
        left: '16px',
        color: '#64748b',
        pointerEvents: 'none'
    },
    input: {
        width: '100%',
        padding: '14px 16px 14px 48px',
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        fontSize: '15px',
        color: '#fff',
        outline: 'none',
        transition: 'all 0.3s'
    },
    eyeBtn: {
        position: 'absolute',
        right: '12px',
        background: 'none',
        border: 'none',
        color: '#64748b',
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
    demoBox: {
        marginTop: '24px',
        padding: '16px',
        background: 'rgba(99, 102, 241, 0.1)',
        border: '1px solid rgba(99, 102, 241, 0.2)',
        borderRadius: '12px',
        textAlign: 'center'
    },
    demoTitle: {
        fontSize: '13px',
        color: '#a5b4fc',
        margin: '0 0 12px 0',
        fontWeight: '500'
    },
    demoBtn: {
        padding: '8px 16px',
        background: 'rgba(99, 102, 241, 0.2)',
        border: '1px solid rgba(99, 102, 241, 0.3)',
        borderRadius: '8px',
        color: '#c7d2fe',
        fontSize: '13px',
        fontWeight: '500',
        cursor: 'pointer'
    },
    footer: {
        marginTop: '24px',
        textAlign: 'center'
    },
    footerText: {
        fontSize: '14px',
        color: '#94a3b8'
    },
    link: {
        color: '#6366f1',
        fontWeight: '600',
        cursor: 'pointer'
    }
};

export default Login;