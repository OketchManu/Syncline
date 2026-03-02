// web/src/components/dashboard/Dashboard.jsx
import React, { useState, useEffect, createContext, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { taskAPI, userAPI } from '../../services/api';
import wsService from '../../services/websocket';
import {
    Plus, Search, CheckCircle2, Clock, AlertCircle, Flag, Zap, LogOut,
    Activity, ListTodo, Sun, Moon, Trash2, Bell, X, Edit2, WifiOff, Wifi,
    User, Camera, Shield, Smartphone, Save, Eye, EyeOff, ChevronRight,
    AlertTriangle
} from 'lucide-react';


// ─── Helpers ──────────────────────────────────────────────────────────────────
const getDeviceInfo = () => {
    const ua = navigator.userAgent;
    let browser = 'Unknown Browser';
    let os = 'Unknown OS';
    if (/Chrome/.test(ua) && !/Chromium|Edg/.test(ua)) browser = 'Chrome';
    else if (/Firefox/.test(ua)) browser = 'Firefox';
    else if (/Safari/.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
    else if (/Edg/.test(ua)) browser = 'Edge';
    if (/Windows/.test(ua)) os = 'Windows';
    else if (/Mac OS/.test(ua)) os = 'macOS';
    else if (/Linux/.test(ua)) os = 'Linux';
    else if (/Android/.test(ua)) os = 'Android';
    else if (/iPhone|iPad/.test(ua)) os = 'iOS';
    return `${browser} on ${os}`;
};

// Converts a stored avatar value to a displayable URL.
// - Already a full URL (http/https) → use as-is
// - Already a data: URL (base64 preview) → use as-is
// - Relative path from server (/uploads/...) → prepend API origin
// - null / undefined → return null (show initials instead)
const API_ORIGIN = 'http://localhost:3001';
const resolveAvatar = (avatar) => {
    if (!avatar) return null;
    if (avatar.startsWith('http') || avatar.startsWith('data:')) return avatar;
    return `${API_ORIGIN}${avatar}`;
};

// ─── Theme ────────────────────────────────────────────────────────────────────
const ThemeContext = createContext();
const themes = {
    dark: {
        bg: '#0f172a', surfacePrimary: '#1e293b', surfaceSecondary: 'rgba(30,41,59,0.9)',
        surfaceCard: 'rgba(255,255,255,0.04)',
        border: 'rgba(255,255,255,0.08)', borderMid: 'rgba(255,255,255,0.12)',
        text: '#e2e8f0', textPrimary: '#fff', textMuted: '#64748b', textSecondary: '#94a3b8',
        inputBg: 'rgba(255,255,255,0.07)', selectBg: '#334155', selectText: '#e2e8f0',
        selectOptionBg: '#1e293b', selectOptionText: '#e2e8f0',
        accentBg: 'rgba(99,102,241,0.15)', accentBorder: 'rgba(99,102,241,0.3)', accentText: '#a5b4fc',
        overdueBg: 'rgba(239,68,68,0.12)', overdueBorder: 'rgba(239,68,68,0.3)', overdueText: '#fca5a5',
        notifBg: 'rgba(239,68,68,0.15)', notifText: '#fca5a5',
        overlayBg: 'rgba(0,0,0,0.8)', modalBg: '#1e293b',
        errorBg: 'rgba(239,68,68,0.1)', errorBorder: 'rgba(239,68,68,0.3)', errorText: '#fca5a5',
        successBg: 'rgba(16,185,129,0.1)', successBorder: 'rgba(16,185,129,0.3)', successText: '#6ee7b7',
        warnBg: 'rgba(245,158,11,0.1)', warnBorder: 'rgba(245,158,11,0.3)', warnText: '#fcd34d',
        logoutBg: 'rgba(255,255,255,0.05)', logoutColor: '#94a3b8',
        toggleBg: 'rgba(255,255,255,0.08)', toggleIcon: '#f59e0b',
        offlineBg: 'rgba(239,68,68,0.15)', offlineText: '#fca5a5',
        onlineBg: 'rgba(16,185,129,0.15)', onlineText: '#6ee7b7',
        dangerBg: 'rgba(239,68,68,0.12)', dangerBorder: 'rgba(239,68,68,0.3)', dangerText: '#fca5a5',
        dangerBtn: '#dc2626',
    },
    light: {
        bg: '#f1f5f9', surfacePrimary: '#ffffff', surfaceSecondary: 'rgba(255,255,255,0.97)',
        surfaceCard: 'rgba(0,0,0,0.02)',
        border: 'rgba(0,0,0,0.08)', borderMid: 'rgba(0,0,0,0.12)',
        text: '#334155', textPrimary: '#0f172a', textMuted: '#64748b', textSecondary: '#475569',
        inputBg: 'rgba(0,0,0,0.04)', selectBg: '#e2e8f0', selectText: '#1e293b',
        selectOptionBg: '#fff', selectOptionText: '#1e293b',
        accentBg: 'rgba(99,102,241,0.08)', accentBorder: 'rgba(99,102,241,0.25)', accentText: '#4f46e5',
        overdueBg: 'rgba(239,68,68,0.06)', overdueBorder: 'rgba(239,68,68,0.25)', overdueText: '#dc2626',
        notifBg: 'rgba(239,68,68,0.08)', notifText: '#dc2626',
        overlayBg: 'rgba(0,0,0,0.55)', modalBg: '#ffffff',
        errorBg: 'rgba(239,68,68,0.06)', errorBorder: 'rgba(239,68,68,0.25)', errorText: '#dc2626',
        successBg: 'rgba(16,185,129,0.07)', successBorder: 'rgba(16,185,129,0.25)', successText: '#059669',
        warnBg: 'rgba(245,158,11,0.07)', warnBorder: 'rgba(245,158,11,0.25)', warnText: '#b45309',
        logoutBg: 'rgba(0,0,0,0.05)', logoutColor: '#64748b',
        toggleBg: 'rgba(0,0,0,0.07)', toggleIcon: '#6366f1',
        offlineBg: 'rgba(239,68,68,0.08)', offlineText: '#dc2626',
        onlineBg: 'rgba(16,185,129,0.08)', onlineText: '#059669',
        dangerBg: 'rgba(239,68,68,0.06)', dangerBorder: 'rgba(239,68,68,0.25)', dangerText: '#dc2626',
        dangerBtn: '#dc2626',
    }
};

// ─── Shared mini components ───────────────────────────────────────────────────
const StatusAlert = ({ t, type, children }) => {
    const styles = {
        error:   { bg: t.errorBg,   border: t.errorBorder,   color: t.errorText },
        success: { bg: t.successBg, border: t.successBorder, color: t.successText },
        warning: { bg: t.warnBg,    border: t.warnBorder,    color: t.warnText },
        offline: { bg: t.offlineBg, border: t.overdueBorder, color: t.offlineText },
    };
    const s = styles[type] || styles.error;
    return (
        <div style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color, padding: '10px 14px', borderRadius: '9px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', lineHeight: 1.4 }}>
            {children}
        </div>
    );
};

const FieldLabel = ({ t, children }) => (
    <label style={{ fontSize: '12px', fontWeight: '500', color: t.textSecondary, display: 'block', marginBottom: '5px' }}>{children}</label>
);

const TextInput = ({ t, label, ...props }) => (
    <div>
        {label && <FieldLabel t={t}>{label}</FieldLabel>}
        <input {...props} style={{ width: '100%', padding: '9px 12px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '9px', fontSize: '13px', color: t.textPrimary, boxSizing: 'border-box', transition: 'border-color 0.2s, box-shadow 0.2s', ...(props.style || {}) }} />
    </div>
);

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
const DeleteConfirmModal = ({ t, task, onConfirm, onCancel, loading }) => (
    <div style={{ position: 'fixed', inset: 0, background: t.overlayBg, backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => !loading && onCancel()}>
        <div style={{ background: t.modalBg, border: `1px solid ${t.dangerBorder}`, borderRadius: '18px', padding: '28px', width: '90%', maxWidth: '420px', boxShadow: '0 30px 70px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>

            {/* Icon + heading */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: t.dangerBg, border: `1px solid ${t.dangerBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Trash2 size={22} color={t.dangerText} />
                </div>
                <div>
                    <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: t.textPrimary }}>Delete Task</h3>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: t.textMuted }}>This action cannot be undone</p>
                </div>
            </div>

            <p style={{ fontSize: '14px', color: t.textSecondary, margin: '0 0 24px', lineHeight: '1.6' }}>
                Are you sure you want to permanently delete{' '}
                <strong style={{ color: t.textPrimary }}>"{task.title}"</strong>?
                All associated data will be removed.
            </p>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button onClick={onCancel} disabled={loading}
                    style={{ padding: '10px 20px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '9px', color: t.textSecondary, fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>
                    Cancel
                </button>
                <button onClick={onConfirm} disabled={loading}
                    style={{ padding: '10px 20px', background: t.dangerBtn, border: 'none', borderRadius: '9px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '7px', opacity: loading ? 0.7 : 1, boxShadow: '0 4px 12px rgba(220,38,38,0.4)', transition: 'all 0.15s' }}>
                    <Trash2 size={14} />{loading ? 'Deleting…' : 'Yes, Delete'}
                </button>
            </div>
        </div>
    </div>
);

// ─── Profile / Settings Modal ─────────────────────────────────────────────────
const ProfileModal = ({ t, user, onClose, onSave, onDeleteAccount, isOnline }) => {
    const [tab, setTab] = useState('profile');
    const [fullName, setFullName] = useState(user?.fullName || '');
    const [avatarPreview, setAvatarPreview] = useState(resolveAvatar(user?.avatar));
    const [avatarFile, setAvatarFile] = useState(null); // raw File object for upload
    const [currentPw, setCurrentPw] = useState('');
    const [newPw, setNewPw] = useState('');
    const [confirmPw, setConfirmPw] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState('');
    const [deleteStep, setDeleteStep] = useState(1);
    const fileRef = useRef();
    const device = getDeviceInfo();

    const pwStrength = newPw.length === 0 ? 0 : newPw.length < 6 ? 1 : newPw.length < 8 ? 2 : newPw.length < 12 ? 3 : 4;
    const pwColor = ['', '#ef4444', '#f59e0b', '#3b82f6', '#10b981'][pwStrength];

    const handleAvatarChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 3 * 1024 * 1024) { setStatus({ type: 'error', msg: 'Image must be under 3 MB' }); return; }
        setAvatarFile(file);
        const reader = new FileReader();
        reader.onload = ev => setAvatarPreview(ev.target.result);
        reader.readAsDataURL(file);
    };

    const saveProfile = async () => {
        if (!isOnline) { setStatus({ type: 'error', msg: 'You are offline.' }); return; }
        setLoading(true); setStatus(null);
        // Pass the raw File if a new one was picked; null if removed; undefined to keep existing
        const avatarPayload = avatarFile
            ? avatarFile                          // new upload → File object
            : avatarPreview === null
                ? null                            // user clicked Remove
                : undefined;                      // unchanged — keep server copy
        const err = await onSave({ fullName, avatar: avatarPayload }, 'profile', device);
        setLoading(false);
        setStatus(err ? { type: 'error', msg: err } : { type: 'success', msg: 'Profile updated successfully!' });
    };

    const savePassword = async () => {
        if (!isOnline) { setStatus({ type: 'error', msg: 'You are offline.' }); return; }
        if (newPw !== confirmPw) { setStatus({ type: 'error', msg: 'Passwords do not match.' }); return; }
        if (newPw.length < 8) { setStatus({ type: 'error', msg: 'New password must be at least 8 characters.' }); return; }
        setLoading(true); setStatus(null);
        const err = await onSave({ currentPassword: currentPw, newPassword: newPw }, 'password', device);
        setLoading(false);
        if (err) { setStatus({ type: 'error', msg: err }); }
        else { setStatus({ type: 'success', msg: 'Password updated!' }); setCurrentPw(''); setNewPw(''); setConfirmPw(''); }
    };

    const doDeleteAccount = async () => {
        if (deleteConfirm !== 'DELETE') { setStatus({ type: 'error', msg: 'Type DELETE in capitals to confirm.' }); return; }
        setLoading(true);
        await onDeleteAccount(device);
        setLoading(false);
    };

    const tabs = [
        { id: 'profile',  icon: <User size={14} />,          label: 'Profile'  },
        { id: 'security', icon: <Shield size={14} />,        label: 'Security' },
        { id: 'danger',   icon: <AlertTriangle size={14} />, label: 'Danger'   },
    ];

    return (
        <div style={{ position: 'fixed', inset: 0, background: t.overlayBg, backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1500 }} onClick={onClose}>
            <div style={{ background: t.modalBg, border: `1px solid ${t.border}`, borderRadius: '20px', width: '90%', maxWidth: '540px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.5)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div style={{ padding: '22px 24px 0', borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: t.textPrimary }}>Account Settings</h2>
                            <p style={{ margin: '4px 0 0', fontSize: '11px', color: t.textMuted, display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <Smartphone size={10} /> {device}
                            </p>
                        </div>
                        <button onClick={onClose} style={{ background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '9px', color: t.textMuted, cursor: 'pointer', padding: '7px', display: 'flex' }}>
                            <X size={15} />
                        </button>
                    </div>
                    <div style={{ display: 'flex', gap: '2px' }}>
                        {tabs.map(tb => (
                            <button key={tb.id} onClick={() => { setTab(tb.id); setStatus(null); }}
                                style={{ padding: '8px 15px', background: 'none', border: 'none', borderBottom: `2px solid ${tab === tb.id ? '#6366f1' : 'transparent'}`, color: tab === tb.id ? '#6366f1' : t.textMuted, fontSize: '13px', fontWeight: tab === tb.id ? '600' : '400', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
                                {tb.icon}{tb.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Scrollable body */}
                <div style={{ padding: '22px 24px', overflowY: 'auto', flex: 1 }}>
                    {status && <div style={{ marginBottom: '16px' }}><StatusAlert t={t} type={status.type}>{status.type === 'success' ? '✅' : '⚠️'} {status.msg}</StatusAlert></div>}

                    {/* ── Profile ── */}
                    {tab === 'profile' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                            {/* Avatar card */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '18px', padding: '18px', background: t.accentBg, border: `1px solid ${t.accentBorder}`, borderRadius: '14px' }}>
                                <div style={{ position: 'relative', flexShrink: 0 }}>
                                    <div style={{ width: '78px', height: '78px', borderRadius: '50%', overflow: 'hidden', border: `3px solid ${t.accentBorder}` }}>
                                        {avatarPreview
                                            ? <img src={avatarPreview} alt="av" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: '700', color: '#fff' }}>
                                                {(user?.fullName || user?.email || '?').charAt(0).toUpperCase()}
                                              </div>
                                        }
                                    </div>
                                    <button onClick={() => fileRef.current.click()}
                                        style={{ position: 'absolute', bottom: 0, right: 0, width: '24px', height: '24px', borderRadius: '50%', background: '#6366f1', border: `2px solid ${t.modalBg}`, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Camera size={11} />
                                    </button>
                                    <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: '600', color: t.textPrimary }}>Profile Photo</p>
                                    <p style={{ margin: '0 0 10px', fontSize: '12px', color: t.textMuted }}>JPG, PNG or GIF · Max 3 MB</p>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={() => fileRef.current.click()} style={{ padding: '5px 12px', background: t.accentBg, border: `1px solid ${t.accentBorder}`, borderRadius: '7px', color: t.accentText, fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>Upload photo</button>
                                        {avatarPreview && <button onClick={() => { setAvatarPreview(null); setAvatarFile(null); }} style={{ padding: '5px 12px', background: t.dangerBg, border: `1px solid ${t.dangerBorder}`, borderRadius: '7px', color: t.dangerText, fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>Remove</button>}
                                    </div>
                                </div>
                            </div>

                            <TextInput t={t} label="Full Name" type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" />
                            <TextInput t={t} label="Email Address" type="email" value={user?.email || ''} readOnly style={{ opacity: 0.55, cursor: 'not-allowed' }} />
                            <p style={{ margin: '-10px 0 0', fontSize: '11px', color: t.textMuted }}>Email can only be changed by contacting support.</p>

                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button onClick={saveProfile} disabled={loading || !isOnline}
                                    style={{ padding: '10px 22px', background: (loading || !isOnline) ? t.inputBg : 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: '9px', color: (loading || !isOnline) ? t.textMuted : '#fff', fontSize: '13px', fontWeight: '600', cursor: (loading || !isOnline) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '7px', opacity: (loading || !isOnline) ? 0.6 : 1, boxShadow: (loading || !isOnline) ? 'none' : '0 3px 12px rgba(99,102,241,0.35)' }}>
                                    <Save size={14} />{loading ? 'Saving…' : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Security ── */}
                    {tab === 'security' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <StatusAlert t={t} type="warning">
                                <Shield size={14} /> Changing your password will notify all signed-in devices.
                            </StatusAlert>

                            {/* Current password */}
                            <div>
                                <FieldLabel t={t}>Current Password</FieldLabel>
                                <div style={{ position: 'relative' }}>
                                    <input type={showCurrent ? 'text' : 'password'} value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="Enter current password"
                                        style={{ width: '100%', padding: '9px 38px 9px 12px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '9px', fontSize: '13px', color: t.textPrimary, boxSizing: 'border-box' }} />
                                    <button type="button" onClick={() => setShowCurrent(!showCurrent)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', display: 'flex' }}>
                                        {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                                    </button>
                                </div>
                            </div>

                            {/* New password */}
                            <div>
                                <FieldLabel t={t}>New Password</FieldLabel>
                                <div style={{ position: 'relative' }}>
                                    <input type={showNew ? 'text' : 'password'} value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Min. 8 characters"
                                        style={{ width: '100%', padding: '9px 38px 9px 12px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '9px', fontSize: '13px', color: t.textPrimary, boxSizing: 'border-box' }} />
                                    <button type="button" onClick={() => setShowNew(!showNew)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', display: 'flex' }}>
                                        {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                                    </button>
                                </div>
                                {newPw && (
                                    <div style={{ marginTop: '7px' }}>
                                        <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                                            {[1,2,3,4].map(i => (
                                                <div key={i} style={{ flex: 1, height: '3px', borderRadius: '2px', background: i <= pwStrength ? pwColor : t.border, transition: 'background 0.2s' }} />
                                            ))}
                                        </div>
                                        <span style={{ fontSize: '11px', color: pwColor }}>
                                            {['', 'Too weak', 'Weak', 'Good', 'Strong'][pwStrength]}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <TextInput t={t} label="Confirm New Password" type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Re-enter new password" />

                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button onClick={savePassword} disabled={loading || !isOnline || !currentPw || !newPw || !confirmPw}
                                    style={{ padding: '10px 22px', background: (loading || !isOnline || !currentPw || !newPw || !confirmPw) ? t.inputBg : 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: '9px', color: (loading || !isOnline || !currentPw || !newPw || !confirmPw) ? t.textMuted : '#fff', fontSize: '13px', fontWeight: '600', cursor: (loading || !isOnline || !currentPw || !newPw || !confirmPw) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '7px', opacity: (loading || !isOnline || !currentPw || !newPw || !confirmPw) ? 0.6 : 1, boxShadow: '0 3px 12px rgba(99,102,241,0.35)' }}>
                                    <Shield size={14} />{loading ? 'Updating…' : 'Update Password'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Danger Zone ── */}
                    {tab === 'danger' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <StatusAlert t={t} type="error">
                                <AlertTriangle size={14} /> Account deletion is permanent and cannot be reversed.
                            </StatusAlert>

                            {deleteStep === 1 ? (
                                <div style={{ padding: '20px', background: t.dangerBg, border: `1px solid ${t.dangerBorder}`, borderRadius: '14px' }}>
                                    <h4 style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: '700', color: t.dangerText }}>Delete My Account</h4>
                                    <p style={{ margin: '0 0 16px', fontSize: '13px', color: t.textSecondary, lineHeight: '1.65' }}>
                                        All your tasks, profile data, and account information will be permanently erased.
                                        Every active session across all devices will be immediately signed out.
                                    </p>
                                    <button onClick={() => setDeleteStep(2)}
                                        style={{ padding: '9px 18px', background: t.dangerBtn, border: 'none', borderRadius: '9px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', boxShadow: '0 3px 10px rgba(220,38,38,0.3)' }}>
                                        <Trash2 size={14} /> I understand, proceed
                                    </button>
                                </div>
                            ) : (
                                <div style={{ padding: '20px', background: t.dangerBg, border: `1px solid ${t.dangerBorder}`, borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                    <p style={{ margin: 0, fontSize: '13px', color: t.textSecondary }}>
                                        Type <strong style={{ color: t.dangerText, fontFamily: 'monospace', letterSpacing: '0.05em' }}>DELETE</strong> in capitals to confirm:
                                    </p>
                                    <input type="text" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="Type DELETE here"
                                        style={{ width: '100%', padding: '10px 12px', background: t.inputBg, border: `2px solid ${deleteConfirm === 'DELETE' ? t.dangerBtn : t.dangerBorder}`, borderRadius: '9px', fontSize: '14px', color: t.textPrimary, boxSizing: 'border-box', fontFamily: 'monospace', letterSpacing: '0.05em', transition: 'border-color 0.2s' }} />
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button onClick={() => { setDeleteStep(1); setDeleteConfirm(''); }}
                                            style={{ flex: 1, padding: '9px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '9px', color: t.textSecondary, fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>
                                            Cancel
                                        </button>
                                        <button onClick={doDeleteAccount} disabled={deleteConfirm !== 'DELETE' || loading}
                                            style={{ flex: 1, padding: '9px', background: deleteConfirm === 'DELETE' ? t.dangerBtn : t.inputBg, border: 'none', borderRadius: '9px', color: deleteConfirm === 'DELETE' ? '#fff' : t.textMuted, fontSize: '13px', fontWeight: '600', cursor: deleteConfirm !== 'DELETE' || loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, transition: 'all 0.2s' }}>
                                            {loading ? 'Deleting…' : '🗑️ Delete Forever'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
const Dashboard = () => {
    const { user, logout, updateUser } = useAuth();
    const [dark, setDark] = useState(true);
    const t = dark ? themes.dark : themes.light;

    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editTask, setEditTask] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [wsConnected, setWsConnected] = useState(
        () => wsService?.connected ?? wsService?.socket?.readyState === 1 ?? false
    );
    const [recentActivity, setRecentActivity] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState(null);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    const userIdRef = useRef(user?.id);
    useEffect(() => { userIdRef.current = user?.id; }, [user?.id]);

    const addActivity = useCallback((msg) => {
        setRecentActivity(prev => [{ id: Date.now(), message: msg, timestamp: new Date() }, ...prev].slice(0, 10));
    }, []);

    const addNotification = useCallback((title, message, type = 'info') => {
        setNotifications(prev => [{ id: Date.now(), title, message, type, read: false }, ...prev].slice(0, 20));
    }, []);

    const fetchTasks = useCallback(async () => {
        try {
            const res = await taskAPI.getAll();
            const userTasks = res.data.tasks.filter(task =>
                task.created_by === userIdRef.current || task.assignee_id === userIdRef.current
            );
            setTasks(userTasks);
        } catch (err) { console.error('Fetch tasks error:', err); }
    }, []);

    // Online/offline
    useEffect(() => {
        const goOnline  = () => { setIsOnline(true);  addActivity('🟢 Connection restored'); addNotification('Back Online', 'Your connection has been restored', 'info'); };
        const goOffline = () => { setIsOnline(false); addActivity('🔴 Lost connection');      addNotification('Offline', 'You are offline. Some features are limited.', 'warning'); };
        window.addEventListener('online',  goOnline);
        window.addEventListener('offline', goOffline);
        return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
    }, [addActivity, addNotification]);

    // Mount: load + WS subscriptions
    useEffect(() => {
        const load = async () => { setLoading(true); await fetchTasks(); setLoading(false); };
        load();

        const onConnection = (data) => {
            if (typeof data === 'boolean') setWsConnected(data);
            else if (data && typeof data.connected === 'boolean') setWsConnected(data.connected);
            else setWsConnected(true);
        };
        let pollCount = 0;
        const pollInterval = setInterval(() => {
            const state = wsService?.socket?.readyState ?? wsService?.readyState;
            if (state === 1) { setWsConnected(true); clearInterval(pollInterval); }
            else if (++pollCount >= 10) clearInterval(pollInterval);
        }, 1000);

        const onCreated = (data) => {
            if (data.task.created_by === userIdRef.current || data.task.assignee_id === userIdRef.current) {
                setTasks(prev => [data.task, ...prev]);
                addActivity(`${data.creator?.fullName || data.creator?.email} created "${data.task.title}"`);
                addNotification('New Task', `"${data.task.title}" was created`, 'info');
            }
        };
        const onUpdated = (data) => {
            if (data.task.created_by === userIdRef.current || data.task.assignee_id === userIdRef.current) {
                setTasks(prev => prev.map(tk => tk.id === data.task.id ? data.task : tk));
                addActivity(`${data.updater?.fullName || data.updater?.email} updated "${data.task.title}"`);
            }
        };
        const onStatusChanged = (data) => {
            setTasks(prev => {
                const tk = prev.find(tk => tk.id === data.task.id);
                if (tk && (tk.created_by === userIdRef.current || tk.assignee_id === userIdRef.current)) {
                    addActivity(`"${data.title}" moved to ${data.newStatus}`);
                    return prev.map(tk => tk.id === data.task.id ? data.task : tk);
                }
                return prev;
            });
        };
        const onDeleted = (data) => {
            setTasks(prev => prev.filter(tk => tk.id !== data.taskId));
            addActivity(`Task deleted by ${data.deleter?.fullName || data.deleter?.email}`);
        };
        const onFlagged = (data) => {
            if (data.task.created_by === userIdRef.current || data.task.assignee_id === userIdRef.current) {
                setTasks(prev => prev.map(tk => tk.id === data.task.id ? data.task : tk));
                addActivity(`"${data.task.title}" was flagged: ${data.reason}`);
                addNotification('Task Flagged', `"${data.task.title}": ${data.reason}`, 'warning');
            }
        };
        // Cross-device account change notifications
        const onProfileUpdated = (data) => {
            if (data.userId === userIdRef.current && data.device !== getDeviceInfo()) {
                addNotification('Profile Updated', `Your profile was changed from ${data.device}`, 'info');
                addActivity(`🔔 Profile updated from ${data.device}`);
            }
        };
        const onPasswordChanged = (data) => {
            if (data.userId === userIdRef.current && data.device !== getDeviceInfo()) {
                addNotification('⚠️ Security Alert', `Password changed from ${data.device}. Not you? Contact support immediately.`, 'warning');
                addActivity(`⚠️ Password changed from ${data.device}`);
            }
        };

        wsService.on('connection', onConnection);
        wsService.on('task:created', onCreated);
        wsService.on('task:updated', onUpdated);
        wsService.on('task:status_changed', onStatusChanged);
        wsService.on('task:deleted', onDeleted);
        wsService.on('task:flagged', onFlagged);
        wsService.on('user:profile_updated', onProfileUpdated);
        wsService.on('user:password_changed', onPasswordChanged);

        return () => {
            clearInterval(pollInterval);
            wsService.off('connection', onConnection);
            wsService.off('task:created', onCreated);
            wsService.off('task:updated', onUpdated);
            wsService.off('task:status_changed', onStatusChanged);
            wsService.off('task:deleted', onDeleted);
            wsService.off('task:flagged', onFlagged);
            wsService.off('user:profile_updated', onProfileUpdated);
            wsService.off('user:password_changed', onPasswordChanged);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filteredTasks = tasks.filter(task => {
        const matchesFilter = filter === 'all' || task.status === filter;
        const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (task.description || '').toLowerCase().includes(searchQuery.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const updateTaskStatus = async (taskId, newStatus) => {
        if (!isOnline) { addNotification('Offline', 'Cannot update tasks while offline', 'warning'); return; }

        // Optimistic update — change the UI immediately
        const previousTasks = tasks;
        setTasks(prev => prev.map(tk => tk.id === taskId ? { ...tk, status: newStatus } : tk));
        setUpdatingStatus(taskId);

        try {
            await taskAPI.update(taskId, { status: newStatus });
            addActivity(`Status changed to ${newStatus}`);
        } catch (err) {
            console.error(err);
            // Roll back to previous state if server call failed
            setTasks(previousTasks);
            addNotification('Error', 'Failed to update task status', 'error');
        } finally { setUpdatingStatus(null); }
    };

    // Delete task — triggered by confirm modal
    const confirmDeleteTask = async () => {
        if (!deleteTarget) return;
        if (!isOnline) {
            addNotification('Offline', 'Cannot delete tasks while offline', 'warning');
            setDeleteTarget(null);
            return;
        }
        setDeleteLoading(true);
        try {
            await taskAPI.delete(deleteTarget.id);
            setTasks(prev => prev.filter(tk => tk.id !== deleteTarget.id));
            addActivity(`You deleted "${deleteTarget.title}"`);
            addNotification('Task Deleted', `"${deleteTarget.title}" was removed`, 'info');
            setDeleteTarget(null);
        } catch (err) {
            console.error('Delete task error:', err);
            const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to delete task';
            addNotification('Delete Failed', msg, 'error');
        } finally { setDeleteLoading(false); }
    };

    // Profile/account save — uses FormData so the server receives a real file upload
    const handleProfileSave = async (data, type, device) => {
        try {
            if (type === 'profile') {
                let updatedUser;

                if (data.avatar instanceof File) {
                    // New image selected — send as multipart/form-data
                    const form = new FormData();
                    form.append('avatar', data.avatar, data.avatar.name);
                    form.append('fullName', data.fullName || '');
                    form.append('device', device);
                    const res = await userAPI.updateProfile(form);
                    updatedUser = res.data?.user ?? res.data;

                } else if (data.avatar === null) {
                    // User explicitly removed their photo
                    const res = await userAPI.updateProfile({ fullName: data.fullName, removeAvatar: true, device });
                    updatedUser = res.data?.user ?? res.data;

                } else {
                    // Name change only, no avatar change
                    const res = await userAPI.updateProfile({ fullName: data.fullName, device });
                    updatedUser = res.data?.user ?? res.data;
                }

                if (updatedUser && updateUser) updateUser(updatedUser);
                addActivity(`You updated your profile from ${device}`);
                addNotification('Profile Updated', `Changes saved · ${device}`, 'info');

            } else if (type === 'password') {
                await userAPI.changePassword({
                    currentPassword: data.currentPassword,
                    newPassword:     data.newPassword,
                    device,
                });
                addActivity(`Password changed from ${device}`);
                addNotification('Password Changed', `Your password was updated · ${device}`, 'info');
            }
            return null; // no error
        } catch (err) {
            console.error(`Profile save (${type}) error:`, err);
            const msg =
                err.response?.data?.message ||
                err.response?.data?.error   ||
                err.message                 ||
                `Failed to update ${type}`;
            return msg;
        }
    };

    // Delete account — wipes all local state/storage then calls logout
    const handleDeleteAccount = async (device) => {
        try {
            // Tell the server to delete the account
            await userAPI.deleteAccount({ device });
        } catch (err) {
            // If the server returns 404/410 the account may already be gone — treat as success
            const status = err.response?.status;
            if (status && status !== 404 && status !== 410) {
                addNotification('Error', err.response?.data?.error || 'Could not delete account. Contact support.', 'error');
                return; // abort — don't log the user out if the server rejected the request
            }
        }
        // Clear every scrap of local data then force a full page reload to the login screen
        try { localStorage.clear(); } catch (_) {}
        try { sessionStorage.clear(); } catch (_) {}
        logout(); // invalidates auth context
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    if (loading) {
        return (
            <ThemeContext.Provider value={{ t, dark }}>
                <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: t.bg }}>
                    <div style={{ width: '46px', height: '46px', border: `4px solid ${dark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.15)'}`, borderTop: '4px solid #6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    <p style={{ color: t.textMuted, marginTop: '18px', fontSize: '14px' }}>Loading Syncline…</p>
                </div>
            </ThemeContext.Provider>
        );
    }

    return (
        <ThemeContext.Provider value={{ t, dark }}>
            <div style={{ minHeight: '100vh', background: t.bg, color: t.text, fontFamily: "'Segoe UI', system-ui, sans-serif", transition: 'background 0.3s, color 0.3s' }}>
                <style>{`
                    @keyframes spin { to { transform: rotate(360deg); } }
                    select option { background: ${t.selectOptionBg} !important; color: ${t.selectOptionText} !important; }
                    input:focus, select:focus, textarea:focus { outline: none; border-color: #6366f1 !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.2) !important; }
                    ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: ${t.borderMid}; border-radius: 3px; }
                `}</style>

                {/* ── Header ── */}
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 28px', background: t.surfaceSecondary, backdropFilter: 'blur(20px)', borderBottom: `1px solid ${t.border}`, position: 'sticky', top: 0, zIndex: 100 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Zap size={23} color="#6366f1" />
                            <h1 style={{ fontSize: '19px', fontWeight: '700', margin: 0, color: t.textPrimary }}>Syncline</h1>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', background: isOnline ? t.onlineBg : t.offlineBg, borderRadius: '16px', border: `1px solid ${t.border}` }}>
                            {isOnline ? <Wifi size={11} color={t.onlineText} /> : <WifiOff size={11} color={t.offlineText} />}
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: wsConnected && isOnline ? '#10b981' : '#ef4444' }} />
                            <span style={{ fontSize: '11px', color: isOnline ? t.onlineText : t.offlineText, fontWeight: '500' }}>
                                {!isOnline ? 'Offline' : wsConnected ? 'Live' : 'Connecting'}
                            </span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button onClick={() => setDark(!dark)} style={{ padding: '7px', background: t.toggleBg, border: `1px solid ${t.border}`, borderRadius: '9px', color: t.toggleIcon, cursor: 'pointer', display: 'flex' }}>
                            {dark ? <Sun size={16} /> : <Moon size={16} />}
                        </button>

                        {/* Notifications */}
                        <div style={{ position: 'relative' }}>
                            <button onClick={() => setShowNotifications(!showNotifications)} style={{ padding: '7px', background: t.toggleBg, border: `1px solid ${t.border}`, borderRadius: '9px', color: t.textSecondary, cursor: 'pointer', display: 'flex' }}>
                                <Bell size={16} />
                                {unreadCount > 0 && <span style={{ position: 'absolute', top: '1px', right: '1px', width: '16px', height: '16px', borderRadius: '50%', background: '#ef4444', color: '#fff', fontSize: '9px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${t.bg}` }}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
                            </button>
                            {showNotifications && (
                                <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '320px', background: t.modalBg, border: `1px solid ${t.border}`, borderRadius: '14px', boxShadow: '0 14px 44px rgba(0,0,0,0.28)', zIndex: 200, overflow: 'hidden' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 15px', borderBottom: `1px solid ${t.border}` }}>
                                        <span style={{ fontSize: '13px', fontWeight: '600', color: t.textPrimary }}>Notifications</span>
                                        <button onClick={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))} style={{ background: 'none', border: 'none', color: t.accentText, fontSize: '11px', cursor: 'pointer', fontWeight: '500' }}>Mark all read</button>
                                    </div>
                                    <div style={{ maxHeight: '310px', overflowY: 'auto' }}>
                                        {notifications.length === 0
                                            ? <p style={{ fontSize: '13px', color: t.textMuted, textAlign: 'center', padding: '28px 16px', margin: 0 }}>No notifications yet</p>
                                            : notifications.map(n => (
                                                <div key={n.id} onClick={() => setNotifications(prev => prev.map(i => i.id === n.id ? { ...i, read: true } : i))}
                                                    style={{ padding: '11px 15px', borderBottom: `1px solid ${t.border}`, background: n.read ? 'transparent' : (n.type === 'warning' ? t.notifBg : t.accentBg), cursor: 'pointer', transition: 'background 0.15s' }}>
                                                    <p style={{ margin: '0 0 3px', fontSize: '13px', fontWeight: n.read ? '400' : '600', color: t.textPrimary }}>{n.title}</p>
                                                    <p style={{ margin: 0, fontSize: '11px', color: t.textMuted, lineHeight: 1.4 }}>{n.message}</p>
                                                </div>
                                            ))
                                        }
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* User button → opens profile */}
                        <button onClick={() => setShowProfile(true)}
                            style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '5px 10px 5px 5px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '11px', cursor: 'pointer', transition: 'all 0.2s' }}>
                            <div style={{ width: '30px', height: '30px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                                {user?.avatar
                                    ? <img src={resolveAvatar(user.avatar)} alt="av" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', color: '#fff' }}>
                                        {(user?.fullName || user?.email || '?').charAt(0).toUpperCase()}
                                      </div>
                                }
                            </div>
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontSize: '12px', fontWeight: '600', color: t.textPrimary, maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.fullName || user?.email}</div>
                                <div style={{ fontSize: '10px', color: t.textMuted, textTransform: 'capitalize' }}>{user?.role}</div>
                            </div>
                            <ChevronRight size={12} color={t.textMuted} />
                        </button>

                        <button onClick={logout} style={{ padding: '7px', background: t.logoutBg, border: `1px solid ${t.border}`, borderRadius: '9px', color: t.logoutColor, cursor: 'pointer', display: 'flex' }} title="Logout">
                            <LogOut size={16} />
                        </button>
                    </div>
                </header>

                {/* Offline banner */}
                {!isOnline && (
                    <div style={{ padding: '10px 28px', background: t.offlineBg, borderBottom: `1px solid ${t.overdueBorder}`, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                        <WifiOff size={14} color={t.offlineText} />
                        <span style={{ fontSize: '13px', color: t.offlineText, fontWeight: '500' }}>You're offline. Some features are limited.</span>
                    </div>
                )}

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '13px', padding: '20px 28px 0', maxWidth: '1400px', margin: '0 auto' }}>
                    {[
                        { icon: <ListTodo size={20} />,    value: tasks.length,                                                                                              label: 'Your Tasks',  color: '#6366f1' },
                        { icon: <Clock size={20} />,       value: tasks.filter(tk => tk.status === 'in_progress').length,                                                    label: 'In Progress', color: '#f59e0b' },
                        { icon: <CheckCircle2 size={20} />,value: tasks.filter(tk => tk.status === 'completed').length,                                                      label: 'Completed',   color: '#10b981' },
                        { icon: <AlertCircle size={20} />, value: tasks.filter(tk => tk.deadline && new Date(tk.deadline) < new Date() && tk.status !== 'completed').length, label: 'Overdue',     color: '#ef4444' },
                    ].map((s, i) => (
                        <div key={i} style={{ background: t.surfacePrimary, border: `1px solid ${t.border}`, borderRadius: '13px', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '13px' }}>
                            <div style={{ width: '42px', height: '42px', borderRadius: '11px', background: `${s.color}18`, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.icon}</div>
                            <div>
                                <div style={{ fontSize: '24px', fontWeight: '700', color: t.textPrimary, lineHeight: 1 }}>{s.value}</div>
                                <div style={{ fontSize: '11px', color: t.textMuted, marginTop: '2px' }}>{s.label}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Main */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 296px', gap: '16px', padding: '16px 28px 44px', maxWidth: '1400px', margin: '0 auto' }}>

                    {/* Tasks panel */}
                    <div style={{ background: t.surfacePrimary, border: `1px solid ${t.border}`, borderRadius: '15px', padding: '22px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h2 style={{ fontSize: '16px', fontWeight: '600', color: t.textPrimary, margin: 0 }}>Your Tasks</h2>
                            <button onClick={() => isOnline && setShowCreateModal(true)} disabled={!isOnline}
                                style={{ padding: '8px 16px', background: isOnline ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : t.inputBg, border: 'none', borderRadius: '9px', color: isOnline ? '#fff' : t.textMuted, fontSize: '13px', fontWeight: '600', cursor: isOnline ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '6px', opacity: isOnline ? 1 : 0.6, boxShadow: isOnline ? '0 3px 12px rgba(99,102,241,0.3)' : 'none' }}>
                                <Plus size={15} /><span>New Task</span>
                            </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '9px', marginBottom: '10px' }}>
                            <Search size={15} color={t.textMuted} />
                            <input type="text" placeholder="Search your tasks…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ flex: 1, background: 'none', border: 'none', color: t.textPrimary, fontSize: '13px', outline: 'none' }} />
                            {searchQuery && <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', padding: '2px', display: 'flex' }}><X size={13} /></button>}
                        </div>

                        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
                            {['all', 'pending', 'in_progress', 'completed', 'blocked'].map(s => (
                                <button key={s} onClick={() => setFilter(s)}
                                    style={{ padding: '5px 12px', background: filter === s ? t.accentBg : t.inputBg, border: `1px solid ${filter === s ? t.accentBorder : t.border}`, borderRadius: '18px', color: filter === s ? t.accentText : t.textSecondary, fontSize: '11px', fontWeight: filter === s ? '600' : '400', cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.15s' }}>
                                    {s.replace('_', ' ')}
                                </button>
                            ))}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '520px', overflowY: 'auto' }}>
                            {filteredTasks.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '52px 20px' }}>
                                    <ListTodo size={40} color={t.textMuted} />
                                    <p style={{ color: t.textMuted, margin: '10px 0', fontSize: '14px' }}>{searchQuery || filter !== 'all' ? 'No matching tasks' : 'No tasks yet'}</p>
                                    {!searchQuery && filter === 'all' && isOnline && (
                                        <button onClick={() => setShowCreateModal(true)} style={{ padding: '8px 16px', background: t.accentBg, border: `1px solid ${t.accentBorder}`, borderRadius: '8px', color: t.accentText, fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>Create your first task</button>
                                    )}
                                </div>
                            ) : filteredTasks.map(task => (
                                <TaskCard key={task.id} task={task} t={t}
                                    onStatusChange={updateTaskStatus}
                                    onDelete={() => setDeleteTarget(task)}
                                    onEdit={() => setEditTask(task)}
                                    updatingStatus={updatingStatus} isOnline={isOnline} />
                            ))}
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div style={{ background: t.surfacePrimary, border: `1px solid ${t.border}`, borderRadius: '15px', padding: '22px', height: 'fit-content', position: 'sticky', top: '68px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                            <Activity size={17} color="#6366f1" />
                            <h3 style={{ fontSize: '14px', fontWeight: '600', color: t.textPrimary, margin: 0 }}>Live Activity</h3>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: wsConnected && isOnline ? '#10b981' : '#ef4444', marginLeft: 'auto' }} />
                        </div>
                        <div style={{ maxHeight: '480px', overflowY: 'auto' }}>
                            {recentActivity.length === 0
                                ? <p style={{ fontSize: '12px', color: t.textMuted, textAlign: 'center', padding: '28px 0', lineHeight: '1.5', margin: 0 }}>Activity will appear here in real-time</p>
                                : recentActivity.map(a => (
                                    <div key={a.id} style={{ display: 'flex', gap: '9px', marginBottom: '12px' }}>
                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6366f1', marginTop: '6px', flexShrink: 0 }} />
                                        <div>
                                            <p style={{ fontSize: '12px', color: t.text, margin: '0 0 2px', lineHeight: '1.4' }}>{a.message}</p>
                                            <p style={{ fontSize: '10px', color: t.textMuted, margin: 0 }}>{new Date(a.timestamp).toLocaleTimeString()}</p>
                                        </div>
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                </div>

                {/* ── Modals ── */}
                {showCreateModal && (
                    <TaskModal t={t} title="Create New Task" onClose={() => setShowCreateModal(false)} isOnline={isOnline}
                        onSave={async (data) => {
                            try { await taskAPI.create(data); setShowCreateModal(false); addActivity(`You created "${data.title}"`); addNotification('Task Created', `"${data.title}" created`, 'info'); fetchTasks(); }
                            catch (err) { return err.response?.data?.error || 'Failed to create task'; }
                        }} />
                )}

                {editTask && (
                    <TaskModal t={t} title="Edit Task" initialData={editTask} onClose={() => setEditTask(null)} isOnline={isOnline}
                        onSave={async (data) => {
                            try { await taskAPI.update(editTask.id, data); setEditTask(null); addActivity(`You updated "${data.title}"`); addNotification('Task Updated', `"${data.title}" updated`, 'info'); fetchTasks(); }
                            catch (err) { return err.response?.data?.error || 'Failed to update task'; }
                        }} />
                )}

                {deleteTarget && (
                    <DeleteConfirmModal t={t} task={deleteTarget} loading={deleteLoading}
                        onConfirm={confirmDeleteTask}
                        onCancel={() => !deleteLoading && setDeleteTarget(null)} />
                )}

                {showProfile && (
                    <ProfileModal t={t} user={user} isOnline={isOnline}
                        onClose={() => setShowProfile(false)}
                        onSave={handleProfileSave}
                        onDeleteAccount={handleDeleteAccount} />
                )}

                {showNotifications && <div onClick={() => setShowNotifications(false)} style={{ position: 'fixed', inset: 0, zIndex: 150 }} />}
            </div>
        </ThemeContext.Provider>
    );
};

// ─── TaskCard ─────────────────────────────────────────────────────────────────
const TaskCard = ({ task, t, onStatusChange, onDelete, onEdit, updatingStatus, isOnline }) => {
    const statusColor  = { pending: '#f59e0b', in_progress: '#3b82f6', completed: '#10b981', blocked: '#ef4444' };
    const priorityColor = { low: '#64748b', medium: '#f59e0b', high: '#ef4444', urgent: '#dc2626' };
    const isOverdue = task.deadline && task.status !== 'completed' && new Date(task.deadline) < new Date();
    const isUpdating = updatingStatus === task.id;

    return (
        <div style={{ background: isOverdue ? t.overdueBg : t.surfaceCard, border: `1px solid ${isOverdue ? t.overdueBorder : t.border}`, borderRadius: '12px', padding: '14px', transition: 'all 0.2s', opacity: isOnline ? 1 : 0.75 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', color: t.textPrimary, margin: 0, lineHeight: '1.3', flex: 1 }}>{task.title}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1px', flexShrink: 0 }}>
                    {!!task.flagged && <Flag size={13} color="#ef4444" fill="#ef4444" />}
                    {/* Edit */}
                    <button onClick={onEdit} disabled={!isOnline}
                        style={{ background: 'none', border: 'none', color: t.textMuted, cursor: isOnline ? 'pointer' : 'not-allowed', padding: '5px', display: 'flex', borderRadius: '6px', opacity: isOnline ? 1 : 0.35, transition: 'color 0.15s' }}
                        title={isOnline ? 'Edit task' : 'Offline'}>
                        <Edit2 size={13} />
                    </button>
                    {/* Delete — red tint so it's clearly destructive */}
                    <button onClick={onDelete} disabled={!isOnline}
                        style={{ background: 'none', border: 'none', color: isOnline ? '#ef4444' : t.textMuted, cursor: isOnline ? 'pointer' : 'not-allowed', padding: '5px', display: 'flex', borderRadius: '6px', opacity: isOnline ? 1 : 0.35, transition: 'opacity 0.15s' }}
                        title={isOnline ? 'Delete task' : 'Offline'}>
                        <Trash2 size={13} />
                    </button>
                </div>
            </div>

            {task.description && <p style={{ fontSize: '12px', color: t.textMuted, margin: '5px 0 0', lineHeight: '1.45' }}>{task.description}</p>}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '18px', fontSize: '10px', fontWeight: '600', textTransform: 'capitalize', background: `${statusColor[task.status]}22`, color: statusColor[task.status] }}>
                        {task.status.replace('_', ' ')}
                    </span>
                    <span style={{ padding: '2px 8px', borderRadius: '18px', fontSize: '10px', fontWeight: '600', textTransform: 'capitalize', background: `${priorityColor[task.priority]}22`, color: priorityColor[task.priority] }}>
                        {task.priority}
                    </span>
                </div>
                <select value={task.status} onChange={e => onStatusChange(task.id, e.target.value)} disabled={isUpdating || !isOnline}
                    style={{ padding: '4px 8px', background: t.selectBg, border: `1px solid ${t.borderMid}`, borderRadius: '6px', color: t.selectText, fontSize: '11px', cursor: isUpdating || !isOnline ? 'not-allowed' : 'pointer', outline: 'none', opacity: isUpdating || !isOnline ? 0.5 : 1 }}>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="blocked">Blocked</option>
                </select>
            </div>

            <div style={{ marginTop: '8px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {task.assignee_name && <span style={{ fontSize: '11px', color: t.textMuted }}>👤 {task.assignee_name}</span>}
                {task.deadline && (
                    <span style={{ fontSize: '11px', color: isOverdue ? t.overdueText : t.textMuted, fontWeight: isOverdue ? '600' : '400' }}>
                        {isOverdue ? '⚠️ Overdue: ' : '📅 Due: '}{new Date(task.deadline).toLocaleDateString()}
                    </span>
                )}
            </div>
        </div>
    );
};

// ─── TaskModal ────────────────────────────────────────────────────────────────
const TaskModal = ({ t, title, initialData, onClose, onSave, isOnline }) => {
    const [formTitle, setFormTitle] = useState(initialData?.title || '');
    const [description, setDescription] = useState(initialData?.description || '');
    const [priority, setPriority] = useState(initialData?.priority || 'medium');
    const [deadline, setDeadline] = useState(initialData?.deadline ? new Date(initialData.deadline).toISOString().split('T')[0] : '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isOnline) { setError('You must be online to save changes'); return; }
        setLoading(true); setError('');
        const err = await onSave({ title: formTitle, description, priority, deadline: deadline || null });
        if (err) setError(err);
        setLoading(false);
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: t.overlayBg, backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
            <div style={{ background: t.modalBg, border: `1px solid ${t.border}`, borderRadius: '16px', padding: '26px', width: '90%', maxWidth: '500px', boxShadow: '0 25px 60px rgba(0,0,0,0.4)' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ fontSize: '17px', fontWeight: '700', color: t.textPrimary, margin: 0 }}>{title}</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', display: 'flex', padding: '4px' }}><X size={17} /></button>
                </div>
                {!isOnline && <div style={{ marginBottom: '14px' }}><StatusAlert t={t} type="offline"><WifiOff size={13} /> You're offline. Reconnect to save.</StatusAlert></div>}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <TextInput t={t} label="Title *" type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Enter task title" required />
                    <div>
                        <FieldLabel t={t}>Description</FieldLabel>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the task…" style={{ width: '100%', minHeight: '80px', padding: '9px 12px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '9px', fontSize: '13px', color: t.textPrimary, resize: 'vertical', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <FieldLabel t={t}>Priority</FieldLabel>
                            <select value={priority} onChange={e => setPriority(e.target.value)} style={{ width: '100%', padding: '9px 12px', background: t.selectBg, border: `1px solid ${t.border}`, borderRadius: '9px', fontSize: '13px', color: t.selectText, boxSizing: 'border-box', cursor: 'pointer' }}>
                                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
                            </select>
                        </div>
                        <TextInput t={t} label="Deadline" type="date" value={deadline} onChange={e => setDeadline(e.target.value)} style={{ background: t.selectBg, color: t.selectText }} />
                    </div>
                    {error && <StatusAlert t={t} type="error">⚠️ {error}</StatusAlert>}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
                        <button type="button" onClick={onClose} style={{ padding: '9px 18px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '9px', color: t.textSecondary, fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                        <button type="submit" disabled={loading || !isOnline} style={{ padding: '9px 20px', background: (loading || !isOnline) ? t.inputBg : 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: '9px', color: (loading || !isOnline) ? t.textMuted : '#fff', fontSize: '13px', fontWeight: '600', cursor: (loading || !isOnline) ? 'not-allowed' : 'pointer', opacity: (loading || !isOnline) ? 0.6 : 1, boxShadow: (loading || !isOnline) ? 'none' : '0 3px 12px rgba(99,102,241,0.35)' }}>
                            {loading ? '⏳ Saving…' : initialData ? '✅ Save Changes' : '✅ Create Task'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Dashboard;