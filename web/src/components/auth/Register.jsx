// web/src/components/auth/Register.jsx
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, Chrome, Github, Zap, CheckCircle2, Building2, UserCircle, ArrowLeft } from 'lucide-react';

const Register = () => {
    const [step, setStep] = useState(1); // 1: account type, 2: details
    const [accountType, setAccountType] = useState(''); // 'personal' or 'company'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();
    const navigate = useNavigate();

    const getPasswordStrength = () => {
        if (password.length === 0) return { strength: 0, label: '', color: '#64748b' };
        if (password.length < 6) return { strength: 33, label: 'Weak', color: '#ef4444' };
        if (password.length < 10) return { strength: 66, label: 'Good', color: '#f59e0b' };
        return { strength: 100, label: 'Strong', color: '#10b981' };
    };

    const passwordStrength = getPasswordStrength();

    const handleAccountTypeSelect = (type) => {
        setAccountType(type);
        setStep(2);
    };

    const handleBackToType = () => {
        setStep(1);
        setAccountType('');
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        if (accountType === 'company' && !companyName.trim()) {
            setError('Company name is required');
            return;
        }

        if (!fullName.trim()) {
            setError('Full name is required');
            return;
        }

        setLoading(true);
        
        const result = await register(
            email,
            password,
            fullName,
            accountType,
            accountType === 'company' ? companyName : null
        );
        
        if (result.success) {
            navigate('/dashboard');
        } else {
            setError(result.error);
        }
        
        setLoading(false);
    };

    const handleGoogleSignup = () => {
        alert('🚧 Google OAuth integration coming soon!');
    };

    const handleGithubSignup = () => {
        alert('🚧 GitHub OAuth integration coming soon!');
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
                    <p style={styles.tagline}>
                        {step === 1 ? 'Choose your account type' : 'Complete your registration'}
                    </p>
                </div>

                {/* Main card */}
                <div style={styles.card}>
                    {step === 1 ? (
                        /* STEP 1: Account Type Selection */
                        <>
                            <div style={styles.cardHeader}>
                                <h2 style={styles.title}>Get Started</h2>
                                <p style={styles.subtitle}>Select the account type that fits your needs</p>
                            </div>

                            <div style={styles.accountTypeGrid}>
                                {/* Personal Account */}
                                <button
                                    type="button"
                                    style={styles.accountTypeCard}
                                    onClick={() => handleAccountTypeSelect('personal')}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = '#6366f1';
                                        e.currentTarget.style.transform = 'translateY(-4px)';
                                        e.currentTarget.style.boxShadow = '0 10px 30px rgba(99, 102, 241, 0.2)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                >
                                    <div style={styles.accountTypeIcon}>
                                        <UserCircle size={32} color="#6366f1" />
                                    </div>
                                    <h3 style={styles.accountTypeTitle}>Personal</h3>
                                    <p style={styles.accountTypeDescription}>
                                        Perfect for personal task management and productivity
                                    </p>
                                    <ul style={styles.featureList}>
                                        <li style={styles.featureItem}>
                                            <CheckCircle2 size={16} color="#10b981" />
                                            <span>Personal task management</span>
                                        </li>
                                        <li style={styles.featureItem}>
                                            <CheckCircle2 size={16} color="#10b981" />
                                            <span>Real-time updates</span>
                                        </li>
                                        <li style={styles.featureItem}>
                                            <CheckCircle2 size={16} color="#10b981" />
                                            <span>Priority tracking</span>
                                        </li>
                                    </ul>
                                    <div style={styles.selectButton}>
                                        Select Personal →
                                    </div>
                                </button>

                                {/* Company Account */}
                                <button
                                    type="button"
                                    style={{...styles.accountTypeCard, ...styles.accountTypeCardFeatured}}
                                    onClick={() => handleAccountTypeSelect('company')}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = '#8b5cf6';
                                        e.currentTarget.style.transform = 'translateY(-4px)';
                                        e.currentTarget.style.boxShadow = '0 10px 30px rgba(139, 92, 246, 0.2)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                >
                                    <div style={styles.featuredBadge}>RECOMMENDED</div>
                                    <div style={{...styles.accountTypeIcon, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)'}}>
                                        <Building2 size={32} color="#fff" />
                                    </div>
                                    <h3 style={styles.accountTypeTitle}>Company</h3>
                                    <p style={styles.accountTypeDescription}>
                                        Complete solution for teams and organizations
                                    </p>
                                    <ul style={styles.featureList}>
                                        <li style={styles.featureItem}>
                                            <CheckCircle2 size={16} color="#10b981" />
                                            <span>Team collaboration</span>
                                        </li>
                                        <li style={styles.featureItem}>
                                            <CheckCircle2 size={16} color="#10b981" />
                                            <span>Progress monitoring</span>
                                        </li>
                                        <li style={styles.featureItem}>
                                            <CheckCircle2 size={16} color="#10b981" />
                                            <span>Advanced analytics</span>
                                        </li>
                                        <li style={styles.featureItem}>
                                            <CheckCircle2 size={16} color="#10b981" />
                                            <span>Team management</span>
                                        </li>
                                    </ul>
                                    <div style={{...styles.selectButton, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff'}}>
                                        Select Company →
                                    </div>
                                </button>
                            </div>

                            {/* Footer */}
                            <div style={styles.footer}>
                                <p style={styles.footerText}>
                                    Already have an account?{' '}
                                    <span 
                                        style={styles.link}
                                        onClick={() => navigate('/login')}
                                    >
                                        Sign in here
                                    </span>
                                </p>
                            </div>
                        </>
                    ) : (
                        /* STEP 2: Registration Form */
                        <>
                            <div style={styles.cardHeader}>
                                {/* BACK BUTTON ON TOP */}
                                <button
                                    type="button"
                                    onClick={handleBackToType}
                                    style={styles.backButton}
                                    title="Go back to account type selection"
                                >
                                    <ArrowLeft size={16} />
                                    <span>Back</span>
                                </button>
                                <h2 style={styles.title}>
                                    {accountType === 'company' ? '🏢 Company Account' : '👤 Personal Account'}
                                </h2>
                                <p style={styles.subtitle}>
                                    {accountType === 'company' 
                                        ? 'Set up your company workspace' 
                                        : 'Create your personal account'}
                                </p>
                            </div>

                            {/* Social signup */}
                            <div style={styles.socialButtons}>
                                <button 
                                    type="button"
                                    style={styles.socialBtn}
                                    onClick={handleGoogleSignup}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                    }}
                                >
                                    <Chrome size={20} />
                                    <span>Google</span>
                                </button>
                                <button 
                                    type="button"
                                    style={styles.socialBtn}
                                    onClick={handleGithubSignup}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                    }}
                                >
                                    <Github size={20} />
                                    <span>GitHub</span>
                                </button>
                            </div>

                            <div style={styles.divider}>
                                <span style={styles.dividerText}>or continue with email</span>
                            </div>

                            {/* Register form */}
                            <form onSubmit={handleSubmit} style={styles.form}>
                                {accountType === 'company' && (
                                    <div style={styles.inputGroup}>
                                        <label style={styles.label}>Company Name *</label>
                                        <div style={styles.inputWrapper}>
                                            <Building2 size={20} style={styles.inputIcon} />
                                            <input
                                                type="text"
                                                value={companyName}
                                                onChange={(e) => setCompanyName(e.target.value)}
                                                placeholder="Acme Inc."
                                                style={styles.input}
                                                required
                                                disabled={loading}
                                            />
                                        </div>
                                    </div>
                                )}

                                <div style={styles.inputGroup}>
                                    <label style={styles.label}>Full Name *</label>
                                    <div style={styles.inputWrapper}>
                                        <User size={20} style={styles.inputIcon} />
                                        <input
                                            type="text"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            placeholder="John Doe"
                                            style={styles.input}
                                            required
                                            disabled={loading}
                                        />
                                    </div>
                                </div>

                                <div style={styles.inputGroup}>
                                    <label style={styles.label}>Email Address *</label>
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
                                    <label style={styles.label}>Password *</label>
                                    <div style={styles.inputWrapper}>
                                        <Lock size={20} style={styles.inputIcon} />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="Create a strong password"
                                            style={styles.input}
                                            required
                                            disabled={loading}
                                            minLength={6}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            style={styles.eyeBtn}
                                        >
                                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </button>
                                    </div>
                                    
                                    {/* Password strength indicator */}
                                    {password && (
                                        <div style={styles.strengthContainer}>
                                            <div style={styles.strengthBar}>
                                                <div 
                                                    style={{
                                                        ...styles.strengthFill,
                                                        width: `${passwordStrength.strength}%`,
                                                        background: passwordStrength.color
                                                    }}
                                                ></div>
                                            </div>
                                            <span style={{...styles.strengthLabel, color: passwordStrength.color}}>
                                                {passwordStrength.label}
                                            </span>
                                        </div>
                                    )}
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
                                    onMouseEnter={(e) => {
                                        if (!loading) {
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                            e.currentTarget.style.boxShadow = '0 6px 25px rgba(99, 102, 241, 0.5)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 4px 20px rgba(99, 102, 241, 0.4)';
                                    }}
                                >
                                    {loading ? (
                                        <>
                                            <div style={styles.spinner}></div>
                                            <span>Creating account...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Zap size={20} />
                                            <span>Create {accountType === 'company' ? 'Company' : 'Personal'} Account</span>
                                        </>
                                    )}
                                </button>

                                <p style={styles.terms}>
                                    By signing up, you agree to our{' '}
                                    <span 
                                        style={styles.termsLink}
                                        onClick={() => alert('📄 Terms of Service - Coming soon!')}
                                    >
                                        Terms of Service
                                    </span>
                                    {' '}and{' '}
                                    <span 
                                        style={styles.termsLink}
                                        onClick={() => alert('🔒 Privacy Policy - Coming soon!')}
                                    >
                                        Privacy Policy
                                    </span>
                                </p>
                            </form>

                            {/* Footer */}
                            <div style={styles.footer}>
                                <p style={styles.footerText}>
                                    Already have an account?{' '}
                                    <span 
                                        style={styles.link}
                                        onClick={() => navigate('/login')}
                                    >
                                        Sign in here
                                    </span>
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
            `}</style>
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
        right: '-250px',
        animation: 'float 20s infinite ease-in-out'
    },
    circle2: {
        position: 'absolute',
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)',
        bottom: '-200px',
        left: '-200px',
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
        maxWidth: '900px'
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
        marginBottom: '30px',
        position: 'relative'
    },
    backButton: {
        position: 'absolute',
        top: '-50px',
        left: '0',
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        color: '#94a3b8',
        padding: '8px 16px',
        fontSize: '14px',
        cursor: 'pointer',
        transition: 'all 0.3s',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
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
    accountTypeGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '20px',
        marginBottom: '30px'
    },
    accountTypeCard: {
        background: 'rgba(255, 255, 255, 0.03)',
        border: '2px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        padding: '30px',
        cursor: 'pointer',
        transition: 'all 0.3s',
        textAlign: 'center',
        position: 'relative'
    },
    accountTypeCardFeatured: {
        border: '2px solid rgba(139, 92, 246, 0.3)',
        background: 'rgba(139, 92, 246, 0.05)'
    },
    featuredBadge: {
        position: 'absolute',
        top: '16px',
        right: '16px',
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        color: '#fff',
        fontSize: '10px',
        fontWeight: '700',
        padding: '4px 10px',
        borderRadius: '12px',
        letterSpacing: '0.5px'
    },
    accountTypeIcon: {
        width: '64px',
        height: '64px',
        margin: '0 auto 20px',
        background: 'rgba(99, 102, 241, 0.1)',
        borderRadius: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    accountTypeTitle: {
        fontSize: '20px',
        fontWeight: '600',
        color: '#fff',
        margin: '0 0 8px 0'
    },
    accountTypeDescription: {
        fontSize: '14px',
        color: '#94a3b8',
        margin: '0 0 20px 0',
        lineHeight: '1.5'
    },
    featureList: {
        listStyle: 'none',
        padding: 0,
        margin: '0 0 24px 0',
        textAlign: 'left'
    },
    featureItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '13px',
        color: '#94a3b8',
        marginBottom: '10px'
    },
    selectButton: {
        padding: '12px 20px',
        background: 'rgba(99, 102, 241, 0.1)',
        border: '1px solid rgba(99, 102, 241, 0.3)',
        borderRadius: '10px',
        color: '#6366f1',
        fontSize: '14px',
        fontWeight: '600',
        transition: 'all 0.3s'
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
    label: {
        fontSize: '14px',
        fontWeight: '500',
        color: '#e2e8f0'
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
    strengthContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginTop: '4px'
    },
    strengthBar: {
        flex: 1,
        height: '4px',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '2px',
        overflow: 'hidden'
    },
    strengthFill: {
        height: '100%',
        transition: 'all 0.3s',
        borderRadius: '2px'
    },
    strengthLabel: {
        fontSize: '12px',
        fontWeight: '500',
        minWidth: '50px'
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
    terms: {
        fontSize: '12px',
        color: '#64748b',
        textAlign: 'center',
        margin: '0'
    },
    termsLink: {
        color: '#6366f1',
        textDecoration: 'none',
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

export default Register;