// web/src/components/dashboard/Dashboard.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { taskAPI, userAPI } from '../../services/api';
import wsService from '../../services/websocket';
import CompanyOnboarding from '../company/CompanyOnboarding';
import TeamManagement    from '../company/TeamManagement';
import ProgressMonitor   from '../company/ProgressMonitor';
import ReportManagement  from '../company/ReportManagement';
import {
    Plus, Search, CheckCircle2, Clock, AlertCircle, Flag, Zap, LogOut,
    Activity, ListTodo, Sun, Moon, Trash2, Bell, X, Edit2, WifiOff, Wifi,
    User, Camera, Shield, Smartphone, Save, Eye, EyeOff,
    AlertTriangle, Building2, Users, TrendingUp, FileText, LayoutDashboard,
    ChevronLeft, Lock, ArrowRight, Sparkles, Menu, ChevronDown
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const API_ORIGIN = 'http://localhost:3001';

const resolveAvatar = (avatar) => {
    if (!avatar) return null;
    if (avatar.startsWith('http') || avatar.startsWith('data:')) return avatar;
    return `${API_ORIGIN}${avatar}`;
};

const getDeviceInfo = () => {
    const ua = navigator.userAgent;
    let browser = 'Unknown', os = 'Unknown';
    if (/Chrome/.test(ua) && !/Edg/.test(ua)) browser = 'Chrome';
    else if (/Firefox/.test(ua)) browser = 'Firefox';
    else if (/Safari/.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
    else if (/Edg/.test(ua)) browser = 'Edge';
    if (/Windows/.test(ua)) os = 'Windows';
    else if (/Mac/.test(ua)) os = 'macOS';
    else if (/Linux/.test(ua)) os = 'Linux';
    else if (/Android/.test(ua)) os = 'Android';
    else if (/iPhone|iPad/.test(ua)) os = 'iOS';
    return `${browser} on ${os}`;
};

// ─── Theme System ─────────────────────────────────────────────────────────────

const PERSONAL = {
    // base
    bg:              '#05080f',
    surface:         '#0a0f1e',
    surfaceRaised:   '#0f1628',
    card:            'rgba(255,255,255,0.025)',
    cardHover:       'rgba(255,255,255,0.045)',
    border:          'rgba(255,255,255,0.06)',
    borderMid:       'rgba(255,255,255,0.1)',
    borderStrong:    'rgba(255,255,255,0.16)',
    // text
    textPrimary:     '#f0f4ff',
    text:            '#94a3b8',
    textMuted:       '#3d4f6e',
    // accent — electric violet
    accent:          '#7c3aed',
    accentLight:     '#a78bfa',
    accentBg:        'rgba(124,58,237,0.1)',
    accentBorder:    'rgba(124,58,237,0.25)',
    accentGrad:      'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
    headerGrad:      'linear-gradient(135deg, #7c3aed, #a78bfa)',
    // semantic
    success:         '#10b981', successBg: 'rgba(16,185,129,0.1)', successBorder: 'rgba(16,185,129,0.2)',
    warning:         '#f59e0b', warningBg: 'rgba(245,158,11,0.1)', warningBorder: 'rgba(245,158,11,0.2)',
    danger:          '#ef4444', dangerBg:  'rgba(239,68,68,0.1)',  dangerBorder:  'rgba(239,68,68,0.22)',
    info:            '#3b82f6', infoBg:    'rgba(59,130,246,0.1)', infoBorder:    'rgba(59,130,246,0.2)',
    // ui elements
    inputBg:         'rgba(255,255,255,0.04)',
    selectBg:        '#0f1628',
    modalBg:         '#080d1a',
    overlay:         'rgba(0,0,0,0.8)',
    sidebarBg:       '#080d1a',
    sidebarBorder:   'rgba(255,255,255,0.05)',
    sidebarActive:   'rgba(124,58,237,0.14)',
    sidebarActiveBorder: 'rgba(124,58,237,0.4)',
    // status badges
    online:          '#10b981', onlineBg: 'rgba(16,185,129,0.12)',
    offline:         '#ef4444', offlineBg: 'rgba(239,68,68,0.12)',
    // mode label
    modeLabel:       'Personal',
    modeIcon:        '👤',
};

const COMPANY = {
    ...PERSONAL,
    accent:          '#0ea5e9',
    accentLight:     '#38bdf8',
    accentBg:        'rgba(14,165,233,0.1)',
    accentBorder:    'rgba(14,165,233,0.25)',
    accentGrad:      'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
    headerGrad:      'linear-gradient(135deg, #0ea5e9, #38bdf8)',
    sidebarActive:   'rgba(14,165,233,0.12)',
    sidebarActiveBorder: 'rgba(14,165,233,0.4)',
    modeLabel:       'Company',
    modeIcon:        '🏢',
};

const LIGHT_PERSONAL = {
    bg:              '#f5f3ff',
    surface:         '#ffffff',
    surfaceRaised:   '#faf9ff',
    card:            'rgba(0,0,0,0.02)',
    cardHover:       'rgba(0,0,0,0.04)',
    border:          'rgba(0,0,0,0.07)',
    borderMid:       'rgba(0,0,0,0.12)',
    borderStrong:    'rgba(0,0,0,0.2)',
    textPrimary:     '#0f0a1e',
    text:            '#4c5577',
    textMuted:       '#9fa6c0',
    accent:          '#7c3aed',
    accentLight:     '#6d28d9',
    accentBg:        'rgba(124,58,237,0.06)',
    accentBorder:    'rgba(124,58,237,0.18)',
    accentGrad:      'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
    headerGrad:      'linear-gradient(135deg, #7c3aed, #a78bfa)',
    success:         '#059669', successBg: 'rgba(5,150,105,0.07)',  successBorder: 'rgba(5,150,105,0.2)',
    warning:         '#d97706', warningBg: 'rgba(217,119,6,0.07)',  warningBorder: 'rgba(217,119,6,0.2)',
    danger:          '#dc2626', dangerBg:  'rgba(220,38,38,0.06)',  dangerBorder:  'rgba(220,38,38,0.18)',
    info:            '#2563eb', infoBg:    'rgba(37,99,235,0.07)',  infoBorder:    'rgba(37,99,235,0.2)',
    inputBg:         'rgba(0,0,0,0.03)',
    selectBg:        '#f5f3ff',
    modalBg:         '#ffffff',
    overlay:         'rgba(0,0,0,0.5)',
    sidebarBg:       '#ffffff',
    sidebarBorder:   'rgba(0,0,0,0.06)',
    sidebarActive:   'rgba(124,58,237,0.07)',
    sidebarActiveBorder: 'rgba(124,58,237,0.3)',
    online:          '#059669', onlineBg: 'rgba(5,150,105,0.09)',
    offline:         '#dc2626', offlineBg: 'rgba(220,38,38,0.09)',
    modeLabel:       'Personal',
    modeIcon:        '👤',
};

const LIGHT_COMPANY = {
    ...LIGHT_PERSONAL,
    bg:              '#f0f9ff',
    accentGrad:      'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
    headerGrad:      'linear-gradient(135deg, #0ea5e9, #38bdf8)',
    accent:          '#0ea5e9',
    accentLight:     '#0284c7',
    accentBg:        'rgba(14,165,233,0.06)',
    accentBorder:    'rgba(14,165,233,0.18)',
    sidebarActive:   'rgba(14,165,233,0.07)',
    sidebarActiveBorder: 'rgba(14,165,233,0.3)',
    modeLabel:       'Company',
    modeIcon:        '🏢',
};

// ─── Status/Priority Maps ─────────────────────────────────────────────────────
const STATUS_COLOR  = { pending: '#f59e0b', in_progress: '#3b82f6', completed: '#10b981', blocked: '#ef4444' };
const PRIORITY_COLOR = { low: '#64748b', medium: '#f59e0b', high: '#ef4444', urgent: '#dc2626' };
const STATUS_LABEL  = { pending: 'Pending', in_progress: 'In Progress', completed: 'Completed', blocked: 'Blocked' };

// ─── Shared Primitives ────────────────────────────────────────────────────────
const Pill = ({ color, children }) => (
    <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: '700', letterSpacing: '0.03em', background: `${color}20`, color, display: 'inline-block' }}>{children}</span>
);

const Btn = ({ t, children, variant = 'primary', size = 'md', disabled, onClick, style: sx = {}, ...rest }) => {
    const sizes = { sm: '6px 12px', md: '9px 18px', lg: '12px 24px' };
    const isPrimary = variant === 'primary';
    const isDanger  = variant === 'danger';
    const isGhost   = variant === 'ghost';
    return (
        <button onClick={onClick} disabled={disabled} {...rest} style={{
            padding: sizes[size],
            background: isPrimary ? t.accentGrad : isDanger ? t.dangerBg : isGhost ? 'transparent' : t.inputBg,
            border: `1px solid ${isPrimary ? 'transparent' : isDanger ? t.dangerBorder : t.border}`,
            borderRadius: '8px',
            color: isPrimary ? '#fff' : isDanger ? t.danger : t.text,
            fontSize: size === 'sm' ? '11px' : '13px',
            fontWeight: '600',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            transition: 'all 0.15s',
            boxShadow: isPrimary && !disabled ? `0 4px 14px ${t.accent}40` : 'none',
            fontFamily: 'inherit',
            ...sx,
        }}>{children}</button>
    );
};

const Input = ({ t, label, ...props }) => (
    <div>
        {label && <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: t.textMuted, marginBottom: '5px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</label>}
        <input {...props} style={{ width: '100%', padding: '10px 12px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '8px', fontSize: '13px', color: t.textPrimary, boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none', transition: 'border-color 0.15s', ...(props.style || {}) }} />
    </div>
);

const Alert = ({ t, type, children }) => {
    const map = { error: [t.dangerBg, t.dangerBorder, t.danger], success: [t.successBg, t.successBorder, t.success], warning: [t.warningBg, t.warningBorder, t.warning], info: [t.infoBg, t.infoBorder, t.info] };
    const [bg, border, color] = map[type] || map.info;
    return <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 13px', background: bg, border: `1px solid ${border}`, borderRadius: '8px', fontSize: '12px', color, lineHeight: 1.5 }}>{children}</div>;
};

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ t, icon, value, label, color, trend }) => (
    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '14px', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: '80px', height: '80px', borderRadius: '50%', background: `radial-gradient(circle at 70% 30%, ${color}18, transparent 70%)`, pointerEvents: 'none' }} />
        <div style={{ width: '42px', height: '42px', borderRadius: '11px', background: `${color}15`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
        <div>
            <div style={{ fontSize: '26px', fontWeight: '800', color: t.textPrimary, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
            <div style={{ fontSize: '11px', color: t.textMuted, marginTop: '3px', fontWeight: '500' }}>{label}</div>
        </div>
    </div>
);

// ─── Task Card ────────────────────────────────────────────────────────────────
const TaskCard = ({ t, task, onStatusChange, onDelete, onEdit, updatingStatus, isOnline }) => {
    const isOverdue = task.deadline && task.status !== 'completed' && new Date(task.deadline) < new Date();
    const isUpdating = updatingStatus === task.id;

    return (
        <div style={{ background: isOverdue ? t.dangerBg : t.card, border: `1px solid ${isOverdue ? t.dangerBorder : t.border}`, borderRadius: '12px', padding: '14px 16px', transition: 'all 0.15s', cursor: 'default' }}
            onMouseEnter={e => { if (!isOverdue) e.currentTarget.style.background = t.cardHover; e.currentTarget.style.borderColor = t.borderMid; }}
            onMouseLeave={e => { if (!isOverdue) e.currentTarget.style.background = t.card; e.currentTarget.style.borderColor = isOverdue ? t.dangerBorder : t.border; }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        {!!task.flagged && <Flag size={11} color={t.danger} fill={t.danger} />}
                        <h3 style={{ fontSize: '13px', fontWeight: '600', color: t.textPrimary, margin: 0, lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.title}</h3>
                    </div>
                    {task.description && (
                        <p style={{ fontSize: '11px', color: t.textMuted, margin: '0 0 8px', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{task.description}</p>
                    )}
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <Pill color={STATUS_COLOR[task.status]}>{STATUS_LABEL[task.status]}</Pill>
                        <Pill color={PRIORITY_COLOR[task.priority]}>{task.priority}</Pill>
                        {task.assignee_name && <span style={{ fontSize: '10px', color: t.textMuted }}>· {task.assignee_name}</span>}
                        {task.deadline && (
                            <span style={{ fontSize: '10px', color: isOverdue ? t.danger : t.textMuted, fontWeight: isOverdue ? '700' : '400' }}>
                                {isOverdue ? '⚠ Overdue · ' : '· '}{new Date(task.deadline).toLocaleDateString()}
                            </span>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                    <select value={task.status} onChange={e => onStatusChange(task.id, e.target.value)} disabled={isUpdating || !isOnline}
                        style={{ padding: '4px 6px', background: t.selectBg, border: `1px solid ${t.border}`, borderRadius: '6px', color: t.text, fontSize: '10px', cursor: 'pointer', fontFamily: 'inherit', outline: 'none', marginRight: '4px' }}>
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="blocked">Blocked</option>
                    </select>
                    <button onClick={onEdit} disabled={!isOnline} title="Edit"
                        style={{ background: 'none', border: 'none', color: t.textMuted, cursor: isOnline ? 'pointer' : 'not-allowed', padding: '5px', display: 'flex', borderRadius: '6px', transition: 'all 0.1s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = t.accentBg; e.currentTarget.style.color = t.accentLight; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = t.textMuted; }}>
                        <Edit2 size={13} />
                    </button>
                    <button onClick={onDelete} disabled={!isOnline} title="Delete"
                        style={{ background: 'none', border: 'none', color: t.textMuted, cursor: isOnline ? 'pointer' : 'not-allowed', padding: '5px', display: 'flex', borderRadius: '6px', transition: 'all 0.1s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = t.dangerBg; e.currentTarget.style.color = t.danger; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = t.textMuted; }}>
                        <Trash2 size={13} />
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Task Modal ───────────────────────────────────────────────────────────────
const TaskModal = ({ t, title, initialData, onClose, onSave, isOnline }) => {
    const [formTitle, setFormTitle] = useState(initialData?.title || '');
    const [description, setDescription] = useState(initialData?.description || '');
    const [priority, setPriority] = useState(initialData?.priority || 'medium');
    const [deadline, setDeadline] = useState(initialData?.deadline ? new Date(initialData.deadline).toISOString().split('T')[0] : '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formTitle.trim()) { setError('Title is required'); return; }
        setLoading(true); setError('');
        const err = await onSave({ title: formTitle.trim(), description, priority, deadline: deadline || null });
        if (err) { setError(err); setLoading(false); }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: t.overlay, backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }} onClick={onClose}>
            <div style={{ background: t.modalBg, border: `1px solid ${t.borderMid}`, borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '480px', boxShadow: '0 40px 80px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '17px', fontWeight: '700', color: t.textPrimary, margin: 0 }}>{title}</h2>
                    <button onClick={onClose} style={{ background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '8px', color: t.textMuted, cursor: 'pointer', padding: '7px', display: 'flex' }}><X size={15} /></button>
                </div>

                {!isOnline && <div style={{ marginBottom: '16px' }}><Alert t={t} type="warning"><WifiOff size={13} /> You're offline — reconnect to save.</Alert></div>}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <Input t={t} label="Title" type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Enter task title" required />
                    <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: t.textMuted, marginBottom: '5px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Description</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What needs to be done?"
                            style={{ width: '100%', minHeight: '80px', padding: '10px 12px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '8px', fontSize: '13px', color: t.textPrimary, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: t.textMuted, marginBottom: '5px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Priority</label>
                            <select value={priority} onChange={e => setPriority(e.target.value)}
                                style={{ width: '100%', padding: '10px 12px', background: t.selectBg, border: `1px solid ${t.border}`, borderRadius: '8px', fontSize: '13px', color: t.textPrimary, fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}>
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                                <option value="urgent">Urgent</option>
                            </select>
                        </div>
                        <Input t={t} label="Deadline" type="date" value={deadline} onChange={e => setDeadline(e.target.value)} style={{ background: t.selectBg, color: t.textPrimary }} />
                    </div>
                    {error && <Alert t={t} type="error"><AlertCircle size={13} /> {error}</Alert>}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '4px' }}>
                        <Btn t={t} variant="ghost" onClick={onClose} type="button">Cancel</Btn>
                        <Btn t={t} variant="primary" disabled={loading || !isOnline} type="submit">
                            {loading ? 'Saving…' : initialData ? 'Save Changes' : 'Create Task'}
                        </Btn>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
const DeleteModal = ({ t, task, onConfirm, onCancel, loading }) => (
    <div style={{ position: 'fixed', inset: 0, background: t.overlay, backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '16px' }} onClick={() => !loading && onCancel()}>
        <div style={{ background: t.modalBg, border: `1px solid ${t.dangerBorder}`, borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '400px', boxShadow: '0 40px 80px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                <div style={{ width: '46px', height: '46px', borderRadius: '13px', background: t.dangerBg, border: `1px solid ${t.dangerBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Trash2 size={20} color={t.danger} />
                </div>
                <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: t.textPrimary }}>Delete Task</h3>
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: t.textMuted }}>This cannot be undone</p>
                </div>
            </div>
            <p style={{ fontSize: '13px', color: t.text, margin: '0 0 22px', lineHeight: 1.6 }}>
                Are you sure you want to permanently delete <strong style={{ color: t.textPrimary }}>"{task.title}"</strong>?
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <Btn t={t} variant="ghost" onClick={onCancel} disabled={loading}>Cancel</Btn>
                <Btn t={t} variant="danger" onClick={onConfirm} disabled={loading} style={{ background: t.danger, color: '#fff', border: 'none', boxShadow: `0 4px 14px ${t.danger}40` }}>
                    <Trash2 size={13} />{loading ? 'Deleting…' : 'Delete'}
                </Btn>
            </div>
        </div>
    </div>
);

// ─── Profile Modal ────────────────────────────────────────────────────────────
const ProfileModal = ({ t, user, onClose, onSave, onDeleteAccount, isOnline }) => {
    const [tab, setTab] = useState('profile');
    const [fullName, setFullName] = useState(user?.fullName || '');
    const [avatarPreview, setAvatarPreview] = useState(resolveAvatar(user?.avatar || user?.avatar_url));
    const [avatarFile, setAvatarFile] = useState(null);
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
    const pwColors = ['', '#ef4444', '#f59e0b', '#3b82f6', '#10b981'];

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
        const avatarPayload = avatarFile ? avatarFile : avatarPreview === null ? null : undefined;
        const err = await onSave({ fullName, avatar: avatarPayload }, 'profile', device);
        setLoading(false);
        setStatus(err ? { type: 'error', msg: err } : { type: 'success', msg: 'Profile updated!' });
    };

    const savePassword = async () => {
        if (!isOnline) { setStatus({ type: 'error', msg: 'You are offline.' }); return; }
        if (newPw !== confirmPw) { setStatus({ type: 'error', msg: 'Passwords do not match.' }); return; }
        if (newPw.length < 8) { setStatus({ type: 'error', msg: 'Password must be at least 8 characters.' }); return; }
        setLoading(true); setStatus(null);
        const err = await onSave({ currentPassword: currentPw, newPassword: newPw }, 'password', device);
        setLoading(false);
        if (err) setStatus({ type: 'error', msg: err });
        else { setStatus({ type: 'success', msg: 'Password updated!' }); setCurrentPw(''); setNewPw(''); setConfirmPw(''); }
    };

    const doDelete = async () => {
        if (deleteConfirm !== 'DELETE') { setStatus({ type: 'error', msg: 'Type DELETE to confirm.' }); return; }
        setLoading(true);
        await onDeleteAccount(device);
    };

    const TABS = [
        { id: 'profile',  icon: <User size={13} />,          label: 'Profile'   },
        { id: 'security', icon: <Shield size={13} />,        label: 'Security'  },
        { id: 'danger',   icon: <AlertTriangle size={13} />, label: 'Danger Zone' },
    ];

    return (
        <div style={{ position: 'fixed', inset: 0, background: t.overlay, backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1500, padding: '16px' }} onClick={onClose}>
            <div style={{ background: t.modalBg, border: `1px solid ${t.borderMid}`, borderRadius: '22px', width: '100%', maxWidth: '520px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 50px 100px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{ padding: '22px 24px 0', borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: t.textPrimary }}>Account Settings</h2>
                            <p style={{ margin: '3px 0 0', fontSize: '11px', color: t.textMuted, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Smartphone size={10} /> {device}
                            </p>
                        </div>
                        <button onClick={onClose} style={{ background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '8px', color: t.textMuted, cursor: 'pointer', padding: '7px', display: 'flex' }}><X size={15} /></button>
                    </div>
                    <div style={{ display: 'flex', gap: '0' }}>
                        {TABS.map(tb => (
                            <button key={tb.id} onClick={() => { setTab(tb.id); setStatus(null); }}
                                style={{ padding: '9px 16px', background: 'none', border: 'none', borderBottom: `2px solid ${tab === tb.id ? t.accent : 'transparent'}`, color: tab === tb.id ? t.accent : t.textMuted, fontSize: '12px', fontWeight: tab === tb.id ? '700' : '400', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                                {tb.icon}{tb.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Body */}
                <div style={{ padding: '22px 24px', overflowY: 'auto', flex: 1 }}>
                    {status && <div style={{ marginBottom: '16px' }}><Alert t={t} type={status.type}>{status.type === 'success' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />} {status.msg}</Alert></div>}

                    {tab === 'profile' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                            {/* Avatar */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '18px', padding: '18px', background: t.accentBg, border: `1px solid ${t.accentBorder}`, borderRadius: '14px' }}>
                                <div style={{ position: 'relative', flexShrink: 0 }}>
                                    <div style={{ width: '72px', height: '72px', borderRadius: '50%', overflow: 'hidden', border: `3px solid ${t.accentBorder}` }}>
                                        {avatarPreview
                                            ? <img src={avatarPreview} alt="av" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            : <div style={{ width: '100%', height: '100%', background: t.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', fontWeight: '800', color: '#fff' }}>
                                                {(user?.fullName || user?.email || '?').charAt(0).toUpperCase()}
                                              </div>}
                                    </div>
                                    <button onClick={() => fileRef.current.click()} style={{ position: 'absolute', bottom: 0, right: 0, width: '22px', height: '22px', borderRadius: '50%', background: t.accent, border: `2px solid ${t.modalBg}`, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Camera size={10} />
                                    </button>
                                    <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <p style={{ margin: '0 0 3px', fontSize: '13px', fontWeight: '600', color: t.textPrimary }}>Profile Photo</p>
                                    <p style={{ margin: '0 0 10px', fontSize: '11px', color: t.textMuted }}>JPG, PNG · Max 3 MB</p>
                                    <div style={{ display: 'flex', gap: '7px' }}>
                                        <Btn t={t} variant="ghost" size="sm" onClick={() => fileRef.current.click()} style={{ border: `1px solid ${t.accentBorder}`, color: t.accentLight }}>Upload</Btn>
                                        {avatarPreview && <Btn t={t} variant="danger" size="sm" onClick={() => { setAvatarPreview(null); setAvatarFile(null); }}>Remove</Btn>}
                                    </div>
                                </div>
                            </div>

                            <Input t={t} label="Full Name" type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" />
                            <div>
                                <Input t={t} label="Email" type="email" value={user?.email || ''} readOnly style={{ opacity: 0.5, cursor: 'not-allowed' }} />
                                <p style={{ margin: '5px 0 0', fontSize: '10px', color: t.textMuted }}>Email can only be changed via support.</p>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <Btn t={t} variant="primary" onClick={saveProfile} disabled={loading || !isOnline}>
                                    <Save size={13} />{loading ? 'Saving…' : 'Save Changes'}
                                </Btn>
                            </div>
                        </div>
                    )}

                    {tab === 'security' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <Alert t={t} type="info"><Shield size={13} /> Changing your password will notify all signed-in devices.</Alert>
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: t.textMuted, marginBottom: '5px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Current Password</label>
                                <div style={{ position: 'relative' }}>
                                    <input type={showCurrent ? 'text' : 'password'} value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="Current password"
                                        style={{ width: '100%', padding: '10px 40px 10px 12px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '8px', fontSize: '13px', color: t.textPrimary, boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }} />
                                    <button type="button" onClick={() => setShowCurrent(!showCurrent)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', display: 'flex' }}>
                                        {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: t.textMuted, marginBottom: '5px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>New Password</label>
                                <div style={{ position: 'relative' }}>
                                    <input type={showNew ? 'text' : 'password'} value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Min. 8 characters"
                                        style={{ width: '100%', padding: '10px 40px 10px 12px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '8px', fontSize: '13px', color: t.textPrimary, boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }} />
                                    <button type="button" onClick={() => setShowNew(!showNew)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', display: 'flex' }}>
                                        {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                                {newPw && (
                                    <div style={{ marginTop: '8px' }}>
                                        <div style={{ display: 'flex', gap: '3px', marginBottom: '4px' }}>
                                            {[1,2,3,4].map(i => <div key={i} style={{ flex: 1, height: '3px', borderRadius: '2px', background: i <= pwStrength ? pwColors[pwStrength] : t.border, transition: 'background 0.2s' }} />)}
                                        </div>
                                        <span style={{ fontSize: '10px', color: pwColors[pwStrength], fontWeight: '600' }}>{['','Too weak','Weak','Good','Strong'][pwStrength]}</span>
                                    </div>
                                )}
                            </div>
                            <Input t={t} label="Confirm New Password" type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Re-enter new password" />
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <Btn t={t} variant="primary" onClick={savePassword} disabled={loading || !isOnline || !currentPw || !newPw || !confirmPw}>
                                    <Shield size={13} />{loading ? 'Updating…' : 'Update Password'}
                                </Btn>
                            </div>
                        </div>
                    )}

                    {tab === 'danger' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <Alert t={t} type="error"><AlertTriangle size={13} /> Account deletion is permanent and cannot be reversed.</Alert>
                            {deleteStep === 1 ? (
                                <div style={{ padding: '20px', background: t.dangerBg, border: `1px solid ${t.dangerBorder}`, borderRadius: '14px' }}>
                                    <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: '700', color: t.danger }}>Delete My Account</h4>
                                    <p style={{ margin: '0 0 16px', fontSize: '13px', color: t.text, lineHeight: 1.6 }}>All your tasks, profile, and account data will be permanently erased.</p>
                                    <Btn t={t} variant="danger" onClick={() => setDeleteStep(2)} style={{ background: t.danger, color: '#fff', border: 'none', boxShadow: `0 4px 12px ${t.danger}40` }}>
                                        <Trash2 size={13} /> I understand, proceed
                                    </Btn>
                                </div>
                            ) : (
                                <div style={{ padding: '20px', background: t.dangerBg, border: `1px solid ${t.dangerBorder}`, borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                    <p style={{ margin: 0, fontSize: '13px', color: t.text }}>Type <strong style={{ color: t.danger, fontFamily: 'monospace' }}>DELETE</strong> to confirm:</p>
                                    <input type="text" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="Type DELETE here"
                                        style={{ width: '100%', padding: '10px 12px', background: t.inputBg, border: `2px solid ${deleteConfirm === 'DELETE' ? t.danger : t.dangerBorder}`, borderRadius: '8px', fontSize: '14px', color: t.textPrimary, boxSizing: 'border-box', fontFamily: 'monospace', outline: 'none' }} />
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <Btn t={t} variant="ghost" onClick={() => { setDeleteStep(1); setDeleteConfirm(''); }} style={{ flex: 1, justifyContent: 'center' }}>Cancel</Btn>
                                        <Btn t={t} disabled={deleteConfirm !== 'DELETE' || loading} onClick={doDelete}
                                            style={{ flex: 1, justifyContent: 'center', background: deleteConfirm === 'DELETE' ? t.danger : t.inputBg, color: deleteConfirm === 'DELETE' ? '#fff' : t.textMuted, border: 'none', boxShadow: deleteConfirm === 'DELETE' ? `0 4px 12px ${t.danger}40` : 'none' }}>
                                            {loading ? 'Deleting…' : 'Delete Forever'}
                                        </Btn>
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

// ─── Sidebar ──────────────────────────────────────────────────────────────────
const Sidebar = ({ t, currentView, onNavigate, collapsed, onToggle, isCompany }) => {
    const personalNav = [
        { id: 'dashboard', icon: <LayoutDashboard size={16} />, label: 'Dashboard' },
        { id: 'company-setup', icon: <Building2 size={16} />, label: 'Upgrade to Team' },
    ];

    const companyNav = [
        { id: 'dashboard',     icon: <LayoutDashboard size={16} />, label: 'Dashboard'   },
        { id: 'company-setup', icon: <Building2 size={16} />,       label: 'Company'     },
        { id: 'team',          icon: <Users size={16} />,           label: 'Team'        },
        { id: 'progress',      icon: <TrendingUp size={16} />,      label: 'Progress'    },
        { id: 'reports',       icon: <FileText size={16} />,        label: 'Reports'     },
    ];

    const nav = isCompany ? companyNav : personalNav;
    const lockedForPersonal = ['team', 'progress', 'reports'];

    return (
        <aside style={{ width: collapsed ? '60px' : '210px', background: t.sidebarBg, borderRight: `1px solid ${t.sidebarBorder}`, height: 'calc(100vh - 58px)', position: 'sticky', top: '58px', transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>

            {/* Mode tag */}
            {!collapsed && (
                <div style={{ padding: '12px 12px 6px' }}>
                    <div style={{ padding: '6px 10px', background: t.accentBg, border: `1px solid ${t.accentBorder}`, borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <span style={{ fontSize: '13px' }}>{t.modeIcon}</span>
                        <span style={{ fontSize: '10px', fontWeight: '700', color: t.accentLight, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{t.modeLabel} Mode</span>
                    </div>
                </div>
            )}

            <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', padding: collapsed ? '12px 8px' : '8px 8px' }}>
                {nav.map(item => {
                    const active = currentView === item.id;
                    return (
                        <button key={item.id} onClick={() => onNavigate(item.id)}
                            style={{ padding: collapsed ? '10px' : '9px 10px', background: active ? t.sidebarActive : 'transparent', border: `1px solid ${active ? t.sidebarActiveBorder : 'transparent'}`, borderRadius: '9px', color: active ? t.accentLight : t.textMuted, fontSize: '12px', fontWeight: active ? '700' : '400', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '9px', justifyContent: collapsed ? 'center' : 'flex-start', width: '100%', transition: 'all 0.13s', textAlign: 'left', whiteSpace: 'nowrap', fontFamily: 'inherit' }}
                            onMouseEnter={e => { if (!active) { e.currentTarget.style.background = t.sidebarActive + '88'; e.currentTarget.style.color = t.text; } }}
                            onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = t.textMuted; } }}>
                            <span style={{ flexShrink: 0 }}>{item.icon}</span>
                            {!collapsed && <span>{item.label}</span>}
                        </button>
                    );
                })}

                {/* Locked nav for personal */}
                {!isCompany && !collapsed && (
                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${t.border}` }}>
                        <p style={{ margin: '0 0 6px', fontSize: '9px', fontWeight: '700', color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', padding: '0 4px' }}>Team Features</p>
                        {lockedForPersonal.map((id, i) => {
                            const labels = ['Team', 'Progress', 'Reports'];
                            const icons = [<Users size={16} />, <TrendingUp size={16} />, <FileText size={16} />];
                            return (
                                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '9px 10px', borderRadius: '9px', opacity: 0.3, cursor: 'not-allowed', color: t.textMuted }}>
                                    {icons[i]}<span style={{ fontSize: '12px', flex: 1 }}>{labels[i]}</span>
                                    <Lock size={10} />
                                </div>
                            );
                        })}
                    </div>
                )}
            </nav>

            <div style={{ padding: '8px', borderTop: `1px solid ${t.border}` }}>
                <button onClick={onToggle}
                    style={{ width: '100%', padding: '8px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '8px', color: t.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', fontFamily: 'inherit', transition: 'all 0.13s' }}>
                    {collapsed ? <Menu size={15} /> : <><ChevronLeft size={14} /><span style={{ fontSize: '11px', fontWeight: '500' }}>Collapse</span></>}
                </button>
            </div>
        </aside>
    );
};

// ─── Personal Dashboard ───────────────────────────────────────────────────────
const PersonalDashboard = ({ t, user, tasks, isOnline, wsConnected, recentActivity, filteredTasks, filter, setFilter, searchQuery, setSearchQuery, setShowCreateModal, updateTaskStatus, setDeleteTarget, setEditTask, updatingStatus }) => {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const completed = tasks.filter(tk => tk.status === 'completed').length;
    const rate = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

    return (
        <div style={{ padding: '20px 24px 40px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Hero greeting */}
            <div style={{ padding: '24px 28px', background: `linear-gradient(135deg, ${t.accentBg}, transparent)`, border: `1px solid ${t.accentBorder}`, borderRadius: '18px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: '-50px', right: '-30px', width: '180px', height: '180px', borderRadius: '50%', background: `radial-gradient(circle, ${t.accent}20, transparent 70%)`, pointerEvents: 'none' }} />
                <p style={{ margin: '0 0 2px', fontSize: '12px', color: t.accentLight, fontWeight: '600' }}>{greeting},</p>
                <h2 style={{ margin: '0 0 16px', fontSize: '24px', fontWeight: '800', color: t.textPrimary, letterSpacing: '-0.4px' }}>
                    {user?.fullName || user?.email?.split('@')[0]} 👋
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '180px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span style={{ fontSize: '11px', color: t.textMuted, fontWeight: '500' }}>Today's completion</span>
                            <span style={{ fontSize: '11px', fontWeight: '800', color: rate >= 70 ? t.success : rate >= 40 ? t.warning : t.accentLight }}>{rate}%</span>
                        </div>
                        <div style={{ height: '5px', background: t.border, borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${rate}%`, background: rate >= 70 ? `linear-gradient(90deg, ${t.success}, #34d399)` : t.accentGrad, borderRadius: '3px', transition: 'width 0.6s ease' }} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {[
                            { v: tasks.length, label: 'Total', color: t.accent },
                            { v: completed, label: 'Done', color: t.success },
                            { v: tasks.filter(tk => tk.deadline && new Date(tk.deadline) < new Date() && tk.status !== 'completed').length, label: 'Overdue', color: t.danger },
                        ].map((s, i) => (
                            <div key={i} style={{ textAlign: 'center', padding: '8px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: `1px solid ${t.border}` }}>
                                <div style={{ fontSize: '22px', fontWeight: '800', color: s.color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{s.v}</div>
                                <div style={{ fontSize: '9px', color: t.textMuted, marginTop: '2px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Upgrade nudge */}
            <div style={{ padding: '14px 18px', background: `linear-gradient(135deg, rgba(124,58,237,0.08), rgba(16,185,129,0.04))`, border: `1px solid ${t.accentBorder}`, borderRadius: '13px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: t.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Sparkles size={17} color="#fff" />
                </div>
                <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 1px', fontSize: '13px', fontWeight: '700', color: t.textPrimary }}>Unlock Team Collaboration</p>
                    <p style={{ margin: 0, fontSize: '11px', color: t.textMuted }}>Set up a company workspace to access team management, progress tracking & reports.</p>
                </div>
                <button onClick={() => {}} style={{ padding: '8px 14px', background: t.accentGrad, border: 'none', borderRadius: '8px', color: '#fff', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0, boxShadow: `0 4px 12px ${t.accent}40`, fontFamily: 'inherit' }}>
                    Set up <ArrowRight size={12} />
                </button>
            </div>

            {/* Main content */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: '16px' }}>
                {/* Tasks */}
                <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '16px', overflow: 'hidden' }}>
                    <div style={{ padding: '16px 18px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 style={{ fontSize: '14px', fontWeight: '700', color: t.textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: '7px' }}>
                            <ListTodo size={15} color={t.accentLight} /> My Tasks
                            <span style={{ fontSize: '11px', fontWeight: '600', color: t.textMuted, background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '20px', padding: '1px 7px' }}>{filteredTasks.length}</span>
                        </h2>
                        <Btn t={t} variant="primary" size="sm" onClick={() => isOnline && setShowCreateModal(true)} disabled={!isOnline}>
                            <Plus size={13} /> New Task
                        </Btn>
                    </div>

                    <div style={{ padding: '14px 18px' }}>
                        {/* Search */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '9px', marginBottom: '12px' }}>
                            <Search size={13} color={t.textMuted} />
                            <input type="text" placeholder="Search tasks…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                style={{ flex: 1, background: 'none', border: 'none', color: t.textPrimary, fontSize: '12px', outline: 'none', fontFamily: 'inherit' }} />
                            {searchQuery && <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', display: 'flex', padding: '2px' }}><X size={11} /></button>}
                        </div>

                        {/* Filters */}
                        <div style={{ display: 'flex', gap: '4px', marginBottom: '14px', flexWrap: 'wrap' }}>
                            {['all', 'pending', 'in_progress', 'completed', 'blocked'].map(s => (
                                <button key={s} onClick={() => setFilter(s)}
                                    style={{ padding: '4px 10px', background: filter === s ? t.accentBg : 'transparent', border: `1px solid ${filter === s ? t.accentBorder : t.border}`, borderRadius: '20px', color: filter === s ? t.accentLight : t.textMuted, fontSize: '10px', fontWeight: filter === s ? '700' : '400', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.13s', textTransform: 'capitalize' }}>
                                    {s.replace('_', ' ')}
                                </button>
                            ))}
                        </div>

                        {/* Task list */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', maxHeight: '460px', overflowY: 'auto' }}>
                            {filteredTasks.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                                    <ListTodo size={32} color={t.textMuted} />
                                    <p style={{ color: t.textMuted, margin: '10px 0 0', fontSize: '13px' }}>{searchQuery || filter !== 'all' ? 'No matching tasks' : 'No tasks yet'}</p>
                                    {!searchQuery && filter === 'all' && isOnline && (
                                        <Btn t={t} variant="ghost" size="sm" onClick={() => setShowCreateModal(true)} style={{ marginTop: '12px', border: `1px solid ${t.accentBorder}`, color: t.accentLight }}>Create your first task</Btn>
                                    )}
                                </div>
                            ) : filteredTasks.map(task => (
                                <TaskCard key={task.id} t={t} task={task}
                                    onStatusChange={updateTaskStatus}
                                    onDelete={() => setDeleteTarget(task)}
                                    onEdit={() => setEditTask(task)}
                                    updatingStatus={updatingStatus} isOnline={isOnline} />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Activity feed */}
                <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '16px', padding: '18px', position: 'sticky', top: '74px', height: 'fit-content' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '14px' }}>
                        <Activity size={14} color={t.accentLight} />
                        <h3 style={{ fontSize: '13px', fontWeight: '700', color: t.textPrimary, margin: 0 }}>Live Activity</h3>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: wsConnected && isOnline ? t.success : t.danger, marginLeft: 'auto', flexShrink: 0 }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '400px', overflowY: 'auto' }}>
                        {recentActivity.length === 0
                            ? <p style={{ fontSize: '12px', color: t.textMuted, textAlign: 'center', padding: '24px 0', margin: 0, lineHeight: 1.5 }}>Activity will appear here as you work.</p>
                            : recentActivity.map(a => (
                                <div key={a.id} style={{ display: 'flex', gap: '9px' }}>
                                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: t.accent, marginTop: '6px', flexShrink: 0 }} />
                                    <div>
                                        <p style={{ fontSize: '12px', color: t.text, margin: '0 0 1px', lineHeight: 1.4 }}>{a.message}</p>
                                        <p style={{ fontSize: '10px', color: t.textMuted, margin: 0 }}>{new Date(a.timestamp).toLocaleTimeString()}</p>
                                    </div>
                                </div>
                            ))
                        }
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Company Dashboard ────────────────────────────────────────────────────────
const CompanyDashboard = ({ t, user, tasks, isOnline, wsConnected, recentActivity, filteredTasks, filter, setFilter, searchQuery, setSearchQuery, setShowCreateModal, updateTaskStatus, setDeleteTarget, setEditTask, updatingStatus }) => {
    const teamStats = {
        total:       tasks.length,
        inProgress:  tasks.filter(tk => tk.status === 'in_progress').length,
        completed:   tasks.filter(tk => tk.status === 'completed').length,
        overdue:     tasks.filter(tk => tk.deadline && new Date(tk.deadline) < new Date() && tk.status !== 'completed').length,
        blocked:     tasks.filter(tk => tk.status === 'blocked').length,
        flagged:     tasks.filter(tk => tk.flagged).length,
    };

    const completionRate = tasks.length > 0 ? Math.round((teamStats.completed / tasks.length) * 100) : 0;

    // Group tasks by assignee
    const byAssignee = tasks.reduce((acc, t) => {
        const name = t.assignee_name || 'Unassigned';
        if (!acc[name]) acc[name] = { total: 0, completed: 0 };
        acc[name].total++;
        if (t.status === 'completed') acc[name].completed++;
        return acc;
    }, {});

    return (
        <div style={{ padding: '20px 24px 40px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Company header */}
            <div style={{ padding: '22px 26px', background: `linear-gradient(135deg, ${t.accentBg}, transparent)`, border: `1px solid ${t.accentBorder}`, borderRadius: '18px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '160px', height: '160px', borderRadius: '50%', background: `radial-gradient(circle, ${t.accent}18, transparent 70%)`, pointerEvents: 'none' }} />
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: t.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Building2 size={18} color="#fff" />
                            </div>
                            <div>
                                <p style={{ margin: 0, fontSize: '11px', color: t.accentLight, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Company Workspace</p>
                                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: t.textPrimary, letterSpacing: '-0.3px' }}>Team Overview</h2>
                            </div>
                        </div>
                        <p style={{ margin: 0, fontSize: '12px', color: t.textMuted }}>Welcome back, <strong style={{ color: t.text }}>{user?.fullName}</strong> · {user?.role}</p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '36px', fontWeight: '900', color: t.textPrimary, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{completionRate}%</div>
                        <div style={{ fontSize: '10px', color: t.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '2px' }}>Team Completion</div>
                        <div style={{ marginTop: '8px', height: '4px', background: t.border, borderRadius: '2px', width: '100px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${completionRate}%`, background: t.accentGrad, borderRadius: '2px', transition: 'width 0.6s ease' }} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {[
                    { icon: <Clock size={17} />,        v: teamStats.inProgress, label: 'In Progress', color: t.info    },
                    { icon: <CheckCircle2 size={17} />, v: teamStats.completed,  label: 'Completed',   color: t.success },
                    { icon: <AlertCircle size={17} />,  v: teamStats.overdue,    label: 'Overdue',     color: t.danger  },
                ].map((s, i) => (
                    <div key={i} style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '13px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: `${s.color}15`, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.icon}</div>
                        <div>
                            <div style={{ fontSize: '24px', fontWeight: '800', color: t.textPrimary, lineHeight: 1 }}>{s.v}</div>
                            <div style={{ fontSize: '10px', color: t.textMuted, marginTop: '2px', fontWeight: '500' }}>{s.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Content grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '16px' }}>
                {/* Tasks panel */}
                <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '16px', overflow: 'hidden' }}>
                    <div style={{ padding: '16px 18px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 style={{ fontSize: '14px', fontWeight: '700', color: t.textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: '7px' }}>
                            <ListTodo size={15} color={t.accentLight} /> All Team Tasks
                            <span style={{ fontSize: '11px', fontWeight: '600', color: t.textMuted, background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '20px', padding: '1px 7px' }}>{filteredTasks.length}</span>
                        </h2>
                        <Btn t={t} variant="primary" size="sm" onClick={() => isOnline && setShowCreateModal(true)} disabled={!isOnline}>
                            <Plus size={13} /> New Task
                        </Btn>
                    </div>
                    <div style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '9px', marginBottom: '12px' }}>
                            <Search size={13} color={t.textMuted} />
                            <input type="text" placeholder="Search all team tasks…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                style={{ flex: 1, background: 'none', border: 'none', color: t.textPrimary, fontSize: '12px', outline: 'none', fontFamily: 'inherit' }} />
                            {searchQuery && <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', display: 'flex', padding: '2px' }}><X size={11} /></button>}
                        </div>
                        <div style={{ display: 'flex', gap: '4px', marginBottom: '14px', flexWrap: 'wrap' }}>
                            {['all', 'pending', 'in_progress', 'completed', 'blocked'].map(s => (
                                <button key={s} onClick={() => setFilter(s)}
                                    style={{ padding: '4px 10px', background: filter === s ? t.accentBg : 'transparent', border: `1px solid ${filter === s ? t.accentBorder : t.border}`, borderRadius: '20px', color: filter === s ? t.accentLight : t.textMuted, fontSize: '10px', fontWeight: filter === s ? '700' : '400', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.13s', textTransform: 'capitalize' }}>
                                    {s.replace('_', ' ')}
                                </button>
                            ))}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', maxHeight: '460px', overflowY: 'auto' }}>
                            {filteredTasks.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                                    <ListTodo size={32} color={t.textMuted} />
                                    <p style={{ color: t.textMuted, margin: '10px 0 0', fontSize: '13px' }}>No tasks found</p>
                                </div>
                            ) : filteredTasks.map(task => (
                                <TaskCard key={task.id} t={t} task={task}
                                    onStatusChange={updateTaskStatus}
                                    onDelete={() => setDeleteTarget(task)}
                                    onEdit={() => setEditTask(task)}
                                    updatingStatus={updatingStatus} isOnline={isOnline} />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'sticky', top: '74px', height: 'fit-content' }}>
                    {/* Team breakdown */}
                    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '16px', padding: '18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '14px' }}>
                            <Users size={14} color={t.accentLight} />
                            <h3 style={{ fontSize: '13px', fontWeight: '700', color: t.textPrimary, margin: 0 }}>Team Workload</h3>
                        </div>
                        {Object.entries(byAssignee).length === 0
                            ? <p style={{ fontSize: '12px', color: t.textMuted, margin: 0 }}>No assignments yet</p>
                            : Object.entries(byAssignee).map(([name, data]) => {
                                const pct = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
                                return (
                                    <div key={name} style={{ marginBottom: '12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '12px', color: t.text, fontWeight: '500' }}>{name}</span>
                                            <span style={{ fontSize: '10px', color: t.textMuted }}>{data.completed}/{data.total}</span>
                                        </div>
                                        <div style={{ height: '4px', background: t.border, borderRadius: '2px', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? t.success : t.accentGrad, borderRadius: '2px' }} />
                                        </div>
                                    </div>
                                );
                            })
                        }
                    </div>

                    {/* Activity */}
                    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '16px', padding: '18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '14px' }}>
                            <Activity size={14} color={t.accentLight} />
                            <h3 style={{ fontSize: '13px', fontWeight: '700', color: t.textPrimary, margin: 0 }}>Team Activity</h3>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: wsConnected && isOnline ? t.success : t.danger, marginLeft: 'auto', flexShrink: 0 }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '240px', overflowY: 'auto' }}>
                            {recentActivity.length === 0
                                ? <p style={{ fontSize: '12px', color: t.textMuted, margin: 0 }}>No recent activity</p>
                                : recentActivity.map(a => (
                                    <div key={a.id} style={{ display: 'flex', gap: '9px' }}>
                                        <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: t.accent, marginTop: '6px', flexShrink: 0 }} />
                                        <div>
                                            <p style={{ fontSize: '11px', color: t.text, margin: '0 0 1px', lineHeight: 1.4 }}>{a.message}</p>
                                            <p style={{ fontSize: '10px', color: t.textMuted, margin: 0 }}>{new Date(a.timestamp).toLocaleTimeString()}</p>
                                        </div>
                                    </div>
                                ))
                            }
                        </div>
                    </div>

                    {/* Quick stats */}
                    {teamStats.flagged > 0 && (
                        <div style={{ padding: '14px', background: t.warningBg, border: `1px solid ${t.warningBorder}`, borderRadius: '13px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Flag size={16} color={t.warning} />
                            <div>
                                <p style={{ margin: 0, fontSize: '12px', fontWeight: '700', color: t.textPrimary }}>{teamStats.flagged} Flagged {teamStats.flagged === 1 ? 'Task' : 'Tasks'}</p>
                                <p style={{ margin: '1px 0 0', fontSize: '11px', color: t.textMuted }}>Requires attention</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Locked View ──────────────────────────────────────────────────────────────
const LockedView = ({ t, label, onSetup }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '14px', padding: '40px' }}>
        <div style={{ width: '58px', height: '58px', borderRadius: '16px', background: t.inputBg, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={24} color={t.textMuted} />
        </div>
        <div style={{ textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: '700', color: t.textPrimary }}>{label}</h3>
            <p style={{ margin: 0, fontSize: '13px', color: t.textMuted }}>This feature requires a company workspace.</p>
        </div>
        <Btn t={t} variant="primary" onClick={onSetup}>
            <Building2 size={14} /> Set Up Company
        </Btn>
    </div>
);

// ─── Main Dashboard ───────────────────────────────────────────────────────────
const Dashboard = () => {
    const { user, logout, updateUser } = useAuth();
    const [dark, setDark] = useState(true);

    const isCompany = user?.accountType === 'company';

    // Pick theme
    const t = dark
        ? (isCompany ? COMPANY : PERSONAL)
        : (isCompany ? LIGHT_COMPANY : LIGHT_PERSONAL);

    const [currentView,      setCurrentView]      = useState('dashboard');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [tasks,            setTasks]            = useState([]);
    const [loading,          setLoading]          = useState(true);
    const [filter,           setFilter]           = useState('all');
    const [searchQuery,      setSearchQuery]      = useState('');
    const [showCreateModal,  setShowCreateModal]  = useState(false);
    const [editTask,         setEditTask]          = useState(null);
    const [deleteTarget,     setDeleteTarget]     = useState(null);
    const [deleteLoading,    setDeleteLoading]    = useState(false);
    const [showProfile,      setShowProfile]      = useState(false);
    const [wsConnected,      setWsConnected]      = useState(false);
    const [recentActivity,   setRecentActivity]   = useState([]);
    const [notifications,    setNotifications]    = useState([]);
    const [showNotifications,setShowNotifications] = useState(false);
    const [updatingStatus,   setUpdatingStatus]   = useState(null);
    const [isOnline,         setIsOnline]         = useState(navigator.onLine);

    const userIdRef = useRef(user?.id);
    useEffect(() => { userIdRef.current = user?.id; }, [user?.id]);

    const addActivity = useCallback((msg) => {
        setRecentActivity(prev => [{ id: Date.now() + Math.random(), message: msg, timestamp: new Date() }, ...prev].slice(0, 12));
    }, []);

    const addNotification = useCallback((title, message, type = 'info') => {
        setNotifications(prev => [{ id: Date.now(), title, message, type, read: false }, ...prev].slice(0, 20));
    }, []);

    const fetchTasks = useCallback(async () => {
        try {
            const res = await taskAPI.getAll();
            const all = res.data.tasks || [];
            const filtered = isCompany
                ? all.filter(task => task.company_id === user.company_id || task.org_id === user.org_id)
                : all.filter(task => task.created_by === userIdRef.current || task.assignee_id === userIdRef.current);
            setTasks(filtered);
        } catch (err) { console.error('Fetch tasks:', err); }
    }, [isCompany, user.company_id, user.org_id]);

    useEffect(() => {
        const online  = () => { setIsOnline(true);  addActivity('🟢 Connection restored'); };
        const offline = () => { setIsOnline(false); addActivity('🔴 Lost connection'); };
        window.addEventListener('online', online);
        window.addEventListener('offline', offline);
        return () => { window.removeEventListener('online', online); window.removeEventListener('offline', offline); };
    }, [addActivity]);

    useEffect(() => {
        const load = async () => { setLoading(true); await fetchTasks(); setLoading(false); };
        load();

        let pollCount = 0;
        const pollInterval = setInterval(() => {
            const state = wsService?.socket?.readyState ?? wsService?.readyState;
            if (state === 1) { setWsConnected(true); clearInterval(pollInterval); }
            else if (++pollCount >= 10) clearInterval(pollInterval);
        }, 1000);

        const onCreated = (data) => {
            setTasks(prev => [data.task, ...prev]);
            addActivity(`${data.creator?.fullName || 'Someone'} created "${data.task.title}"`);
        };
        const onUpdated = (data) => {
            setTasks(prev => prev.map(tk => tk.id === data.task.id ? data.task : tk));
        };
        const onDeleted = (data) => setTasks(prev => prev.filter(tk => tk.id !== data.taskId));
        const onFlagged = (data) => {
            setTasks(prev => prev.map(tk => tk.id === data.task.id ? data.task : tk));
            addNotification('Task Flagged', `"${data.task.title}": ${data.reason}`, 'warning');
        };

        wsService.on('connection',   (d) => { if (typeof d === 'boolean') setWsConnected(d); else if (d?.connected !== undefined) setWsConnected(d.connected); });
        wsService.on('task:created', onCreated);
        wsService.on('task:updated', onUpdated);
        wsService.on('task:deleted', onDeleted);
        wsService.on('task:flagged', onFlagged);

        return () => {
            clearInterval(pollInterval);
            wsService.off('task:created', onCreated);
            wsService.off('task:updated', onUpdated);
            wsService.off('task:deleted', onDeleted);
            wsService.off('task:flagged', onFlagged);
        };
    }, [addActivity, addNotification, fetchTasks]);

    const filteredTasks = tasks.filter(task => {
        const matchesFilter = filter === 'all' || task.status === filter;
        const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (task.description || '').toLowerCase().includes(searchQuery.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const updateTaskStatus = async (taskId, newStatus) => {
        if (!isOnline) return;
        const prev = tasks;
        setTasks(p => p.map(tk => tk.id === taskId ? { ...tk, status: newStatus } : tk));
        setUpdatingStatus(taskId);
        try { await taskAPI.update(taskId, { status: newStatus }); addActivity(`Task status → ${STATUS_LABEL[newStatus]}`); }
        catch { setTasks(prev); }
        finally { setUpdatingStatus(null); }
    };

    const confirmDeleteTask = async () => {
        if (!deleteTarget || !isOnline) { setDeleteTarget(null); return; }
        setDeleteLoading(true);
        try {
            await taskAPI.delete(deleteTarget.id);
            setTasks(prev => prev.filter(tk => tk.id !== deleteTarget.id));
            addActivity(`Deleted "${deleteTarget.title}"`);
            setDeleteTarget(null);
        } catch (err) {
            addNotification('Delete Failed', err.response?.data?.error || 'Failed to delete task', 'error');
        } finally { setDeleteLoading(false); }
    };

    const handleProfileSave = async (data, type, device) => {
        try {
            if (type === 'profile') {
                let updatedUser;
                if (data.avatar instanceof File) {
                    const form = new FormData();
                    form.append('avatar', data.avatar, data.avatar.name);
                    form.append('fullName', data.fullName || '');
                    form.append('device', device);
                    const res = await userAPI.updateProfile(form);
                    updatedUser = res.data?.user ?? res.data;
                } else if (data.avatar === null) {
                    const res = await userAPI.updateProfile({ fullName: data.fullName, removeAvatar: true, device });
                    updatedUser = res.data?.user ?? res.data;
                } else {
                    const res = await userAPI.updateProfile({ fullName: data.fullName, device });
                    updatedUser = res.data?.user ?? res.data;
                }
                if (updatedUser && updateUser) updateUser(updatedUser);
            } else if (type === 'password') {
                await userAPI.changePassword({ currentPassword: data.currentPassword, newPassword: data.newPassword, device });
            }
            return null;
        } catch (err) { return err.response?.data?.message || err.message || `Failed to update ${type}`; }
    };

    const handleDeleteAccount = async (device) => {
        try { await userAPI.deleteAccount({ device }); } catch (err) {
            const s = err.response?.status;
            if (s && s !== 404 && s !== 410) { addNotification('Error', 'Could not delete account', 'error'); return; }
        }
        try { localStorage.clear(); } catch (_) {}
        logout();
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    const sharedDashProps = {
        t, user, tasks, isOnline, wsConnected, recentActivity, filteredTasks,
        filter, setFilter, searchQuery, setSearchQuery, setShowCreateModal,
        updateTaskStatus, setDeleteTarget, setEditTask, updatingStatus,
    };

    if (loading) return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: t.bg, gap: '14px' }}>
            <div style={{ width: '42px', height: '42px', border: `3px solid ${t.border}`, borderTop: `3px solid ${t.accent}`, borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ color: t.textMuted, fontSize: '13px', margin: 0 }}>Loading Syncline…</p>
        </div>
    );

    return (
        <div style={{ minHeight: '100vh', background: t.bg, color: t.text, fontFamily: "'DM Sans', 'Sora', system-ui, sans-serif", display: 'flex', flexDirection: 'column' }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
                @keyframes slideDown { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
                input:focus, select:focus, textarea:focus { outline: none; border-color: ${t.accent} !important; box-shadow: 0 0 0 3px ${t.accent}22 !important; }
                ::-webkit-scrollbar { width: 4px; height: 4px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: ${t.border}; border-radius: 2px; }
                ::-webkit-scrollbar-thumb:hover { background: ${t.borderMid}; }
                * { box-sizing: border-box; }
                select option { background: ${t.surfaceRaised}; color: ${t.textPrimary}; }
            `}</style>

            {/* ── Header ── */}
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', background: t.sidebarBg, borderBottom: `1px solid ${t.sidebarBorder}`, position: 'sticky', top: 0, zIndex: 100, height: '58px', flexShrink: 0 }}>
                {/* Left */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: t.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Zap size={14} color="#fff" />
                        </div>
                        <span style={{ fontSize: '16px', fontWeight: '800', color: t.textPrimary, letterSpacing: '-0.3px' }}>Syncline</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', background: isOnline ? t.onlineBg : t.offlineBg, borderRadius: '20px', border: `1px solid ${isOnline ? t.successBorder : t.dangerBorder}` }}>
                        {isOnline ? <Wifi size={9} color={t.online} /> : <WifiOff size={9} color={t.offline} />}
                        <span style={{ fontSize: '9px', color: isOnline ? t.online : t.offline, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            {!isOnline ? 'Offline' : wsConnected ? 'Live' : 'Connecting'}
                        </span>
                    </div>

                    {isCompany && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', background: t.accentBg, borderRadius: '20px', border: `1px solid ${t.accentBorder}` }}>
                            <Building2 size={9} color={t.accentLight} />
                            <span style={{ fontSize: '9px', color: t.accentLight, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Team Workspace</span>
                        </div>
                    )}
                </div>

                {/* Right */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {/* Theme toggle */}
                    <button onClick={() => setDark(!dark)} title="Toggle theme"
                        style={{ padding: '6px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '7px', color: t.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {dark ? <Sun size={14} /> : <Moon size={14} />}
                    </button>

                    {/* Notifications */}
                    <div style={{ position: 'relative' }}>
                        <button onClick={() => setShowNotifications(!showNotifications)}
                            style={{ padding: '6px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '7px', color: t.text, cursor: 'pointer', display: 'flex', position: 'relative' }}>
                            <Bell size={14} />
                            {unreadCount > 0 && <span style={{ position: 'absolute', top: '1px', right: '1px', width: '14px', height: '14px', borderRadius: '50%', background: t.danger, color: '#fff', fontSize: '8px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${t.sidebarBg}` }}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
                        </button>
                        {showNotifications && (
                            <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '300px', background: t.modalBg, border: `1px solid ${t.borderMid}`, borderRadius: '14px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', zIndex: 200, overflow: 'hidden', animation: 'slideDown 0.15s ease' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: `1px solid ${t.border}` }}>
                                    <span style={{ fontSize: '12px', fontWeight: '700', color: t.textPrimary }}>Notifications</span>
                                    <button onClick={() => setNotifications(p => p.map(n => ({ ...n, read: true })))} style={{ background: 'none', border: 'none', color: t.accentLight, fontSize: '11px', cursor: 'pointer', fontWeight: '600', fontFamily: 'inherit' }}>Mark all read</button>
                                </div>
                                <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                                    {notifications.length === 0
                                        ? <p style={{ fontSize: '12px', color: t.textMuted, textAlign: 'center', padding: '24px', margin: 0 }}>No notifications</p>
                                        : notifications.map(n => (
                                            <div key={n.id} onClick={() => setNotifications(p => p.map(i => i.id === n.id ? { ...i, read: true } : i))}
                                                style={{ padding: '10px 14px', borderBottom: `1px solid ${t.border}`, background: n.read ? 'transparent' : t.accentBg, cursor: 'pointer' }}>
                                                <p style={{ margin: '0 0 2px', fontSize: '12px', fontWeight: n.read ? '500' : '700', color: t.textPrimary }}>{n.title}</p>
                                                <p style={{ margin: 0, fontSize: '11px', color: t.textMuted, lineHeight: 1.4 }}>{n.message}</p>
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Profile button */}
                    <button onClick={() => setShowProfile(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '4px 10px 4px 4px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '9px', cursor: 'pointer', transition: 'all 0.13s' }}>
                        <div style={{ width: '26px', height: '26px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 }}>
                            {(user?.avatar || user?.avatar_url)
                                ? <img src={resolveAvatar(user.avatar || user.avatar_url)} alt="av" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : <div style={{ width: '100%', height: '100%', background: t.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '800', color: '#fff' }}>
                                    {(user?.fullName || user?.email || '?').charAt(0).toUpperCase()}
                                  </div>
                            }
                        </div>
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: t.textPrimary, maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.fullName || user?.email}</div>
                            <div style={{ fontSize: '9px', color: t.textMuted, textTransform: 'capitalize' }}>{user?.role}</div>
                        </div>
                        <ChevronDown size={10} color={t.textMuted} />
                    </button>

                    {/* Logout */}
                    <button onClick={logout} title="Logout"
                        style={{ padding: '6px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '7px', color: t.textMuted, cursor: 'pointer', display: 'flex' }}>
                        <LogOut size={14} />
                    </button>
                </div>
            </header>

            {/* Offline bar */}
            {!isOnline && (
                <div style={{ padding: '7px 20px', background: t.offlineBg, borderBottom: `1px solid ${t.dangerBorder}`, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                    <WifiOff size={12} color={t.offline} />
                    <span style={{ fontSize: '12px', color: t.offline, fontWeight: '600' }}>You're offline — some features are limited.</span>
                </div>
            )}

            {/* Body */}
            <div style={{ display: 'flex', flex: 1 }}>
                <Sidebar t={t} currentView={currentView} onNavigate={setCurrentView}
                    collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
                    isCompany={isCompany} />

                <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    {/* Stats bar — always visible */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', padding: '16px 24px 0', flexShrink: 0 }}>
                        <StatCard t={t} icon={<ListTodo size={18} />}     value={tasks.length}                                                                            label="Total Tasks"  color={t.accent}   />
                        <StatCard t={t} icon={<Clock size={18} />}        value={tasks.filter(tk => tk.status === 'in_progress').length}                                  label="In Progress"  color={t.info}     />
                        <StatCard t={t} icon={<CheckCircle2 size={18} />} value={tasks.filter(tk => tk.status === 'completed').length}                                    label="Completed"    color={t.success}  />
                        <StatCard t={t} icon={<AlertCircle size={18} />}  value={tasks.filter(tk => tk.deadline && new Date(tk.deadline) < new Date() && tk.status !== 'completed').length} label="Overdue" color={t.danger} />
                    </div>

                    {/* View switcher */}
                    {currentView === 'dashboard' && (
                        isCompany
                            ? <CompanyDashboard  {...sharedDashProps} />
                            : <PersonalDashboard {...sharedDashProps} />
                    )}
                    {currentView === 'company-setup' && <CompanyOnboarding dark={dark} />}
                    {currentView === 'team'     && (isCompany ? <TeamManagement dark={dark} />   : <LockedView t={t} label="Team Management"  onSetup={() => setCurrentView('company-setup')} />)}
                    {currentView === 'progress' && (isCompany ? <ProgressMonitor dark={dark} />  : <LockedView t={t} label="Progress Monitor" onSetup={() => setCurrentView('company-setup')} />)}
                    {currentView === 'reports'  && (isCompany ? <ReportManagement dark={dark} /> : <LockedView t={t} label="Reports"          onSetup={() => setCurrentView('company-setup')} />)}
                </main>
            </div>

            {/* Modals */}
            {showCreateModal && (
                <TaskModal t={t} title="Create New Task" onClose={() => setShowCreateModal(false)} isOnline={isOnline}
                    onSave={async (data) => {
                        try { await taskAPI.create(data); setShowCreateModal(false); addActivity(`You created "${data.title}"`); fetchTasks(); }
                        catch (err) { return err.response?.data?.error || 'Failed to create task'; }
                    }} />
            )}
            {editTask && (
                <TaskModal t={t} title="Edit Task" initialData={editTask} onClose={() => setEditTask(null)} isOnline={isOnline}
                    onSave={async (data) => {
                        try { await taskAPI.update(editTask.id, data); setEditTask(null); addActivity(`You updated "${data.title}"`); fetchTasks(); }
                        catch (err) { return err.response?.data?.error || 'Failed to update task'; }
                    }} />
            )}
            {deleteTarget && (
                <DeleteModal t={t} task={deleteTarget} loading={deleteLoading}
                    onConfirm={confirmDeleteTask}
                    onCancel={() => !deleteLoading && setDeleteTarget(null)} />
            )}
            {showProfile && (
                <ProfileModal t={t} user={user} isOnline={isOnline}
                    onClose={() => setShowProfile(false)}
                    onSave={handleProfileSave}
                    onDeleteAccount={handleDeleteAccount} />
            )}
            {showNotifications && (
                <div onClick={() => setShowNotifications(false)} style={{ position: 'fixed', inset: 0, zIndex: 150 }} />
            )}
        </div>
    );
};

export default Dashboard;