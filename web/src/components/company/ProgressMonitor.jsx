// web/src/components/dashboard/ProgressMonitor.jsx
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { auth } from '../../firebase.js';
import {
    TrendingUp, Users, CheckCircle2, Clock, AlertCircle, Flag,
    RefreshCw, Download, Activity,
    BarChart2, Target
} from 'lucide-react';

const API_BASE   = 'https://syncline-1.onrender.com/api';
const API_ORIGIN = 'https://syncline-1.onrender.com';

// ─── Auth helper (plain async function — not a hook) ──────────────────────────
async function getAuthHeaders() {
    const token = await auth.currentUser?.getIdToken();
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

const themes = {
    dark: {
        bg: '#0f172a', surfacePrimary: '#1e293b',
        surfaceCard: 'rgba(255,255,255,0.04)', surfaceHover: 'rgba(255,255,255,0.06)',
        border: 'rgba(255,255,255,0.08)', borderMid: 'rgba(255,255,255,0.12)',
        textPrimary: '#fff', textMuted: '#64748b', textSecondary: '#94a3b8',
        inputBg: 'rgba(255,255,255,0.07)', selectBg: '#334155', selectText: '#e2e8f0',
        accentBg: 'rgba(99,102,241,0.15)', accentBorder: 'rgba(99,102,241,0.3)', accentText: '#a5b4fc',
        errorBg: 'rgba(239,68,68,0.1)', errorBorder: 'rgba(239,68,68,0.3)', errorText: '#fca5a5',
        successBg: 'rgba(16,185,129,0.1)', successBorder: 'rgba(16,185,129,0.3)', successText: '#6ee7b7',
        warnBg: 'rgba(245,158,11,0.1)', warnBorder: 'rgba(245,158,11,0.3)', warnText: '#fcd34d',
        dangerBg: 'rgba(239,68,68,0.12)', dangerBorder: 'rgba(239,68,68,0.3)', dangerText: '#fca5a5',
    },
    light: {
        bg: '#f1f5f9', surfacePrimary: '#ffffff',
        surfaceCard: 'rgba(0,0,0,0.02)', surfaceHover: 'rgba(0,0,0,0.04)',
        border: 'rgba(0,0,0,0.08)', borderMid: 'rgba(0,0,0,0.12)',
        textPrimary: '#0f172a', textMuted: '#64748b', textSecondary: '#475569',
        inputBg: 'rgba(0,0,0,0.04)', selectBg: '#e2e8f0', selectText: '#1e293b',
        accentBg: 'rgba(99,102,241,0.08)', accentBorder: 'rgba(99,102,241,0.25)', accentText: '#4f46e5',
        errorBg: 'rgba(239,68,68,0.06)', errorBorder: 'rgba(239,68,68,0.25)', errorText: '#dc2626',
        successBg: 'rgba(16,185,129,0.07)', successBorder: 'rgba(16,185,129,0.25)', successText: '#059669',
        warnBg: 'rgba(245,158,11,0.07)', warnBorder: 'rgba(245,158,11,0.25)', warnText: '#b45309',
        dangerBg: 'rgba(239,68,68,0.06)', dangerBorder: 'rgba(239,68,68,0.25)', dangerText: '#dc2626',
    }
};

const Spinner = ({ size = 16, color = '#6366f1' }) => (
    <div style={{
        width: size, height: size,
        border: `2px solid ${color}30`, borderTop: `2px solid ${color}`,
        borderRadius: '50%', animation: 'pm-spin 0.7s linear infinite', flexShrink: 0
    }} />
);

const resolveAvatar = (avatar) => {
    if (!avatar) return null;
    if (avatar.startsWith('http') || avatar.startsWith('data:')) return avatar;
    return `${API_ORIGIN}${avatar}`;
};

const Avatar = ({ user, size = 32 }) => {
    const src      = resolveAvatar(user?.avatar || user?.avatar_url);
    const initials = (user?.fullName || user?.full_name || user?.email || '?').charAt(0).toUpperCase();
    return (
        <div style={{
            width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: size * 0.38, fontWeight: '700', color: '#fff',
        }}>
            {src
                ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initials}
        </div>
    );
};

const MiniBar = ({ value, max, color }) => (
    <div style={{ flex: 1, height: '6px', background: 'rgba(148,163,184,0.15)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{
            height: '100%',
            width: `${max > 0 ? Math.round((value / max) * 100) : 0}%`,
            background: color, borderRadius: '3px', transition: 'width 0.6s ease',
        }} />
    </div>
);

const DonutChart = ({ segments, size = 100, thickness = 14 }) => {
    const r     = (size - thickness) / 2;
    const cx    = size / 2;
    const cy    = size / 2;
    const circ  = 2 * Math.PI * r;
    const total = segments.reduce((s, seg) => s + seg.value, 0);
    let cumPct  = 0;
    return (
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
            {total === 0
                ? <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(148,163,184,0.2)" strokeWidth={thickness} />
                : segments.map((seg, i) => {
                    const pct    = seg.value / total;
                    const dash   = pct * circ;
                    const offset = cumPct * circ;
                    cumPct += pct;
                    return (
                        <circle key={i} cx={cx} cy={cy} r={r} fill="none"
                            stroke={seg.color} strokeWidth={thickness}
                            strokeDasharray={`${dash} ${circ - dash}`}
                            strokeDashoffset={-offset} strokeLinecap="butt" />
                    );
                })
            }
        </svg>
    );
};

const MemberRow = ({ t, member, tasks, rank }) => {
    const memberTasks = tasks.filter(tk => tk.assignee_id === member.id || tk.created_by === member.id);
    const completed   = memberTasks.filter(tk => tk.status === 'completed').length;
    const inProgress  = memberTasks.filter(tk => tk.status === 'in_progress').length;
    const overdue     = memberTasks.filter(tk =>
        tk.deadline && new Date(tk.deadline) < new Date() && tk.status !== 'completed'
    ).length;
    const rate       = memberTasks.length > 0 ? Math.round((completed / memberTasks.length) * 100) : 0;
    const rateColor  = rate >= 80 ? '#10b981' : rate >= 50 ? '#f59e0b' : rate > 0 ? '#ef4444' : t.textMuted;
    const rankColors = ['#f59e0b', '#94a3b8', '#cd7c4a'];

    return (
        <div className="pm-member-row"
            style={{
                background: t.surfacePrimary, border: `1px solid ${t.border}`,
                borderRadius: '12px', transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = t.borderMid}
            onMouseLeave={e => e.currentTarget.style.borderColor = t.border}>

            <div style={{
                width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                background: rank <= 3 ? `${rankColors[rank - 1]}20` : t.inputBg,
                color: rank <= 3 ? rankColors[rank - 1] : t.textMuted,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: '700',
            }}>
                {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank}
            </div>

            <Avatar user={member} size={36} />

            <div className="pm-name-col" style={{ minWidth: 0 }}>
                <p style={{
                    margin: 0, fontSize: '13px', fontWeight: '600', color: t.textPrimary,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                    {member.fullName || member.full_name || 'Unknown'}
                </p>
                <p style={{ margin: '1px 0 0', fontSize: '11px', color: t.textMuted, textTransform: 'capitalize' }}>
                    {member.role}
                </p>
            </div>

            <div className="pm-stats-grid">
                {[
                    { v: memberTasks.length, label: 'Total',       color: '#6366f1' },
                    { v: completed,          label: 'Completed',   color: '#10b981' },
                    { v: inProgress,         label: 'In Progress', color: '#3b82f6' },
                    { v: overdue,            label: 'Overdue',     color: '#ef4444' },
                ].map((s, i) => (
                    <div key={i} style={{ padding: '8px', background: t.surfaceCard, borderRadius: '8px', textAlign: 'center' }}>
                        <p style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: s.color }}>{s.v}</p>
                        <p style={{ margin: 0, fontSize: '10px', color: t.textMuted }}>{s.label}</p>
                    </div>
                ))}
            </div>

            <div className="pm-progress-col">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', color: t.textMuted }}>Progress</span>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: rateColor }}>{rate}%</span>
                </div>
                <div style={{ height: '6px', background: t.border, borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                        height: '100%', width: `${rate}%`, background: rateColor,
                        borderRadius: '3px', transition: 'width 0.5s ease',
                    }} />
                </div>
            </div>
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const ProgressMonitor = ({ dark = true }) => {
    useAuth();
    const t = dark ? themes.dark : themes.light;

    const [members, setMembers] = useState([]);
    const [tasks,   setTasks]   = useState([]);
    const [loading, setLoading] = useState(true);
    const [period,  setPeriod]  = useState('all');
    const [sortBy,  setSortBy]  = useState('rate');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [mRes, tRes] = await Promise.all([
                fetch(`${API_BASE}/company/team`, { headers: await getAuthHeaders() }),
                fetch(`${API_BASE}/tasks`,         { headers: await getAuthHeaders() }),
            ]);
            if (mRes.ok) {
                const d = await mRes.json();
                setMembers((d.members || []).map(m => ({ ...m, fullName: m.fullName || m.full_name })));
            }
            if (tRes.ok) {
                const d = await tRes.json();
                setTasks(d.tasks || []);
            }
        } catch (_) {}
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const filteredTasks = tasks.filter(tk => {
        if (period === 'all') return true;
        const d   = new Date(tk.created_at || tk.createdAt || 0);
        const now = new Date();
        if (period === 'week')  { const w = new Date(now); w.setDate(w.getDate() - 7);   return d >= w; }
        if (period === 'month') { const m = new Date(now); m.setMonth(m.getMonth() - 1); return d >= m; }
        return true;
    });

    const sortedMembers = [...members].sort((a, b) => {
        const aTasks = filteredTasks.filter(tk => tk.assignee_id === a.id || tk.created_by === a.id);
        const bTasks = filteredTasks.filter(tk => tk.assignee_id === b.id || tk.created_by === b.id);
        const aRate  = aTasks.length > 0 ? aTasks.filter(tk => tk.status === 'completed').length / aTasks.length : 0;
        const bRate  = bTasks.length > 0 ? bTasks.filter(tk => tk.status === 'completed').length / bTasks.length : 0;
        const aOd    = aTasks.filter(tk => tk.deadline && new Date(tk.deadline) < new Date() && tk.status !== 'completed').length;
        const bOd    = bTasks.filter(tk => tk.deadline && new Date(tk.deadline) < new Date() && tk.status !== 'completed').length;
        if (sortBy === 'rate')    return bRate - aRate;
        if (sortBy === 'total')   return bTasks.length - aTasks.length;
        if (sortBy === 'overdue') return bOd - aOd;
        if (sortBy === 'name')    return (a.fullName || '').localeCompare(b.fullName || '');
        return 0;
    });

    const totalTasks    = filteredTasks.length;
    const completedAll  = filteredTasks.filter(tk => tk.status === 'completed').length;
    const inProgressAll = filteredTasks.filter(tk => tk.status === 'in_progress').length;
    const overdueAll    = filteredTasks.filter(tk =>
        tk.deadline && new Date(tk.deadline) < new Date() && tk.status !== 'completed'
    ).length;
    const pendingAll  = filteredTasks.filter(tk => tk.status === 'pending').length;
    const blockedAll  = filteredTasks.filter(tk => tk.status === 'blocked').length;
    const overallRate = totalTasks > 0 ? Math.round((completedAll / totalTasks) * 100) : 0;

    const donutSegments = [
        { color: '#10b981', value: completedAll  },
        { color: '#3b82f6', value: inProgressAll },
        { color: '#f59e0b', value: pendingAll    },
        { color: '#ef4444', value: overdueAll    },
        { color: '#64748b', value: blockedAll    },
    ];

    const priorities = ['urgent', 'high', 'medium', 'low'].map(p => ({
        label: p,
        color: { urgent: '#dc2626', high: '#ef4444', medium: '#f59e0b', low: '#64748b' }[p],
        count: filteredTasks.filter(tk => tk.priority === p).length,
    }));

    const exportCSV = () => {
        const rows = [
            ['Member', 'Role', 'Total', 'Completed', 'In Progress', 'Overdue', 'Completion %'],
            ...sortedMembers.map(m => {
                const mt   = filteredTasks.filter(tk => tk.assignee_id === m.id || tk.created_by === m.id);
                const done = mt.filter(tk => tk.status === 'completed').length;
                const ip   = mt.filter(tk => tk.status === 'in_progress').length;
                const od   = mt.filter(tk =>
                    tk.deadline && new Date(tk.deadline) < new Date() && tk.status !== 'completed'
                ).length;
                const r = mt.length > 0 ? Math.round((done / mt.length) * 100) : 0;
                return [m.fullName || m.email, m.role, mt.length, done, ip, od, `${r}%`];
            }),
        ];
        const csv  = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = 'progress-report.csv'; a.click();
        URL.revokeObjectURL(url);
    };

    if (loading) return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: '400px', gap: '14px',
        }}>
            <Spinner size={28} />
            <span style={{ color: t.textMuted, fontSize: '14px' }}>Loading progress data…</span>
            <style>{`@keyframes pm-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );

    return (
        <div style={{
            padding: 'clamp(14px, 3vw, 28px)',
            maxWidth: '1400px', margin: '0 auto',
            fontFamily: "'Segoe UI', system-ui, sans-serif",
            boxSizing: 'border-box',
        }}>
            <style>{`
                @keyframes pm-spin { to { transform: rotate(360deg); } }
                .pm-member-row { display: flex; align-items: center; gap: 12px; padding: 13px 16px; flex-wrap: nowrap; min-width: 0; overflow: hidden; }
                .pm-name-col { flex: 1 1 120px; max-width: 160px; min-width: 0; }
                .pm-stats-grid { flex: 2 1 0; min-width: 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
                .pm-progress-col { flex: 0 0 120px; min-width: 0; }
                .pm-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; gap: 12px; flex-wrap: wrap; }
                .pm-controls { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
                .pm-period-group { display: flex; gap: 2px; border-radius: 9px; padding: 3px; }
                .pm-table-header { padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
                @media (max-width: 900px) { .pm-progress-col { display: none; } .pm-stats-grid { grid-template-columns: repeat(2, 1fr); } .pm-name-col { max-width: none; flex: 1 1 100px; } }
                @media (max-width: 600px) { .pm-member-row { flex-wrap: wrap; gap: 10px; padding: 12px; } .pm-stats-grid { grid-template-columns: repeat(2, 1fr); flex-basis: 100%; } .pm-name-col { flex: 1 1 120px; max-width: none; } .pm-progress-col { display: block; flex-basis: 100%; flex: unset; width: 100%; } .pm-period-group button { padding: 5px 8px !important; font-size: 11px !important; } .pm-controls { gap: 6px; } .pm-header { margin-bottom: 16px; } }
                @media (max-width: 380px) { .pm-stats-grid { grid-template-columns: repeat(2, 1fr); gap: 6px; } .pm-member-row { padding: 10px; gap: 8px; } }
            `}</style>

            <div className="pm-header">
                <div>
                    <h1 style={{ margin: 0, fontWeight: '700', color: t.textPrimary, fontSize: 'clamp(17px, 3vw, 22px)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <TrendingUp size={22} color="#6366f1" /> Progress Monitor
                    </h1>
                    <p style={{ margin: '5px 0 0', fontSize: '13px', color: t.textMuted }}>
                        Real-time team performance and task completion analytics
                    </p>
                </div>

                <div className="pm-controls">
                    <div className="pm-period-group" style={{ background: t.inputBg }}>
                        {[
                            { v: 'all',   l: 'All time'   },
                            { v: 'month', l: 'This month' },
                            { v: 'week',  l: 'This week'  },
                        ].map(p => (
                            <button key={p.v} onClick={() => setPeriod(p.v)} style={{
                                padding: '6px 12px',
                                background: period === p.v ? t.surfacePrimary : 'none',
                                border: period === p.v ? `1px solid ${t.border}` : '1px solid transparent',
                                borderRadius: '7px',
                                color: period === p.v ? t.textPrimary : t.textMuted,
                                fontSize: '12px', fontWeight: period === p.v ? '600' : '400',
                                cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap', fontFamily: 'inherit',
                            }}>
                                {p.l}
                            </button>
                        ))}
                    </div>
                    <button onClick={fetchData} title="Refresh" style={{ padding: '8px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '9px', color: t.textMuted, cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
                        <RefreshCw size={14} />
                    </button>
                    <button onClick={exportCSV} style={{ padding: '8px 14px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '9px', color: t.textSecondary, fontSize: '12px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                        <Download size={13} /> Export
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: '12px', marginBottom: '20px' }}>
                {[
                    { icon: <BarChart2 size={19} />,    value: totalTasks,         label: 'Total Tasks',  color: '#6366f1' },
                    { icon: <CheckCircle2 size={19} />, value: completedAll,        label: 'Completed',    color: '#10b981' },
                    { icon: <Clock size={19} />,        value: inProgressAll,       label: 'In Progress',  color: '#3b82f6' },
                    { icon: <AlertCircle size={19} />,  value: overdueAll,          label: 'Overdue',      color: '#ef4444' },
                    { icon: <Target size={19} />, value: `${overallRate}%`, label: 'Team Rate', color: overallRate >= 70 ? '#10b981' : overallRate >= 40 ? '#f59e0b' : '#ef4444' },
                ].map((s, i) => (
                    <div key={i} style={{ background: t.surfacePrimary, border: `1px solid ${t.border}`, borderRadius: '13px', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '11px', flexShrink: 0, background: `${s.color}18`, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.icon}</div>
                        <div>
                            <div style={{ fontSize: 'clamp(17px, 3vw, 22px)', fontWeight: '700', color: s.color, lineHeight: 1 }}>{s.value}</div>
                            <div style={{ fontSize: '11px', color: t.textMuted, marginTop: '2px' }}>{s.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '16px', marginBottom: '20px' }}>
                <div style={{ background: t.surfacePrimary, border: `1px solid ${t.border}`, borderRadius: '14px', padding: '22px' }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: '600', color: t.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Activity size={15} color="#6366f1" /> Task Status Breakdown
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                            <DonutChart segments={donutSegments} size={110} thickness={16} />
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                                <span style={{ fontSize: '20px', fontWeight: '800', color: t.textPrimary }}>{overallRate}%</span>
                                <span style={{ fontSize: '10px', color: t.textMuted }}>done</span>
                            </div>
                        </div>
                        <div style={{ flex: 1, minWidth: '140px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {[
                                { label: 'Completed',   value: completedAll,  color: '#10b981' },
                                { label: 'In Progress', value: inProgressAll, color: '#3b82f6' },
                                { label: 'Pending',     value: pendingAll,    color: '#f59e0b' },
                                { label: 'Overdue',     value: overdueAll,    color: '#ef4444' },
                                { label: 'Blocked',     value: blockedAll,    color: '#64748b' },
                            ].map((seg, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: seg.color, flexShrink: 0 }} />
                                    <span style={{ flex: '0 0 80px', fontSize: '12px', color: t.textSecondary }}>{seg.label}</span>
                                    <span style={{ fontSize: '13px', fontWeight: '700', color: t.textPrimary, minWidth: '20px' }}>{seg.value}</span>
                                    <MiniBar value={seg.value} max={totalTasks} color={seg.color} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div style={{ background: t.surfacePrimary, border: `1px solid ${t.border}`, borderRadius: '14px', padding: '22px' }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: '600', color: t.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Flag size={15} color="#6366f1" /> Priority Distribution
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {priorities.map(p => {
                            const pct = totalTasks > 0 ? Math.round((p.count / totalTasks) * 100) : 0;
                            return (
                                <div key={p.label}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                        <span style={{ fontSize: '13px', fontWeight: '600', color: t.textPrimary, textTransform: 'capitalize' }}>{p.label}</span>
                                        <span style={{ fontSize: '12px', color: t.textMuted }}>{p.count} tasks ({pct}%)</span>
                                    </div>
                                    <div style={{ height: '8px', background: t.border, borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${pct}%`, background: p.color, borderRadius: '4px', transition: 'width 0.5s ease' }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div style={{ background: t.surfacePrimary, border: `1px solid ${t.border}`, borderRadius: '14px', overflow: 'hidden' }}>
                <div className="pm-table-header" style={{ borderBottom: `1px solid ${t.border}` }}>
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: t.textPrimary, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <Users size={15} color="#6366f1" /> Member Performance
                        <span style={{ fontWeight: '400', color: t.textMuted, fontSize: '13px' }}>({members.length})</span>
                    </h3>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: '12px', color: t.textMuted, whiteSpace: 'nowrap' }}>Sort by:</span>
                        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ padding: '5px 10px', background: t.selectBg, border: `1px solid ${t.border}`, borderRadius: '7px', color: t.selectText, fontSize: '12px', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }}>
                            <option value="rate">Completion rate</option>
                            <option value="total">Total tasks</option>
                            <option value="overdue">Overdue</option>
                            <option value="name">Name</option>
                        </select>
                    </div>
                </div>
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {sortedMembers.length === 0
                        ? <p style={{ textAlign: 'center', color: t.textMuted, fontSize: '14px', padding: '40px 0' }}>No team members found</p>
                        : sortedMembers.map((m, i) => (
                            <MemberRow key={m.id} t={t} member={m} tasks={filteredTasks} rank={i + 1} />
                        ))
                    }
                </div>
            </div>
        </div>
    );
};

export default ProgressMonitor;