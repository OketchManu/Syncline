// web/src/components/auth/JoinCompany.jsx
// Route: /join/:code
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Zap, CheckCircle2, XCircle, Loader, Building2 } from 'lucide-react';

const API_BASE = 'http://localhost:3001/api';

const roleConfig = {
    owner:   { label: 'Owner',   color: '#f59e0b', icon: '👑' },
    admin:   { label: 'Admin',   color: '#6366f1', icon: '🛡️' },
    manager: { label: 'Manager', color: '#10b981', icon: '💼' },
    member:  { label: 'Member',  color: '#94a3b8', icon: '👤' },
};

const JoinCompany = () => {
    const { code } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [status, setStatus] = useState('loading'); // loading | preview | joining | success | error | needsLogin
    const [inviteInfo, setInviteInfo] = useState(null); // { companyName, role, inviterName }
    const [errorMsg, setErrorMsg] = useState('');

    // ── On mount: validate the invite code ──────────────────────────────────
    const validateCode = React.useCallback(async () => {
        try {
            // GET the invite info without joining (public endpoint)
            const res = await fetch(`${API_BASE}/company/invite-info/${code}`);
            if (!res.ok) {
                const d = await res.json();
                setErrorMsg(d.error || 'This invite link is invalid or has expired.');
                setStatus('error');
                return;
            }
            const data = await res.json();
            setInviteInfo(data);

            // If not logged in, redirect to login first, come back after
            if (!user) {
                setStatus('needsLogin');
            } else if (user.company_id) {
                setErrorMsg('You are already a member of a company.');
                setStatus('error');
            } else {
                setStatus('preview');
            }
        } catch (e) {
            setErrorMsg('Could not reach the server. Please try again.');
            setStatus('error');
        }
    }, [code, user]);

    useEffect(() => {
        if (!code) { setStatus('error'); setErrorMsg('Invalid invite link.'); return; }
        validateCode();
    }, [code, validateCode]);

    const handleJoin = async () => {
        setStatus('joining');
        try {
            const res = await fetch(`${API_BASE}/company/join/${code}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
                },
            });
            const data = await res.json();
            if (!res.ok) {
                setErrorMsg(data.error || 'Failed to join company.');
                setStatus('error');
                return;
            }
            setInviteInfo(prev => ({ ...prev, companyName: data.company?.name || prev?.companyName }));
            setStatus('success');
            // Redirect to dashboard after 2.5s
            setTimeout(() => navigate('/dashboard'), 2500);
        } catch (e) {
            setErrorMsg('Could not reach the server. Please try again.');
            setStatus('error');
        }
    };

    const roleCfg = roleConfig[inviteInfo?.role] || roleConfig.member;

    return (
        <div style={styles.container}>
            {/* Background */}
            <div style={styles.bgAnimation}>
                <div style={styles.circle1} />
                <div style={styles.circle2} />
                <div style={styles.circle3} />
            </div>

            <div style={styles.content}>
                {/* Logo */}
                <div style={styles.logoSection}>
                    <div style={styles.logoIcon}><Zap size={40} color="#fff" /></div>
                    <h1 style={styles.logo}>Syncline</h1>
                    <p style={styles.tagline}>Real-Time Operations Platform</p>
                </div>

                {/* Card */}
                <div style={styles.card}>

                    {/* ── Loading ── */}
                    {status === 'loading' && (
                        <div style={styles.centered}>
                            <Loader size={40} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
                            <p style={styles.mutedText}>Validating invite link…</p>
                        </div>
                    )}

                    {/* ── Needs Login ── */}
                    {status === 'needsLogin' && (
                        <>
                            <div style={styles.iconCircle('#6366f1')}>
                                <Building2 size={32} color="#fff" />
                            </div>
                            <h2 style={styles.title}>You've been invited!</h2>
                            {inviteInfo && (
                                <p style={styles.subtitle}>
                                    Join <strong style={{ color: '#e2e8f0' }}>{inviteInfo.companyName}</strong> as a{' '}
                                    <span style={{ color: roleCfg.color, fontWeight: 600 }}>{roleCfg.label}</span>
                                </p>
                            )}
                            <p style={{ ...styles.mutedText, margin: '0 0 28px' }}>
                                Sign in or create an account to accept this invitation.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <button
                                    onClick={() => navigate(`/login?redirect=/join/${code}`)}
                                    style={styles.primaryBtn}
                                >
                                    Sign In to Accept
                                </button>
                                <button
                                    onClick={() => navigate(`/register?redirect=/join/${code}`)}
                                    style={styles.secondaryBtn}
                                >
                                    Create Account
                                </button>
                            </div>
                        </>
                    )}

                    {/* ── Preview / Confirm ── */}
                    {status === 'preview' && inviteInfo && (
                        <>
                            <div style={styles.iconCircle('#6366f1')}>
                                <Building2 size={32} color="#fff" />
                            </div>
                            <h2 style={styles.title}>You've been invited!</h2>
                            <p style={{ ...styles.mutedText, margin: '0 0 28px' }}>
                                {inviteInfo.inviterName
                                    ? <><strong style={{ color: '#e2e8f0' }}>{inviteInfo.inviterName}</strong> invited you to join</>
                                    : 'You have been invited to join'
                                }
                            </p>

                            {/* Company card */}
                            <div style={styles.companyCard}>
                                <div style={styles.companyIcon}>
                                    <Building2 size={28} color="#6366f1" />
                                </div>
                                <div>
                                    <p style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#fff' }}>
                                        {inviteInfo.companyName}
                                    </p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                                        <span style={{ fontSize: '18px' }}>{roleCfg.icon}</span>
                                        <span style={{ fontSize: '13px', color: roleCfg.color, fontWeight: '600' }}>
                                            {roleCfg.label}
                                        </span>
                                        <span style={{ fontSize: '13px', color: '#64748b' }}>· Your role</span>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '24px' }}>
                                <button onClick={handleJoin} style={styles.primaryBtn}>
                                    ✅ Accept & Join Company
                                </button>
                                <button onClick={() => navigate('/dashboard')} style={styles.secondaryBtn}>
                                    Decline
                                </button>
                            </div>
                        </>
                    )}

                    {/* ── Joining (spinner) ── */}
                    {status === 'joining' && (
                        <div style={styles.centered}>
                            <Loader size={40} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
                            <p style={styles.mutedText}>Joining company…</p>
                        </div>
                    )}

                    {/* ── Success ── */}
                    {status === 'success' && (
                        <div style={styles.centered}>
                            <CheckCircle2 size={64} color="#10b981" />
                            <h2 style={{ ...styles.title, marginTop: '20px' }}>Welcome aboard!</h2>
                            <p style={styles.mutedText}>
                                You've successfully joined <strong style={{ color: '#e2e8f0' }}>{inviteInfo?.companyName}</strong>.
                            </p>
                            <p style={{ fontSize: '13px', color: '#64748b', margin: '8px 0 0' }}>
                                Redirecting to dashboard…
                            </p>
                        </div>
                    )}

                    {/* ── Error ── */}
                    {status === 'error' && (
                        <div style={styles.centered}>
                            <XCircle size={64} color="#ef4444" />
                            <h2 style={{ ...styles.title, marginTop: '20px' }}>Invite Invalid</h2>
                            <p style={{ ...styles.mutedText, color: '#fca5a5' }}>{errorMsg}</p>
                            <button
                                onClick={() => navigate(user ? '/dashboard' : '/login')}
                                style={{ ...styles.primaryBtn, marginTop: '24px' }}
                            >
                                {user ? 'Go to Dashboard' : 'Go to Login'}
                            </button>
                        </div>
                    )}

                </div>
            </div>

            <style>{`
                @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(20px)} }
                @keyframes pulse { 0%,100%{transform:translate(-50%,-50%) scale(1);opacity:.5} 50%{transform:translate(-50%,-50%) scale(1.1);opacity:.3} }
                @keyframes spin  { to{transform:rotate(360deg)} }
            `}</style>
        </div>
    );
};

const styles = {
    container: {
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0a0e27', position: 'relative', overflow: 'hidden', padding: '20px',
    },
    bgAnimation: { position: 'absolute', width: '100%', height: '100%', overflow: 'hidden' },
    circle1: {
        position: 'absolute', width: '500px', height: '500px', borderRadius: '50%',
        background: 'radial-gradient(circle,rgba(99,102,241,.15) 0%,transparent 70%)',
        top: '-250px', left: '-250px', animation: 'float 20s infinite ease-in-out',
    },
    circle2: {
        position: 'absolute', width: '400px', height: '400px', borderRadius: '50%',
        background: 'radial-gradient(circle,rgba(139,92,246,.15) 0%,transparent 70%)',
        bottom: '-200px', right: '-200px', animation: 'float 15s infinite ease-in-out reverse',
    },
    circle3: {
        position: 'absolute', width: '300px', height: '300px', borderRadius: '50%',
        background: 'radial-gradient(circle,rgba(59,130,246,.15) 0%,transparent 70%)',
        top: '50%', left: '50%', transform: 'translate(-50%,-50%)', animation: 'pulse 10s infinite ease-in-out',
    },
    content: { position: 'relative', zIndex: 1, width: '100%', maxWidth: '460px' },
    logoSection: { textAlign: 'center', marginBottom: '36px' },
    logoIcon: {
        width: '80px', height: '80px', margin: '0 auto 20px',
        background: 'linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)',
        borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 10px 40px rgba(99,102,241,.4)',
    },
    logo: { fontSize: '32px', fontWeight: '700', color: '#fff', margin: '0 0 8px 0', letterSpacing: '-0.5px' },
    tagline: { color: '#94a3b8', fontSize: '14px', margin: 0 },
    card: {
        background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px',
        padding: '40px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', textAlign: 'center',
    },
    centered: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' },
    iconCircle: (color) => ({
        width: '72px', height: '72px', borderRadius: '50%', margin: '0 auto 20px',
        background: `linear-gradient(135deg,${color},#8b5cf6)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 8px 30px ${color}44`,
    }),
    title: { fontSize: '22px', fontWeight: '700', color: '#fff', margin: '0 0 8px' },
    subtitle: { fontSize: '14px', color: '#94a3b8', margin: '0 0 24px' },
    mutedText: { fontSize: '14px', color: '#94a3b8', margin: 0, lineHeight: 1.6 },
    companyCard: {
        display: 'flex', alignItems: 'center', gap: '16px', textAlign: 'left',
        padding: '18px 20px', background: 'rgba(99,102,241,0.1)',
        border: '1px solid rgba(99,102,241,0.25)', borderRadius: '14px',
    },
    companyIcon: {
        width: '52px', height: '52px', borderRadius: '12px', flexShrink: 0,
        background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    primaryBtn: {
        width: '100%', padding: '14px 24px',
        background: 'linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)',
        border: 'none', borderRadius: '12px', color: '#fff',
        fontSize: '15px', fontWeight: '600', cursor: 'pointer',
        boxShadow: '0 4px 20px rgba(99,102,241,.4)',
    },
    secondaryBtn: {
        width: '100%', padding: '13px 24px',
        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px', color: '#94a3b8', fontSize: '14px', cursor: 'pointer',
    },
};

export default JoinCompany;