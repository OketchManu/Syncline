// web/src/components/dashboard/TeamManagement.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
    Users, UserPlus, Shield, Search, X,
    Mail, Crown, Briefcase, User, CheckCircle2,
    MoreVertical, UserMinus, RefreshCw, Send,
    Download, Eye, 
    AlertCircle, Activity,
    Check, Ban
} from 'lucide-react';

// ─── Theme (mirrors Dashboard.jsx exactly) ───────────────────────────────────
const themes = {
    dark: {
        bg: '#0f172a', surfacePrimary: '#1e293b', surfaceSecondary: 'rgba(30,41,59,0.9)',
        surfaceCard: 'rgba(255,255,255,0.04)', surfaceHover: 'rgba(255,255,255,0.06)',
        border: 'rgba(255,255,255,0.08)', borderMid: 'rgba(255,255,255,0.12)',
        text: '#e2e8f0', textPrimary: '#fff', textMuted: '#64748b', textSecondary: '#94a3b8',
        inputBg: 'rgba(255,255,255,0.07)', selectBg: '#334155', selectText: '#e2e8f0',
        accentBg: 'rgba(99,102,241,0.15)', accentBorder: 'rgba(99,102,241,0.3)', accentText: '#a5b4fc',
        overlayBg: 'rgba(0,0,0,0.8)', modalBg: '#1e293b',
        errorBg: 'rgba(239,68,68,0.1)', errorBorder: 'rgba(239,68,68,0.3)', errorText: '#fca5a5',
        successBg: 'rgba(16,185,129,0.1)', successBorder: 'rgba(16,185,129,0.3)', successText: '#6ee7b7',
        warnBg: 'rgba(245,158,11,0.1)', warnBorder: 'rgba(245,158,11,0.3)', warnText: '#fcd34d',
        dangerBg: 'rgba(239,68,68,0.12)', dangerBorder: 'rgba(239,68,68,0.3)', dangerText: '#fca5a5',
        dangerBtn: '#dc2626', overdueBorder: 'rgba(239,68,68,0.3)',
        onlineBg: 'rgba(16,185,129,0.15)', onlineText: '#6ee7b7',
        offlineBg: 'rgba(239,68,68,0.15)', offlineText: '#fca5a5',
    },
    light: {
        bg: '#f1f5f9', surfacePrimary: '#ffffff', surfaceSecondary: 'rgba(255,255,255,0.97)',
        surfaceCard: 'rgba(0,0,0,0.02)', surfaceHover: 'rgba(0,0,0,0.04)',
        border: 'rgba(0,0,0,0.08)', borderMid: 'rgba(0,0,0,0.12)',
        text: '#334155', textPrimary: '#0f172a', textMuted: '#64748b', textSecondary: '#475569',
        inputBg: 'rgba(0,0,0,0.04)', selectBg: '#e2e8f0', selectText: '#1e293b',
        accentBg: 'rgba(99,102,241,0.08)', accentBorder: 'rgba(99,102,241,0.25)', accentText: '#4f46e5',
        overlayBg: 'rgba(0,0,0,0.55)', modalBg: '#ffffff',
        errorBg: 'rgba(239,68,68,0.06)', errorBorder: 'rgba(239,68,68,0.25)', errorText: '#dc2626',
        successBg: 'rgba(16,185,129,0.07)', successBorder: 'rgba(16,185,129,0.25)', successText: '#059669',
        warnBg: 'rgba(245,158,11,0.07)', warnBorder: 'rgba(245,158,11,0.25)', warnText: '#b45309',
        dangerBg: 'rgba(239,68,68,0.06)', dangerBorder: 'rgba(239,68,68,0.25)', dangerText: '#dc2626',
        dangerBtn: '#dc2626', overdueBorder: 'rgba(239,68,68,0.25)',
        onlineBg: 'rgba(16,185,129,0.08)', onlineText: '#059669',
        offlineBg: 'rgba(239,68,68,0.08)', offlineText: '#dc2626',
    }
};

const API_BASE = 'http://localhost:3001/api';
const API_ORIGIN = 'http://localhost:3001';

const resolveAvatar = (avatar) => {
    if (!avatar) return null;
    if (avatar.startsWith('http') || avatar.startsWith('data:')) return avatar;
    return `${API_ORIGIN}${avatar}`;
};

const roleConfig = {
    owner:   { label: 'Owner',   color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',   icon: <Crown size={11} />, rank: 4 },
    admin:   { label: 'Admin',   color: '#6366f1', bg: 'rgba(99,102,241,0.15)',   icon: <Shield size={11} />, rank: 3 },
    manager: { label: 'Manager', color: '#10b981', bg: 'rgba(16,185,129,0.15)',   icon: <Briefcase size={11} />, rank: 2 },
    member:  { label: 'Member',  color: '#94a3b8', bg: 'rgba(148,163,184,0.15)',  icon: <User size={11} />, rank: 1 },
};

// ─── Shared UI Atoms ─────────────────────────────────────────────────────────
const StatusAlert = ({ t, type, children }) => {
    const s = {
        error:   { bg: t.errorBg,   border: t.errorBorder,   color: t.errorText },
        success: { bg: t.successBg, border: t.successBorder, color: t.successText },
        warning: { bg: t.warnBg,    border: t.warnBorder,    color: t.warnText },
    }[type] || {};
    return (
        <div style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color, padding: '10px 14px', borderRadius: '9px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', lineHeight: 1.4 }}>
            {children}
        </div>
    );
};

const RoleBadge = ({ role }) => {
    const cfg = roleConfig[role] || roleConfig.member;
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: cfg.bg, color: cfg.color }}>
            {cfg.icon}{cfg.label}
        </span>
    );
};

const Avatar = ({ user, size = 36 }) => {
    const src = resolveAvatar(user?.avatar || user?.avatar_url);
    const initials = (user?.fullName || user?.full_name || user?.email || '?').charAt(0).toUpperCase();
    return (
        <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: '700', color: '#fff' }}>
            {src ? <img src={src} alt="av" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
        </div>
    );
};

const Spinner = ({ size = 16, color = '#6366f1' }) => (
    <div style={{ width: size, height: size, border: `2px solid ${color}30`, borderTop: `2px solid ${color}`, borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
);

// ─── Invite Member Modal ──────────────────────────────────────────────────────
const InviteModal = ({ t, onClose, onInvite, currentUserRole }) => {
    const [email, setEmail]   = useState('');
    const [role, setRole]     = useState('member');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null);

    const allowedRoles = currentUserRole === 'owner'
        ? ['admin', 'manager', 'member']
        : ['member'];

    const handleSubmit = async () => {
        if (!email.trim()) { setStatus({ type: 'error', msg: 'Email is required' }); return; }
        if (!/\S+@\S+\.\S+/.test(email)) { setStatus({ type: 'error', msg: 'Enter a valid email address' }); return; }
        setLoading(true); setStatus(null);
        const err = await onInvite({ email: email.trim(), role });
        setLoading(false);
        if (err) { setStatus({ type: 'error', msg: err }); }
        else { setStatus({ type: 'success', msg: `Invitation sent to ${email}!` }); setTimeout(onClose, 1500); }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: t.overlayBg, backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1500 }} onClick={onClose}>
            <div style={{ background: t.modalBg, border: `1px solid ${t.border}`, borderRadius: '20px', width: '90%', maxWidth: '460px', padding: '28px', boxShadow: '0 32px 80px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: t.textPrimary }}>Invite Team Member</h2>
                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: t.textMuted }}>Send an invitation link via email</p>
                    </div>
                    <button onClick={onClose} style={{ background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '9px', color: t.textMuted, cursor: 'pointer', padding: '7px', display: 'flex' }}><X size={15} /></button>
                </div>

                {status && <div style={{ marginBottom: '16px' }}><StatusAlert t={t} type={status.type}>{status.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />} {status.msg}</StatusAlert></div>}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                        <label style={{ fontSize: '12px', fontWeight: '500', color: t.textSecondary, display: 'block', marginBottom: '5px' }}>Email Address</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 13px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '9px' }}>
                            <Mail size={14} color={t.textMuted} />
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()} placeholder="colleague@company.com"
                                style={{ flex: 1, background: 'none', border: 'none', color: t.textPrimary, fontSize: '13px', outline: 'none' }} />
                        </div>
                    </div>

                    <div>
                        <label style={{ fontSize: '12px', fontWeight: '500', color: t.textSecondary, display: 'block', marginBottom: '5px' }}>Role</label>
                        <select value={role} onChange={e => setRole(e.target.value)}
                            style={{ width: '100%', padding: '10px 13px', background: t.selectBg, border: `1px solid ${t.border}`, borderRadius: '9px', fontSize: '13px', color: t.selectText, cursor: 'pointer', outline: 'none' }}>
                            {allowedRoles.map(r => (
                                <option key={r} value={r}>{roleConfig[r].label} — {r === 'admin' ? 'Full access except billing' : r === 'manager' ? 'Manage tasks & view reports' : 'Access own tasks only'}</option>
                            ))}
                        </select>
                    </div>

                    {/* Role description card */}
                    <div style={{ padding: '12px 14px', background: t.accentBg, border: `1px solid ${t.accentBorder}`, borderRadius: '10px' }}>
                        <p style={{ margin: 0, fontSize: '12px', color: t.accentText, lineHeight: 1.6 }}>
                            {role === 'admin' && '🛡️ Admins can manage users, assign tasks, view all reports, and access company analytics.'}
                            {role === 'manager' && '💼 Managers can assign tasks to their team, view department reports, and monitor progress.'}
                            {role === 'member' && '👤 Members can view and update their own assigned tasks and submit task reports.'}
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                        <button onClick={onClose} style={{ flex: 1, padding: '10px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '9px', color: t.textSecondary, fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                        <button onClick={handleSubmit} disabled={loading}
                            style={{ flex: 2, padding: '10px', background: loading ? t.inputBg : 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: '9px', color: loading ? t.textMuted : '#fff', fontSize: '13px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: loading ? 0.7 : 1, boxShadow: loading ? 'none' : '0 3px 12px rgba(99,102,241,0.35)' }}>
                            {loading ? <Spinner size={14} color="#6366f1" /> : <Send size={14} />}
                            {loading ? 'Sending…' : 'Send Invitation'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Change Role Modal ────────────────────────────────────────────────────────
const ChangeRoleModal = ({ t, member, onClose, onSave, currentUserRole }) => {
    const [role, setRole]     = useState(member.role);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null);

    const availableRoles = currentUserRole === 'owner'
        ? ['admin', 'manager', 'member']
        : ['manager', 'member'];

    const handleSave = async () => {
        if (role === member.role) { onClose(); return; }
        setLoading(true);
        const err = await onSave(member.id, role);
        setLoading(false);
        if (err) setStatus({ type: 'error', msg: err });
        else { onClose(); }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: t.overlayBg, backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1500 }} onClick={onClose}>
            <div style={{ background: t.modalBg, border: `1px solid ${t.border}`, borderRadius: '20px', width: '90%', maxWidth: '400px', padding: '28px', boxShadow: '0 32px 80px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: t.textPrimary }}>Change Role</h2>
                    <button onClick={onClose} style={{ background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '9px', color: t.textMuted, cursor: 'pointer', padding: '7px', display: 'flex' }}><X size={15} /></button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', background: t.surfaceCard, border: `1px solid ${t.border}`, borderRadius: '12px', marginBottom: '18px' }}>
                    <Avatar user={member} size={40} />
                    <div>
                        <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: t.textPrimary }}>{member.fullName || member.email}</p>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: t.textMuted }}>{member.email}</p>
                    </div>
                </div>

                {status && <div style={{ marginBottom: '14px' }}><StatusAlert t={t} type={status.type}><AlertCircle size={14} /> {status.msg}</StatusAlert></div>}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                    {availableRoles.map(r => {
                        const cfg = roleConfig[r];
                        return (
                            <button key={r} onClick={() => setRole(r)}
                                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', background: role === r ? t.accentBg : t.surfaceCard, border: `1px solid ${role === r ? t.accentBorder : t.border}`, borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cfg.color, flexShrink: 0 }}>
                                    {React.cloneElement(cfg.icon, { size: 15 })}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: t.textPrimary }}>{cfg.label}</p>
                                    <p style={{ margin: '1px 0 0', fontSize: '11px', color: t.textMuted }}>
                                        {r === 'admin' ? 'Full access except billing' : r === 'manager' ? 'Manage tasks & department' : 'Own tasks only'}
                                    </p>
                                </div>
                                {role === r && <Check size={15} color="#6366f1" />}
                            </button>
                        );
                    })}
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={onClose} style={{ flex: 1, padding: '10px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '9px', color: t.textSecondary, fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                    <button onClick={handleSave} disabled={loading}
                        style={{ flex: 2, padding: '10px', background: loading ? t.inputBg : 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: '9px', color: loading ? t.textMuted : '#fff', fontSize: '13px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', opacity: loading ? 0.7 : 1 }}>
                        {loading ? <Spinner size={14} color="#6366f1" /> : <Shield size={14} />}
                        {loading ? 'Saving…' : 'Save Role'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Remove Member Confirm Modal ──────────────────────────────────────────────
const RemoveModal = ({ t, member, onClose, onConfirm, loading }) => (
    <div style={{ position: 'fixed', inset: 0, background: t.overlayBg, backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => !loading && onClose()}>
        <div style={{ background: t.modalBg, border: `1px solid ${t.dangerBorder}`, borderRadius: '18px', padding: '28px', width: '90%', maxWidth: '420px', boxShadow: '0 30px 70px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: t.dangerBg, border: `1px solid ${t.dangerBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <UserMinus size={22} color={t.dangerText} />
                </div>
                <div>
                    <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: t.textPrimary }}>Remove Member</h3>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: t.textMuted }}>This will revoke their company access</p>
                </div>
            </div>
            <p style={{ fontSize: '14px', color: t.textSecondary, margin: '0 0 24px', lineHeight: '1.6' }}>
                Are you sure you want to remove <strong style={{ color: t.textPrimary }}>{member.fullName || member.email}</strong> from the company? Their account will remain but they'll lose access to all company data.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button onClick={onClose} disabled={loading} style={{ padding: '10px 20px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '9px', color: t.textSecondary, fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>Cancel</button>
                <button onClick={onConfirm} disabled={loading}
                    style={{ padding: '10px 20px', background: t.dangerBtn, border: 'none', borderRadius: '9px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '7px', opacity: loading ? 0.7 : 1, boxShadow: '0 4px 12px rgba(220,38,38,0.4)' }}>
                    <UserMinus size={14} />{loading ? 'Removing…' : 'Yes, Remove'}
                </button>
            </div>
        </div>
    </div>
);

// ─── Member Detail Panel ──────────────────────────────────────────────────────
const MemberDetailPanel = ({ t, member, tasks, onClose }) => {
    const memberTasks = tasks.filter(tk =>
        tk.assignee_id === member.id || tk.created_by === member.id
    );
    const completed = memberTasks.filter(tk => tk.status === 'completed').length;
    const inProgress = memberTasks.filter(tk => tk.status === 'in_progress').length;
    const overdue = memberTasks.filter(tk =>
        tk.deadline && new Date(tk.deadline) < new Date() && tk.status !== 'completed'
    ).length;
    const completionRate = memberTasks.length > 0
        ? Math.round((completed / memberTasks.length) * 100) : 0;

    const statusColor = { pending: '#f59e0b', in_progress: '#3b82f6', completed: '#10b981', blocked: '#ef4444' };
    const priorityColor = { low: '#64748b', medium: '#f59e0b', high: '#ef4444', urgent: '#dc2626' };

    return (
        <div style={{ position: 'fixed', inset: 0, background: t.overlayBg, backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1500 }} onClick={onClose}>
            <div style={{ background: t.modalBg, border: `1px solid ${t.border}`, borderRadius: '20px', width: '90%', maxWidth: '580px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.5)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div style={{ padding: '24px', borderBottom: `1px solid ${t.border}`, display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <Avatar user={member} size={56} />
                    <div style={{ flex: 1 }}>
                        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: t.textPrimary }}>{member.fullName || 'No name'}</h2>
                        <p style={{ margin: '3px 0 6px', fontSize: '13px', color: t.textMuted }}>{member.email}</p>
                        <RoleBadge role={member.role} />
                    </div>
                    <button onClick={onClose} style={{ background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '9px', color: t.textMuted, cursor: 'pointer', padding: '7px', display: 'flex', alignSelf: 'flex-start' }}><X size={15} /></button>
                </div>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', padding: '18px 24px', borderBottom: `1px solid ${t.border}` }}>
                    {[
                        { label: 'Total Tasks', value: memberTasks.length, color: '#6366f1' },
                        { label: 'Completed',   value: completed,          color: '#10b981' },
                        { label: 'In Progress', value: inProgress,         color: '#3b82f6' },
                        { label: 'Overdue',     value: overdue,            color: '#ef4444' },
                    ].map((s, i) => (
                        <div key={i} style={{ background: t.surfaceCard, border: `1px solid ${t.border}`, borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                            <div style={{ fontSize: '22px', fontWeight: '700', color: s.color }}>{s.value}</div>
                            <div style={{ fontSize: '10px', color: t.textMuted, marginTop: '2px' }}>{s.label}</div>
                        </div>
                    ))}
                </div>

                {/* Completion bar */}
                <div style={{ padding: '14px 24px', borderBottom: `1px solid ${t.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '12px', color: t.textSecondary, fontWeight: '500' }}>Completion Rate</span>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: completionRate >= 70 ? '#10b981' : completionRate >= 40 ? '#f59e0b' : '#ef4444' }}>{completionRate}%</span>
                    </div>
                    <div style={{ height: '6px', background: t.border, borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${completionRate}%`, background: completionRate >= 70 ? '#10b981' : completionRate >= 40 ? '#f59e0b' : '#ef4444', borderRadius: '3px', transition: 'width 0.5s ease' }} />
                    </div>
                </div>

                {/* Task list */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px' }}>
                    <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: '600', color: t.textSecondary }}>ASSIGNED TASKS ({memberTasks.length})</h4>
                    {memberTasks.length === 0
                        ? <p style={{ fontSize: '13px', color: t.textMuted, textAlign: 'center', padding: '28px 0' }}>No tasks assigned</p>
                        : memberTasks.map(task => {
                            const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'completed';
                            return (
                                <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 13px', background: isOverdue ? t.dangerBg : t.surfaceCard, border: `1px solid ${isOverdue ? t.dangerBorder : t.border}`, borderRadius: '9px', marginBottom: '7px', gap: '10px' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ margin: 0, fontSize: '13px', fontWeight: '500', color: t.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</p>
                                        {task.deadline && <p style={{ margin: '2px 0 0', fontSize: '11px', color: isOverdue ? t.dangerText : t.textMuted }}>
                                            {isOverdue ? '⚠️ Overdue: ' : '📅 '}{new Date(task.deadline).toLocaleDateString()}
                                        </p>}
                                    </div>
                                    <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                                        <span style={{ padding: '2px 7px', borderRadius: '12px', fontSize: '10px', fontWeight: '600', background: `${statusColor[task.status]}22`, color: statusColor[task.status] }}>
                                            {task.status.replace('_', ' ')}
                                        </span>
                                        <span style={{ padding: '2px 7px', borderRadius: '12px', fontSize: '10px', fontWeight: '600', background: `${priorityColor[task.priority]}22`, color: priorityColor[task.priority] }}>
                                            {task.priority}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    }
                </div>
            </div>
        </div>
    );
};

// ─── Member Row / Card ────────────────────────────────────────────────────────
const MemberRow = ({ t, member, currentUser, tasks, onInspect, onChangeRole, onRemove, onDeactivate }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef();

    useEffect(() => {
        const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const memberTasks = tasks.filter(tk => tk.assignee_id === member.id || tk.created_by === member.id);
    const completed   = memberTasks.filter(tk => tk.status === 'completed').length;
    const overdue     = memberTasks.filter(tk => tk.deadline && new Date(tk.deadline) < new Date() && tk.status !== 'completed').length;
    const completionRate = memberTasks.length > 0 ? Math.round((completed / memberTasks.length) * 100) : 0;

    const isSelf     = member.id === currentUser.id;
    const canManage  = ['owner', 'admin'].includes(currentUser.role) && !isSelf;
    const canRoleChange = canManage && member.role !== 'owner';

    const joinedDate = member.createdAt ? new Date(member.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—';

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px', background: t.surfacePrimary, border: `1px solid ${t.border}`, borderRadius: '13px', transition: 'border-color 0.15s', position: 'relative' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = t.borderMid}
            onMouseLeave={e => e.currentTarget.style.borderColor = t.border}>

            <Avatar user={member} size={42} />

            {/* Name & email */}
            <div style={{ flex: '0 0 200px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: t.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {member.fullName || 'No name'}
                    </p>
                    {isSelf && <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '8px', background: t.accentBg, color: t.accentText, fontWeight: '600', flexShrink: 0 }}>You</span>}
                </div>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: t.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.email}</p>
            </div>

            {/* Role */}
            <div style={{ flex: '0 0 100px' }}>
                <RoleBadge role={member.role} />
            </div>

            {/* Task stats */}
            <div style={{ flex: 1, display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: t.textPrimary }}>{memberTasks.length}</div>
                    <div style={{ fontSize: '10px', color: t.textMuted }}>Tasks</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: '#10b981' }}>{completed}</div>
                    <div style={{ fontSize: '10px', color: t.textMuted }}>Done</div>
                </div>
                {overdue > 0 && (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '16px', fontWeight: '700', color: '#ef4444' }}>{overdue}</div>
                        <div style={{ fontSize: '10px', color: t.textMuted }}>Overdue</div>
                    </div>
                )}
                {/* Progress bar */}
                <div style={{ flex: 1, maxWidth: '100px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                        <span style={{ fontSize: '10px', color: t.textMuted }}>Progress</span>
                        <span style={{ fontSize: '10px', fontWeight: '600', color: completionRate >= 70 ? '#10b981' : completionRate >= 40 ? '#f59e0b' : t.textMuted }}>{completionRate}%</span>
                    </div>
                    <div style={{ height: '4px', background: t.border, borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${completionRate}%`, background: completionRate >= 70 ? '#10b981' : completionRate >= 40 ? '#f59e0b' : '#ef4444', borderRadius: '2px', transition: 'width 0.4s ease' }} />
                    </div>
                </div>
            </div>

            {/* Joined */}
            <div style={{ flex: '0 0 80px', textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: '11px', color: t.textMuted }}>Joined</p>
                <p style={{ margin: '1px 0 0', fontSize: '12px', color: t.textSecondary, fontWeight: '500' }}>{joinedDate}</p>
            </div>

            {/* Status dot */}
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: member.isActive !== false ? '#10b981' : '#ef4444', flexShrink: 0 }} title={member.isActive !== false ? 'Active' : 'Deactivated'} />

            {/* Actions */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button onClick={() => onInspect(member)}
                    style={{ padding: '6px 12px', background: t.accentBg, border: `1px solid ${t.accentBorder}`, borderRadius: '7px', color: t.accentText, fontSize: '12px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Eye size={12} /> View
                </button>

                {canManage && (
                    <div style={{ position: 'relative' }} ref={menuRef}>
                        <button onClick={() => setMenuOpen(!menuOpen)}
                            style={{ padding: '6px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '7px', color: t.textMuted, cursor: 'pointer', display: 'flex' }}>
                            <MoreVertical size={14} />
                        </button>
                        {menuOpen && (
                            <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, width: '180px', background: t.modalBg, border: `1px solid ${t.border}`, borderRadius: '11px', boxShadow: '0 10px 30px rgba(0,0,0,0.25)', zIndex: 100, overflow: 'hidden' }}>
                                {canRoleChange && (
                                    <button onClick={() => { setMenuOpen(false); onChangeRole(member); }}
                                        style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', color: t.textPrimary, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '9px', textAlign: 'left' }}
                                        onMouseEnter={e => e.currentTarget.style.background = t.surfaceHover}
                                        onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                                        <Shield size={14} color={t.textMuted} /> Change Role
                                    </button>
                                )}
                                <button onClick={() => { setMenuOpen(false); onDeactivate(member); }}
                                    style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', color: t.warnText, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '9px', textAlign: 'left' }}
                                    onMouseEnter={e => e.currentTarget.style.background = t.surfaceHover}
                                    onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                                    <Ban size={14} /> {member.isActive !== false ? 'Deactivate' : 'Reactivate'}
                                </button>
                                <div style={{ borderTop: `1px solid ${t.border}`, margin: '4px 0' }} />
                                <button onClick={() => { setMenuOpen(false); onRemove(member); }}
                                    style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', color: t.dangerText, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '9px', textAlign: 'left' }}
                                    onMouseEnter={e => e.currentTarget.style.background = t.dangerBg}
                                    onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                                    <UserMinus size={14} /> Remove
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Pending Invitations Panel ────────────────────────────────────────────────
const InvitationsPanel = ({ t, invitations, onResend, onRevoke, loading }) => {
    if (!invitations.length) return (
        <div style={{ textAlign: 'center', padding: '32px', color: t.textMuted, fontSize: '13px' }}>
            No pending invitations
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {invitations.map(inv => (
                <div key={inv.id || inv.email} style={{ display: 'flex', alignItems: 'center', gap: '13px', padding: '13px 16px', background: t.surfacePrimary, border: `1px solid ${t.border}`, borderRadius: '11px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: t.warnBg, border: `1px solid ${t.warnBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Mail size={15} color={t.warnText} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: t.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.email}</p>
                        <p style={{ margin: '2px 0 0', fontSize: '11px', color: t.textMuted }}>
                            Invited as <span style={{ color: roleConfig[inv.role]?.color }}>{roleConfig[inv.role]?.label}</span>
                            {inv.expires_at && ` · Expires ${new Date(inv.expires_at).toLocaleDateString()}`}
                        </p>
                    </div>
                    <span style={{ padding: '3px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: t.warnBg, color: t.warnText }}>Pending</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => onResend(inv)} disabled={loading}
                            style={{ padding: '5px 10px', background: t.accentBg, border: `1px solid ${t.accentBorder}`, borderRadius: '7px', color: t.accentText, fontSize: '11px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <RefreshCw size={11} /> Resend
                        </button>
                        <button onClick={() => onRevoke(inv)} disabled={loading}
                            style={{ padding: '5px 10px', background: t.dangerBg, border: `1px solid ${t.dangerBorder}`, borderRadius: '7px', color: t.dangerText, fontSize: '11px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <X size={11} /> Revoke
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const TeamManagement = ({ dark = true }) => {
    const { user } = useAuth();
    const t = dark ? themes.dark : themes.light;

    const [members, setMembers]           = useState([]);
    const [invitations, setInvitations]   = useState([]);
    const [tasks, setTasks]               = useState([]);
    const [loading, setLoading]           = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError]               = useState(null);
    const [toast, setToast]               = useState(null);

    const [tab, setTab]                   = useState('members'); // members | invitations
    const [search, setSearch]             = useState('');
    const [roleFilter, setRoleFilter]     = useState('all');

    const [showInvite, setShowInvite]     = useState(false);
    const [changeRoleMember, setChangeRoleMember] = useState(null);
    const [removeMember, setRemoveMember] = useState(null);
    const [inspectMember, setInspectMember] = useState(null);

    const canManage = ['owner', 'admin'].includes(user?.role);

    const showToast = useCallback((msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    }, []);

    const authHeaders = useCallback(() => ({
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
    }), []);

    // ── Fetch members ──────────────────────────────────────────────────────────
    const fetchMembers = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/company/team`, { headers: authHeaders() });
            if (!res.ok) throw new Error('Failed to fetch team');
            const data = await res.json();
            // Normalize field names
            const normalized = (data.members || []).map(m => ({
                ...m,
                fullName: m.fullName || m.full_name || null,
                isActive: m.isActive !== undefined ? m.isActive : m.is_active !== 0,
                createdAt: m.createdAt || m.created_at,
            }));
            setMembers(normalized);
        } catch (err) {
            setError(err.message);
        }
    }, [authHeaders]);

    // ── Fetch invitations ──────────────────────────────────────────────────────
    const fetchInvitations = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/company/invitations`, { headers: authHeaders() });
            if (!res.ok) return; // endpoint may not exist yet — fail silently
            const data = await res.json();
            setInvitations(data.invitations || []);
        } catch (_) {}
    }, [authHeaders]);

    // ── Fetch all company tasks (for stats) ────────────────────────────────────
    const fetchTasks = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/tasks`, { headers: authHeaders() });
            if (!res.ok) return;
            const data = await res.json();
            setTasks(data.tasks || []);
        } catch (_) {}
    }, [authHeaders]);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            await Promise.all([fetchMembers(), fetchInvitations(), fetchTasks()]);
            setLoading(false);
        };
        load();
    }, [fetchMembers, fetchInvitations, fetchTasks]);

    // ── Invite ─────────────────────────────────────────────────────────────────
    const handleInvite = async ({ email, role }) => {
        try {
            const res = await fetch(`${API_BASE}/company/team/invite`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ email, role }),
            });
            const data = await res.json();
            if (!res.ok) return data.error || 'Failed to send invitation';
            await fetchInvitations();
            showToast(`Invitation sent to ${email}`);
            return null;
        } catch (err) { return err.message; }
    };

    // ── Change role ────────────────────────────────────────────────────────────
    const handleChangeRole = async (userId, role) => {
        try {
            const res = await fetch(`${API_BASE}/company/team/${userId}/role`, {
                method: 'PATCH',
                headers: authHeaders(),
                body: JSON.stringify({ role }),
            });
            const data = await res.json();
            if (!res.ok) return data.error || 'Failed to update role';
            setMembers(prev => prev.map(m => m.id === userId ? { ...m, role } : m));
            showToast('Role updated successfully');
            return null;
        } catch (err) { return err.message; }
    };

    // ── Remove member ──────────────────────────────────────────────────────────
    const handleRemove = async () => {
        if (!removeMember) return;
        setActionLoading(true);
        try {
            const res = await fetch(`${API_BASE}/company/team/${removeMember.id}`, {
                method: 'DELETE',
                headers: authHeaders(),
            });
            if (!res.ok) { const d = await res.json(); showToast(d.error || 'Failed to remove', 'error'); }
            else { setMembers(prev => prev.filter(m => m.id !== removeMember.id)); showToast(`${removeMember.fullName || removeMember.email} removed`); }
        } catch (err) { showToast(err.message, 'error'); }
        setActionLoading(false);
        setRemoveMember(null);
    };

    // ── Deactivate / reactivate ────────────────────────────────────────────────
    const handleDeactivate = async (member) => {
        const newState = member.isActive === false ? true : false;
        try {
            const res = await fetch(`${API_BASE}/company/team/${member.id}/status`, {
                method: 'PATCH',
                headers: authHeaders(),
                body: JSON.stringify({ isActive: newState }),
            });
            if (!res.ok) { showToast('Failed to update status', 'error'); return; }
            setMembers(prev => prev.map(m => m.id === member.id ? { ...m, isActive: newState } : m));
            showToast(`${member.fullName || member.email} ${newState ? 'reactivated' : 'deactivated'}`);
        } catch (err) { showToast(err.message, 'error'); }
    };

    // ── Resend / revoke invitation ─────────────────────────────────────────────
    const handleResendInvite = async (inv) => {
        try {
            const res = await fetch(`${API_BASE}/company/team/invite`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ email: inv.email, role: inv.role }),
            });
            if (!res.ok) { showToast('Failed to resend', 'error'); return; }
            showToast(`Invitation resent to ${inv.email}`);
        } catch (err) { showToast(err.message, 'error'); }
    };

    const handleRevokeInvite = async (inv) => {
        try {
            const res = await fetch(`${API_BASE}/company/invitations/${inv.id || inv.token}`, {
                method: 'DELETE',
                headers: authHeaders(),
            });
            if (!res.ok) { showToast('Failed to revoke', 'error'); return; }
            setInvitations(prev => prev.filter(i => i.id !== inv.id && i.token !== inv.token));
            showToast('Invitation revoked');
        } catch (err) { showToast(err.message, 'error'); }
    };

    // ── Export CSV ─────────────────────────────────────────────────────────────
    const exportCSV = () => {
        const rows = [
            ['Name', 'Email', 'Role', 'Total Tasks', 'Completed', 'Overdue', 'Joined'],
            ...members.map(m => {
                const mt = tasks.filter(tk => tk.assignee_id === m.id || tk.created_by === m.id);
                const done = mt.filter(tk => tk.status === 'completed').length;
                const od   = mt.filter(tk => tk.deadline && new Date(tk.deadline) < new Date() && tk.status !== 'completed').length;
                return [m.fullName || '', m.email, m.role, mt.length, done, od, m.createdAt ? new Date(m.createdAt).toLocaleDateString() : ''];
            })
        ];
        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a'); a.href = url; a.download = 'team-export.csv'; a.click();
        URL.revokeObjectURL(url);
        showToast('Team exported as CSV');
    };

    // ── Filtered members ───────────────────────────────────────────────────────
    const filtered = members.filter(m => {
        const matchSearch = !search ||
            (m.fullName || '').toLowerCase().includes(search.toLowerCase()) ||
            m.email.toLowerCase().includes(search.toLowerCase());
        const matchRole = roleFilter === 'all' || m.role === roleFilter;
        return matchSearch && matchRole;
    });

    // ── Summary stats ──────────────────────────────────────────────────────────
    const stats = {
        total:   members.length,
        active:  members.filter(m => m.isActive !== false).length,
        admins:  members.filter(m => ['owner', 'admin'].includes(m.role)).length,
        pending: invitations.length,
    };

    // ── Loading state ──────────────────────────────────────────────────────────
    if (loading) return (
        <div style={{ minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
            <Spinner size={32} />
            <p style={{ color: t.textMuted, fontSize: '14px', margin: 0 }}>Loading team…</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );

    return (
        <div style={{ padding: '24px 28px', maxWidth: '1400px', margin: '0 auto', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes slideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }`}</style>

            {/* ── Toast ── */}
            {toast && (
                <div style={{ position: 'fixed', top: '20px', right: '24px', zIndex: 3000, animation: 'slideIn 0.25s ease', background: toast.type === 'error' ? t.dangerBg : t.successBg, border: `1px solid ${toast.type === 'error' ? t.dangerBorder : t.successBorder}`, color: toast.type === 'error' ? t.dangerText : t.successText, padding: '12px 18px', borderRadius: '12px', fontSize: '13px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', maxWidth: '320px' }}>
                    {toast.type === 'error' ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
                    {toast.msg}
                </div>
            )}

            {/* ── Page Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: t.textPrimary, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Users size={22} color="#6366f1" /> Team Management
                    </h1>
                    <p style={{ margin: '5px 0 0', fontSize: '13px', color: t.textMuted }}>
                        Manage members, roles, and permissions for your organisation
                    </p>
                </div>
                {canManage && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={exportCSV}
                            style={{ padding: '9px 16px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '9px', color: t.textSecondary, fontSize: '13px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Download size={14} /> Export
                        </button>
                        <button onClick={() => setShowInvite(true)}
                            style={{ padding: '9px 18px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: '9px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', boxShadow: '0 3px 12px rgba(99,102,241,0.35)' }}>
                            <UserPlus size={15} /> Invite Member
                        </button>
                    </div>
                )}
            </div>

            {/* ── Stats Row ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '22px' }}>
                {[
                    { icon: <Users size={19} />,       value: stats.total,   label: 'Total Members',    color: '#6366f1' },
                    { icon: <Activity size={19} />,    value: stats.active,  label: 'Active Members',   color: '#10b981' },
                    { icon: <Shield size={19} />,      value: stats.admins,  label: 'Admins & Owners',  color: '#f59e0b' },
                    { icon: <Mail size={19} />,        value: stats.pending, label: 'Pending Invites',  color: '#3b82f6' },
                ].map((s, i) => (
                    <div key={i} style={{ background: t.surfacePrimary, border: `1px solid ${t.border}`, borderRadius: '13px', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '13px' }}>
                        <div style={{ width: '42px', height: '42px', borderRadius: '11px', background: `${s.color}18`, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.icon}</div>
                        <div>
                            <div style={{ fontSize: '24px', fontWeight: '700', color: t.textPrimary, lineHeight: 1 }}>{s.value}</div>
                            <div style={{ fontSize: '11px', color: t.textMuted, marginTop: '2px' }}>{s.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Error Banner ── */}
            {error && (
                <div style={{ marginBottom: '16px' }}>
                    <StatusAlert t={t} type="error"><AlertCircle size={14} /> {error} — <button onClick={() => { setError(null); fetchMembers(); }} style={{ background: 'none', border: 'none', color: t.errorText, cursor: 'pointer', textDecoration: 'underline', fontSize: '13px', padding: 0 }}>retry</button></StatusAlert>
                </div>
            )}

            {/* ── Main Panel ── */}
            <div style={{ background: t.surfacePrimary, border: `1px solid ${t.border}`, borderRadius: '15px', overflow: 'hidden' }}>

                {/* Toolbar */}
                <div style={{ padding: '16px 20px', borderBottom: `1px solid ${t.border}`, display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: '2px', background: t.inputBg, borderRadius: '9px', padding: '3px' }}>
                        {[
                            { id: 'members',     label: `Members (${members.length})` },
                            { id: 'invitations', label: `Pending (${invitations.length})` },
                        ].map(tb => (
                            <button key={tb.id} onClick={() => setTab(tb.id)}
                                style={{ padding: '6px 14px', background: tab === tb.id ? t.surfacePrimary : 'none', border: tab === tb.id ? `1px solid ${t.border}` : '1px solid transparent', borderRadius: '7px', color: tab === tb.id ? t.textPrimary : t.textMuted, fontSize: '12px', fontWeight: tab === tb.id ? '600' : '400', cursor: 'pointer', transition: 'all 0.15s' }}>
                                {tb.label}
                            </button>
                        ))}
                    </div>

                    {/* Search */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 12px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '9px', flex: 1, minWidth: '200px', maxWidth: '320px' }}>
                        <Search size={14} color={t.textMuted} />
                        <input type="text" placeholder="Search members…" value={search} onChange={e => setSearch(e.target.value)}
                            style={{ flex: 1, background: 'none', border: 'none', color: t.textPrimary, fontSize: '13px', outline: 'none' }} />
                        {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', display: 'flex', padding: 0 }}><X size={13} /></button>}
                    </div>

                    {/* Role filter */}
                    {tab === 'members' && (
                        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
                            style={{ padding: '7px 12px', background: t.selectBg, border: `1px solid ${t.border}`, borderRadius: '9px', color: t.selectText, fontSize: '12px', cursor: 'pointer', outline: 'none' }}>
                            <option value="all">All Roles</option>
                            {Object.keys(roleConfig).map(r => <option key={r} value={r}>{roleConfig[r].label}</option>)}
                        </select>
                    )}

                    {/* Refresh */}
                    <button onClick={() => { fetchMembers(); fetchInvitations(); fetchTasks(); }}
                        style={{ padding: '7px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '9px', color: t.textMuted, cursor: 'pointer', display: 'flex', marginLeft: 'auto' }}>
                        <RefreshCw size={14} />
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: '16px 20px' }}>
                    {tab === 'members' ? (
                        filtered.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '52px 20px' }}>
                                <Users size={38} color={t.textMuted} />
                                <p style={{ color: t.textMuted, margin: '12px 0 0', fontSize: '14px' }}>
                                    {search || roleFilter !== 'all' ? 'No members match your filters' : 'No team members yet'}
                                </p>
                                {canManage && !search && roleFilter === 'all' && (
                                    <button onClick={() => setShowInvite(true)}
                                        style={{ marginTop: '14px', padding: '9px 18px', background: t.accentBg, border: `1px solid ${t.accentBorder}`, borderRadius: '9px', color: t.accentText, fontSize: '13px', cursor: 'pointer', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                        <UserPlus size={14} /> Invite your first member
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {filtered.map(member => (
                                    <MemberRow key={member.id} t={t} member={member} currentUser={user} tasks={tasks}
                                        onInspect={setInspectMember}
                                        onChangeRole={setChangeRoleMember}
                                        onRemove={setRemoveMember}
                                        onDeactivate={handleDeactivate} />
                                ))}
                            </div>
                        )
                    ) : (
                        <InvitationsPanel t={t} invitations={invitations} loading={actionLoading}
                            onResend={handleResendInvite} onRevoke={handleRevokeInvite} />
                    )}
                </div>
            </div>

            {/* ── Modals ── */}
            {showInvite && (
                <InviteModal t={t} currentUserRole={user?.role} onClose={() => setShowInvite(false)} onInvite={handleInvite} />
            )}
            {changeRoleMember && (
                <ChangeRoleModal t={t} member={changeRoleMember} currentUserRole={user?.role}
                    onClose={() => setChangeRoleMember(null)} onSave={handleChangeRole} />
            )}
            {removeMember && (
                <RemoveModal t={t} member={removeMember} loading={actionLoading}
                    onClose={() => setRemoveMember(null)} onConfirm={handleRemove} />
            )}
            {inspectMember && (
                <MemberDetailPanel t={t} member={inspectMember} tasks={tasks} onClose={() => setInspectMember(null)} />
            )}
        </div>
    );
};

export default TeamManagement;