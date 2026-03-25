// web/src/components/auth/JoinCompany.jsx
// Route: /join/:code
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { companyAPI } from '../../services/api';
import { Zap, CheckCircle2, XCircle, Loader, Building2 } from 'lucide-react';

const API_BASE = 'https://syncline-1.onrender.com';

const roleConfig = {
    owner:   { label: 'Owner',   color: '#f59e0b', icon: '👑' },
    admin:   { label: 'Admin',   color: '#6366f1', icon: '🛡️' },
    manager: { label: 'Manager', color: '#10b981', icon: '💼' },
    member:  { label: 'Member',  color: '#94a3b8', icon: '👤' },
};

const JoinCompany = () => {
    const { code }   = useParams();
    const navigate   = useNavigate();
    const { user, loading: authLoading, updateUser } = useAuth();

    const [status,     setStatus]     = useState('loading'); // loading | preview | joining | success | error | needsLogin
    const [inviteInfo, setInviteInfo] = useState(null);      // { companyName, role, inviterName }
    const [errorMsg,   setErrorMsg]   = useState('');

    // ── Validate the invite code ───────────────────────────────────────────
    // Uses a public (unauthenticated) endpoint — no token needed here.
    const validateCode = React.useCallback(async () => {
        if (!code) {
            setErrorMsg('Invalid invite link.');
            setStatus('error');
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/company/invite-info/${code}`);
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                setErrorMsg(d.error || 'This invite link is invalid or has expired.');
                setStatus('error');
                return;
            }
            const data = await res.json();
            setInviteInfo(data);

            if (!user) {
                // Not signed in — show login/register prompt.
                setStatus('needsLogin');
            } else if (user.company_id || user.companyId) {
                setErrorMsg('You are already a member of a company.');
                setStatus('error');
            } else {
                setStatus('preview');
            }
        } catch {
            setErrorMsg('Could not reach the server. Please try again.');
            setStatus('error');
        }
    }, [code, user]);

    // Wait for AuthContext to finish loading before validating, so `user` is
    // reliable and we don't flicker through the needsLogin state for returning
    // users whose Firebase session is still being restored.
    useEffect(() => {
        if (authLoading) return; // wait for auth to settle
        validateCode();
    }, [authLoading, validateCode]);

    // ── Accept the invitation ─────────────────────────────────────────────
    // Uses companyAPI (axios instance) which automatically attaches the fresh
    // Firebase ID token via the request interceptor in api.js.
    const handleJoin = async () => {
        setStatus('joining');
        try {
            const res  = await companyAPI.join(code);
            const data = res.data;

            // Patch the local user state so the rest of the app knows the
            // user now belongs to a company without requiring a full reload.
            if (data.company) {
                updateUser({
                    company_id: data.company.id,
                    companyId:  data.company.id,
                    role:       data.role || 'member',
                });
            }

            setInviteInfo(prev => ({
                ...prev,
                companyName: data.company?.name || prev?.companyName,
            }));
            setStatus('success');

            // Redirect to dashboard after 2.5 s.
            setTimeout(() => navigate('/dashboard'), 2500);
        } catch (err) {
            const msg = err.response?.data?.error || 'Failed to join company. Please try again.';
            setErrorMsg(msg);
            setStatus('error');
        }
    };

    const roleCfg = roleConfig[inviteInfo?.role] || roleConfig.member;

    return (
        <div style={styles.container}>
            <style>{`
                @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(20px)} }
                @keyframes pulse { 0%,100%{transform:translate(-50%,-50%) scale(1);opacity:.5} 50%{transform:translate(-50%,-50%) scale(1.1);opacity:.3} }
                @keyframes spin  { to{transform:rotate(360deg)} }
                @media (max-width: 640px) {
                    .join-btn { font-size: 14px !important; padding: 12px 20px !important; }
                    .join-company-name { font-size: 16px !important; }
                }
            `}</style>

            {/* Background blobs */}
            <div style={styles.bgAnimation}>
                <div style={{ ...styles.circle1, width: 'min(500px, 80vw)', height: 'min(500px, 80vw)' }} />
                <div style={{ ...styles.circle2, width: 'min(400px, 70vw)', height: 'min(400px, 70vw)' }} />
                <div style={{ ...styles.circle3, width: 'min(300px, 60vw)', height: 'min(300px, 60vw)' }} />
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

                    {/* ── Loading / auth settling ── */}
                    {(status === 'loading' || authLoading) && (
                        <div style={styles.centered}>
                            <Loader size={40} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
                            <p style={styles.mutedText}>Validating invite link…</p>
                        </div>
                    )}

                    {/* ── Needs login ── */}
                    {!authLoading && status === 'needsLogin' && (
                        <>
                            <div style={iconCircle('#6366f1')}>
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
                                    className="join-btn"
                                >
                                    Sign In to Accept
                                </button>
                                <button
                                    onClick={() => navigate(`/register?redirect=/join/${code}`)}
                                    style={styles.secondaryBtn}
                                    className="join-btn"
                                >
                                    Create Account
                                </button>
                            </div>
                        </>
                    )}

                    {/* ── Preview / confirm ── */}
                    {!authLoading && status === 'preview' && inviteInfo && (
                        <>
                            <div style={iconCircle('#6366f1')}>
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
                                    <p
                                        className="join-company-name"
                                        style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#fff' }}
                                    >
                                        {inviteInfo.companyName}
                                    </p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '18px' }}>{roleCfg.icon}</span>
                                        <span style={{ fontSize: '13px', color: roleCfg.color, fontWeight: '600' }}>
                                            {roleCfg.label}
                                        </span>
                                        <span style={{ fontSize: '13px', color: '#64748b' }}>· Your role</span>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '24px' }}>
                                <button onClick={handleJoin} style={styles.primaryBtn} className="join-btn">
                                    ✅ Accept &amp; Join Company
                                </button>
                                <button onClick={() => navigate('/dashboard')} style={styles.secondaryBtn} className="join-btn">
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
                                You've successfully joined{' '}
                                <strong style={{ color: '#e2e8f0' }}>{inviteInfo?.companyName}</strong>.
                            </p>
                            <p style={{ fontSize: '13px', color: '#64748b', margin: '8px 0 0' }}>
                                Redirecting to dashboard…
                            </p>
                        </div>
                    )}

                    {/* ── Error ── */}
                    {!authLoading && status === 'error' && (
                        <div style={styles.centered}>
                            <XCircle size={64} color="#ef4444" />
                            <h2 style={{ ...styles.title, marginTop: '20px' }}>Invite Invalid</h2>
                            <p style={{ ...styles.mutedText, color: '#fca5a5' }}>{errorMsg}</p>
                            <button
                                onClick={() => navigate(user ? '/dashboard' : '/login')}
                                style={{ ...styles.primaryBtn, marginTop: '24px' }}
                                className="join-btn"
                            >
                                {user ? 'Go to Dashboard' : 'Go to Login'}
                            </button>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const iconCircle = (color) => ({
    width: 'clamp(64px, 14vw, 72px)',
    height: 'clamp(64px, 14vw, 72px)',
    borderRadius: '50%',
    margin: '0 auto 20px',
    background: `linear-gradient(135deg, ${color}, #8b5cf6)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `0 8px 30px ${color}44`,
});

const styles = {
    container: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0e27',
        position: 'relative',
        overflow: 'hidden',
        padding: 'clamp(16px, 4vw, 20px)',
    },
    bgAnimation: { position: 'absolute', width: '100%', height: '100%', overflow: 'hidden' },
    circle1: {
        position: 'absolute', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,.15) 0%, transparent 70%)',
        top: '-250px', left: '-250px', animation: 'float 20s infinite ease-in-out',
    },
    circle2: {
        position: 'absolute', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139,92,246,.15) 0%, transparent 70%)',
        bottom: '-200px', right: '-200px', animation: 'float 15s infinite ease-in-out reverse',
    },
    circle3: {
        position: 'absolute', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59,130,246,.15) 0%, transparent 70%)',
        top: '50%', left: '50%', transform: 'translate(-50%,-50%)', animation: 'pulse 10s infinite ease-in-out',
    },
    content:    { position: 'relative', zIndex: 1, width: '100%', maxWidth: 'min(460px, 95vw)' },
    logoSection:{ textAlign: 'center', marginBottom: 'clamp(28px, 6vw, 36px)' },
    logoIcon: {
        width: 'clamp(70px, 15vw, 80px)', height: 'clamp(70px, 15vw, 80px)',
        margin: '0 auto 20px',
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 10px 40px rgba(99,102,241,.4)',
    },
    logo:    { fontSize: 'clamp(26px, 6vw, 32px)', fontWeight: '700', color: '#fff', margin: '0 0 8px 0', letterSpacing: '-0.5px' },
    tagline: { color: '#94a3b8', fontSize: 'clamp(13px, 3vw, 14px)', margin: 0 },
    card: {
        background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 'clamp(18px, 4vw, 24px)',
        padding: 'clamp(28px, 6vw, 40px)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        textAlign: 'center',
    },
    centered:   { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' },
    title:      { fontSize: 'clamp(20px, 4.5vw, 22px)', fontWeight: '700', color: '#fff', margin: '0 0 8px' },
    subtitle:   { fontSize: 'clamp(13px, 3vw, 14px)', color: '#94a3b8', margin: '0 0 24px' },
    mutedText:  { fontSize: 'clamp(13px, 3vw, 14px)', color: '#94a3b8', margin: 0, lineHeight: 1.6 },
    companyCard: {
        display: 'flex', alignItems: 'center', gap: 'clamp(12px, 3vw, 16px)', textAlign: 'left',
        padding: 'clamp(16px, 4vw, 18px) clamp(16px, 4vw, 20px)',
        background: 'rgba(99,102,241,0.1)',
        border: '1px solid rgba(99,102,241,0.25)',
        borderRadius: '14px',
    },
    companyIcon: {
        width: 'clamp(48px, 10vw, 52px)', height: 'clamp(48px, 10vw, 52px)',
        borderRadius: '12px', flexShrink: 0,
        background: 'rgba(99,102,241,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    primaryBtn: {
        width: '100%',
        padding: 'clamp(12px, 3vw, 14px) clamp(20px, 4vw, 24px)',
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        border: 'none', borderRadius: '12px', color: '#fff',
        fontSize: 'clamp(14px, 3.2vw, 15px)', fontWeight: '600', cursor: 'pointer',
        boxShadow: '0 4px 20px rgba(99,102,241,.4)',
    },
    secondaryBtn: {
        width: '100%',
        padding: 'clamp(11px, 2.8vw, 13px) clamp(20px, 4vw, 24px)',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px', color: '#94a3b8',
        fontSize: 'clamp(13px, 3vw, 14px)', cursor: 'pointer',
    },
};

export default JoinCompany;