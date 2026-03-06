/* eslint-disable no-dupe-keys */
// web/src/components/dashboard/ReportManagement.jsx
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
    FileText, Plus, X, Send, CheckCircle2, AlertCircle, Clock,
    Search, RefreshCw, Download, 
    Calendar, User, Bell, Trash2, Edit2,
    AlertTriangle, ClipboardList, MessageSquare
} from 'lucide-react';

const API_BASE = 'http://localhost:3001/api';

const themes = {
    dark: {
        bg: '#0f172a', surfacePrimary: '#1e293b', modalBg: '#1e293b',
        surfaceCard: 'rgba(255,255,255,0.04)', surfaceHover: 'rgba(255,255,255,0.06)',
        border: 'rgba(255,255,255,0.08)', borderMid: 'rgba(255,255,255,0.12)',
        overlayBg: 'rgba(0,0,0,0.8)',
        textPrimary: '#fff', textMuted: '#64748b', textSecondary: '#94a3b8',
        inputBg: 'rgba(255,255,255,0.07)', selectBg: '#334155', selectText: '#e2e8f0',
        accentBg: 'rgba(99,102,241,0.15)', accentBorder: 'rgba(99,102,241,0.3)', accentText: '#a5b4fc',
        errorBg: 'rgba(239,68,68,0.1)', errorBorder: 'rgba(239,68,68,0.3)', errorText: '#fca5a5',
        successBg: 'rgba(16,185,129,0.1)', successBorder: 'rgba(16,185,129,0.3)', successText: '#6ee7b7',
        warnBg: 'rgba(245,158,11,0.1)', warnBorder: 'rgba(245,158,11,0.3)', warnText: '#fcd34d',
        dangerBg: 'rgba(239,68,68,0.12)', dangerBorder: 'rgba(239,68,68,0.3)', dangerText: '#fca5a5', dangerBtn: '#dc2626',
    },
    light: {
        bg: '#f1f5f9', surfacePrimary: '#ffffff', modalBg: '#ffffff',
        surfaceCard: 'rgba(0,0,0,0.02)', surfaceHover: 'rgba(0,0,0,0.04)',
        border: 'rgba(0,0,0,0.08)', borderMid: 'rgba(0,0,0,0.12)',
        overlayBg: 'rgba(0,0,0,0.55)',
        textPrimary: '#0f172a', textMuted: '#64748b', textSecondary: '#475569',
        inputBg: 'rgba(0,0,0,0.04)', selectBg: '#e2e8f0', selectText: '#1e293b',
        accentBg: 'rgba(99,102,241,0.08)', accentBorder: 'rgba(99,102,241,0.25)', accentText: '#4f46e5',
        errorBg: 'rgba(239,68,68,0.06)', errorBorder: 'rgba(239,68,68,0.25)', errorText: '#dc2626',
        successBg: 'rgba(16,185,129,0.07)', successBorder: 'rgba(16,185,129,0.25)', successText: '#059669',
        warnBg: 'rgba(245,158,11,0.07)', warnBorder: 'rgba(245,158,11,0.25)', warnText: '#b45309',
        dangerBg: 'rgba(239,68,68,0.06)', dangerBorder: 'rgba(239,68,68,0.25)', dangerText: '#dc2626', dangerBtn: '#dc2626',
    }
};

const Spinner = ({ size = 16, color = '#6366f1' }) => (
    <div style={{ width: size, height: size, border: `2px solid ${color}30`, borderTop: `2px solid ${color}`, borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
);



const StatusAlert = ({ t, type, children }) => {
    const s = { error: { bg: t.errorBg, border: t.errorBorder, color: t.errorText }, success: { bg: t.successBg, border: t.successBorder, color: t.successText }, warning: { bg: t.warnBg, border: t.warnBorder, color: t.warnText } }[type] || {};
    return <div style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color, padding: '10px 14px', borderRadius: '9px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>{children}</div>;
};

const statusConfig = {
    pending:   { label: 'Pending Review', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
    approved:  { label: 'Approved',       color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
    rejected:  { label: 'Rejected',       color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
    draft:     { label: 'Draft',          color: '#64748b', bg: 'rgba(100,116,139,0.15)' },
};

const inputSt = (t) => ({ width: '100%', padding: '9px 12px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '9px', fontSize: '13px', color: t.textPrimary, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' });

// ─── Submit Report Modal ──────────────────────────────────────────────────────
const SubmitModal = ({ t, tasks, onClose, onSubmit }) => {
    const [taskId,    setTaskId]    = useState('');
    const [title,     setTitle]     = useState('');
    const [summary,   setSummary]   = useState('');
    const [hours,     setHours]     = useState('');
    const [blockers,  setBlockers]  = useState('');
    const [nextSteps, setNextSteps] = useState('');
    const [loading,   setLoading]   = useState(false);
    const [error,     setError]     = useState(null);

    const handleSubmit = async (isDraft) => {
        if (!title.trim() || !summary.trim()) { setError('Title and summary are required'); return; }
        setLoading(true); setError(null);
        const err = await onSubmit({ task_id: taskId || null, title, summary, hours_spent: parseFloat(hours) || null, blockers, next_steps: nextSteps, status: isDraft ? 'draft' : 'pending' });
        setLoading(false);
        if (err) setError(err);
        else onClose();
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: t.overlayBg, backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1500 }} onClick={onClose}>
            <div style={{ background: t.modalBg, border: `1px solid ${t.border}`, borderRadius: '20px', width: '90%', maxWidth: '560px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.5)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                <div style={{ padding: '22px 24px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: t.textPrimary }}>Submit Report</h2>
                        <p style={{ margin: '3px 0 0', fontSize: '12px', color: t.textMuted }}>Document your work and progress</p>
                    </div>
                    <button onClick={onClose} style={{ background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '9px', color: t.textMuted, cursor: 'pointer', padding: '7px', display: 'flex' }}><X size={15} /></button>
                </div>

                <div style={{ padding: '22px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {error && <StatusAlert t={t} type="error"><AlertCircle size={14} /> {error}</StatusAlert>}

                    {/* Linked task */}
                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: t.textSecondary, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Linked Task (optional)</label>
                        <select value={taskId} onChange={e => setTaskId(e.target.value)} style={{ ...inputSt(t), background: t.selectBg, color: t.selectText, cursor: 'pointer' }}>
                            <option value="">— No specific task —</option>
                            {tasks.map(tk => <option key={tk.id} value={tk.id}>{tk.title}</option>)}
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: t.textSecondary, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Report Title *</label>
                        <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Weekly Progress – Sprint 4" style={inputSt(t)} />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: t.textSecondary, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Summary *</label>
                        <textarea value={summary} onChange={e => setSummary(e.target.value)} placeholder="What did you accomplish?" rows={4} style={{ ...inputSt(t), resize: 'vertical' }} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: t.textSecondary, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Hours Spent</label>
                            <input type="number" min="0" step="0.5" value={hours} onChange={e => setHours(e.target.value)} placeholder="e.g. 8" style={inputSt(t)} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: t.textSecondary, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Blockers</label>
                            <input type="text" value={blockers} onChange={e => setBlockers(e.target.value)} placeholder="Any obstacles?" style={inputSt(t)} />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: t.textSecondary, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Next Steps</label>
                        <textarea value={nextSteps} onChange={e => setNextSteps(e.target.value)} placeholder="What are you working on next?" rows={2} style={{ ...inputSt(t), resize: 'vertical' }} />
                    </div>
                </div>

                <div style={{ padding: '16px 24px', borderTop: `1px solid ${t.border}`, display: 'flex', gap: '10px' }}>
                    <button onClick={() => handleSubmit(true)} disabled={loading}
                        style={{ flex: 1, padding: '10px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '9px', color: t.textSecondary, fontSize: '13px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <Edit2 size={13} /> Save Draft
                    </button>
                    <button onClick={() => handleSubmit(false)} disabled={loading}
                        style={{ flex: 2, padding: '10px', background: loading ? t.inputBg : 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: '9px', color: loading ? t.textMuted : '#fff', fontSize: '13px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', opacity: loading ? 0.7 : 1, boxShadow: loading ? 'none' : '0 3px 12px rgba(99,102,241,0.35)' }}>
                        {loading ? <Spinner size={14} color="#6366f1" /> : <Send size={14} />}
                        {loading ? 'Submitting…' : 'Submit Report'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Report Detail Modal ──────────────────────────────────────────────────────
const ReportDetailModal = ({ t, report, onClose, onApprove, onReject, canReview }) => {
    const [feedback,  setFeedback]  = useState('');
    const [loading,   setLoading]   = useState(false);

    const statusCfg = statusConfig[report.status] || statusConfig.pending;

    const doAction = async (action) => {
        setLoading(true);
        await (action === 'approve' ? onApprove : onReject)(report.id, feedback);
        setLoading(false);
        onClose();
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: t.overlayBg, backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1500 }} onClick={onClose}>
            <div style={{ background: t.modalBg, border: `1px solid ${t.border}`, borderRadius: '20px', width: '90%', maxWidth: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.5)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                <div style={{ padding: '20px 24px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: t.textPrimary }}>{report.title}</h2>
                            <span style={{ padding: '2px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: statusCfg.bg, color: statusCfg.color }}>{statusCfg.label}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '14px', fontSize: '12px', color: t.textMuted }}>
                            <span>by {report.author_name || report.author?.fullName || 'Unknown'}</span>
                            <span>{new Date(report.created_at || report.createdAt).toLocaleDateString()}</span>
                            {report.hours_spent && <span>⏱ {report.hours_spent}h</span>}
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '9px', color: t.textMuted, cursor: 'pointer', padding: '7px', display: 'flex' }}><X size={15} /></button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    {/* Linked task */}
                    {report.task_title && (
                        <div style={{ padding: '10px 14px', background: t.accentBg, border: `1px solid ${t.accentBorder}`, borderRadius: '9px', fontSize: '13px', color: t.accentText, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ClipboardList size={14} /> Linked to task: <strong>{report.task_title}</strong>
                        </div>
                    )}

                    {/* Summary */}
                    <div>
                        <h4 style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: '700', color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Summary</h4>
                        <p style={{ margin: 0, fontSize: '13px', color: t.textPrimary, lineHeight: '1.7', background: t.surfaceCard, padding: '12px 14px', borderRadius: '9px', border: `1px solid ${t.border}` }}>{report.summary}</p>
                    </div>

                    {/* Blockers */}
                    {report.blockers && (
                        <div>
                            <h4 style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: '700', color: t.warnText, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '5px' }}><AlertTriangle size={12} /> Blockers</h4>
                            <p style={{ margin: 0, fontSize: '13px', color: t.textPrimary, lineHeight: '1.7', background: t.warnBg, padding: '12px 14px', borderRadius: '9px', border: `1px solid ${t.warnBorder}` }}>{report.blockers}</p>
                        </div>
                    )}

                    {/* Next steps */}
                    {report.next_steps && (
                        <div>
                            <h4 style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: '700', color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Next Steps</h4>
                            <p style={{ margin: 0, fontSize: '13px', color: t.textPrimary, lineHeight: '1.7', background: t.surfaceCard, padding: '12px 14px', borderRadius: '9px', border: `1px solid ${t.border}` }}>{report.next_steps}</p>
                        </div>
                    )}

                    {/* Existing feedback */}
                    {report.feedback && (
                        <div>
                            <h4 style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: '700', color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '5px' }}><MessageSquare size={12} /> Admin Feedback</h4>
                            <p style={{ margin: 0, fontSize: '13px', color: t.textPrimary, lineHeight: '1.7', background: t.surfaceCard, padding: '12px 14px', borderRadius: '9px', border: `1px solid ${t.border}` }}>{report.feedback}</p>
                        </div>
                    )}

                    {/* Review actions */}
                    {canReview && report.status === 'pending' && (
                        <div style={{ background: t.surfaceCard, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '16px' }}>
                            <h4 style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: '600', color: t.textPrimary }}>Leave Feedback (optional)</h4>
                            <textarea value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Add a comment for the submitter…" rows={3}
                                style={{ ...inputSt(t), resize: 'vertical', marginBottom: '12px' }} />
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={() => doAction('reject')} disabled={loading}
                                    style={{ flex: 1, padding: '9px', background: t.dangerBg, border: `1px solid ${t.dangerBorder}`, borderRadius: '9px', color: t.dangerText, fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                    <X size={14} /> Reject
                                </button>
                                <button onClick={() => doAction('approve')} disabled={loading}
                                    style={{ flex: 2, padding: '9px', background: '#10b981', border: 'none', borderRadius: '9px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxShadow: '0 3px 10px rgba(16,185,129,0.3)' }}>
                                    <CheckCircle2 size={14} /> Approve
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Report Card ──────────────────────────────────────────────────────────────
const ReportCard = ({ t, report, onView, onDelete, canDelete }) => {
    const cfg = statusConfig[report.status] || statusConfig.pending;
    const date = new Date(report.created_at || report.createdAt);

    return (
        <div style={{ background: t.surfacePrimary, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '16px 18px', transition: 'border-color 0.15s', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = t.borderMid}
            onMouseLeave={e => e.currentTarget.style.borderColor = t.border}
            onClick={() => onView(report)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: t.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{report.title}</h3>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', color: t.textMuted, display: 'flex', alignItems: 'center', gap: '4px' }}><User size={11} />{report.author_name || 'Unknown'}</span>
                        <span style={{ fontSize: '12px', color: t.textMuted, display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={11} />{date.toLocaleDateString()}</span>
                        {report.hours_spent && <span style={{ fontSize: '12px', color: t.textMuted }}>⏱ {report.hours_spent}h</span>}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: '12px' }}>
                    <span style={{ padding: '3px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: cfg.bg, color: cfg.color, flexShrink: 0 }}>{cfg.label}</span>
                    {canDelete && (
                        <button onClick={e => { e.stopPropagation(); onDelete(report); }}
                            style={{ padding: '5px', background: 'none', border: 'none', color: t.dangerText, cursor: 'pointer', display: 'flex', borderRadius: '6px' }}
                            onMouseEnter={e => e.currentTarget.style.background = t.dangerBg}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                            <Trash2 size={13} />
                        </button>
                    )}
                </div>
            </div>
            {report.summary && <p style={{ margin: 0, fontSize: '12px', color: t.textSecondary, lineHeight: '1.5', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{report.summary}</p>}
            {report.task_title && <div style={{ marginTop: '8px', fontSize: '11px', color: t.accentText, display: 'flex', alignItems: 'center', gap: '5px' }}><ClipboardList size={11} /> {report.task_title}</div>}
            {report.blockers && <div style={{ marginTop: '6px', fontSize: '11px', color: t.warnText, display: 'flex', alignItems: 'center', gap: '5px' }}><AlertTriangle size={11} /> Has blockers</div>}
        </div>
    );
};

// ─── Main ─────────────────────────────────────────────────────────────────────
const ReportManagement = ({ dark = true }) => {
    const { user } = useAuth();
    const t = dark ? themes.dark : themes.light;

    const [reports,    setReports]    = useState([]);
    const [tasks,      setTasks]      = useState([]);
    const [loading,    setLoading]    = useState(true);
    const [toast,      setToast]      = useState(null);
    const [showSubmit, setShowSubmit] = useState(false);
    const [viewReport, setViewReport] = useState(null);
    const [deleteReport, setDeleteReport] = useState(null);
    const [search,     setSearch]     = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [tab,        setTab]        = useState('all'); // all | mine | review

    const canReview = ['owner', 'admin', 'manager'].includes(user?.role);
    const authHeaders = useCallback(() => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('accessToken')}` }), []);

    const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };

    const fetchReports = useCallback(async () => {
        setLoading(true);
        try {
            const [rRes, tRes] = await Promise.all([
                fetch(`${API_BASE}/task-reports`,  { headers: authHeaders() }),
                fetch(`${API_BASE}/tasks`,          { headers: authHeaders() }),
            ]);
            if (rRes.ok) { const d = await rRes.json(); setReports(d.reports || []); }
            if (tRes.ok) { const d = await tRes.json(); setTasks(d.tasks   || []); }
        } catch (_) {}
        setLoading(false);
    }, [authHeaders]);

    useEffect(() => { fetchReports(); }, [fetchReports]);

    const handleSubmit = async (data) => {
        try {
            const res = await fetch(`${API_BASE}/task-reports`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) });
            const resp = await res.json();
            if (!res.ok) return resp.error || 'Failed to submit report';
            await fetchReports();
            showToast(data.status === 'draft' ? 'Draft saved' : 'Report submitted successfully!');
            return null;
        } catch (err) { return err.message; }
    };

    const handleApprove = async (id, feedback) => {
        try {
            const res = await fetch(`${API_BASE}/task-reports/${id}/approve`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ feedback }) });
            if (!res.ok) { showToast('Failed to approve', 'error'); return; }
            setReports(prev => prev.map(r => r.id === id ? { ...r, status: 'approved', feedback } : r));
            showToast('Report approved');
        } catch (err) { showToast(err.message, 'error'); }
    };

    const handleReject = async (id, feedback) => {
        try {
            const res = await fetch(`${API_BASE}/task-reports/${id}/reject`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ feedback }) });
            if (!res.ok) { showToast('Failed to reject', 'error'); return; }
            setReports(prev => prev.map(r => r.id === id ? { ...r, status: 'rejected', feedback } : r));
            showToast('Report rejected');
        } catch (err) { showToast(err.message, 'error'); }
    };

    const handleDelete = async () => {
        if (!deleteReport) return;
        try {
            const res = await fetch(`${API_BASE}/task-reports/${deleteReport.id}`, { method: 'DELETE', headers: authHeaders() });
            if (!res.ok) { showToast('Failed to delete', 'error'); return; }
            setReports(prev => prev.filter(r => r.id !== deleteReport.id));
            setDeleteReport(null);
            showToast('Report deleted');
        } catch (err) { showToast(err.message, 'error'); }
    };

    const exportCSV = () => {
        const rows = [['Title', 'Author', 'Status', 'Hours', 'Submitted', 'Task'], ...reports.map(r => [r.title, r.author_name || '', r.status, r.hours_spent || '', new Date(r.created_at || r.createdAt).toLocaleDateString(), r.task_title || ''])];
        const csv  = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a'); a.href = url; a.download = 'reports.csv'; a.click();
        URL.revokeObjectURL(url);
        showToast('Reports exported');
    };

    // Filtered reports
    const filtered = reports.filter(r => {
        const matchTab    = tab === 'all' || (tab === 'mine' && (r.author_id === user?.id || r.submitted_by === user?.id)) || (tab === 'review' && r.status === 'pending' && canReview);
        const matchSearch = !search || r.title.toLowerCase().includes(search.toLowerCase()) || (r.summary || '').toLowerCase().includes(search.toLowerCase());
        const matchStatus = statusFilter === 'all' || r.status === statusFilter;
        return matchTab && matchSearch && matchStatus;
    });

    // Stats
    const totalReports   = reports.length;
    const pendingReports = reports.filter(r => r.status === 'pending').length;
    const approvedReports = reports.filter(r => r.status === 'approved').length;
    const draftReports   = reports.filter(r => r.status === 'draft').length;

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '14px' }}>
            <Spinner size={28} /><span style={{ color: t.textMuted, fontSize: '14px' }}>Loading reports…</span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );

    return (
        <div style={{ padding: '24px 28px', maxWidth: '1200px', margin: '0 auto', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

            {/* Toast */}
            {toast && (
                <div style={{ position: 'fixed', top: '20px', right: '24px', zIndex: 3000, background: toast.type === 'error' ? t.dangerBg : t.successBg, border: `1px solid ${toast.type === 'error' ? t.dangerBorder : t.successBorder}`, color: toast.type === 'error' ? t.dangerText : t.successText, padding: '12px 18px', borderRadius: '12px', fontSize: '13px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 3000 }}>
                    {toast.type === 'error' ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />} {toast.msg}
                </div>
            )}

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: t.textPrimary, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FileText size={22} color="#6366f1" /> Report Management
                    </h1>
                    <p style={{ margin: '5px 0 0', fontSize: '13px', color: t.textMuted }}>Submit, review, and track task completion reports</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={exportCSV} style={{ padding: '9px 14px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '9px', color: t.textSecondary, fontSize: '12px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Download size={13} /> Export</button>
                    <button onClick={() => setShowSubmit(true)} style={{ padding: '9px 18px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: '9px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', boxShadow: '0 3px 12px rgba(99,102,241,0.35)' }}>
                        <Plus size={15} /> New Report
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '20px' }}>
                {[
                    { icon: <FileText size={18} />,     value: totalReports,   label: 'Total Reports',   color: '#6366f1' },
                    { icon: <Clock size={18} />,        value: pendingReports, label: 'Pending Review',  color: '#f59e0b' },
                    { icon: <CheckCircle2 size={18} />, value: approvedReports,label: 'Approved',        color: '#10b981' },
                    { icon: <Edit2 size={18} />,        value: draftReports,   label: 'Drafts',          color: '#64748b' },
                ].map((s, i) => (
                    <div key={i} style={{ background: t.surfacePrimary, border: `1px solid ${t.border}`, borderRadius: '13px', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: `${s.color}18`, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.icon}</div>
                        <div>
                            <div style={{ fontSize: '22px', fontWeight: '700', color: s.color, lineHeight: 1 }}>{s.value}</div>
                            <div style={{ fontSize: '11px', color: t.textMuted, marginTop: '2px' }}>{s.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Pending nudge for admins */}
            {canReview && pendingReports > 0 && (
                <div style={{ marginBottom: '16px' }}>
                    <StatusAlert t={t} type="warning">
                        <Bell size={14} /> <strong>{pendingReports}</strong> report{pendingReports !== 1 ? 's' : ''} awaiting your review.
                        <button onClick={() => setTab('review')} style={{ background: 'none', border: 'none', color: t.warnText, fontSize: '13px', cursor: 'pointer', textDecoration: 'underline', padding: '0 0 0 4px' }}>View now →</button>
                    </StatusAlert>
                </div>
            )}

            {/* Main panel */}
            <div style={{ background: t.surfacePrimary, border: `1px solid ${t.border}`, borderRadius: '15px', overflow: 'hidden' }}>
                {/* Toolbar */}
                <div style={{ padding: '14px 18px', borderBottom: `1px solid ${t.border}`, display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: '2px', background: t.inputBg, borderRadius: '9px', padding: '3px' }}>
                        {[
                            { id: 'all',    label: `All (${reports.length})` },
                            { id: 'mine',   label: 'Mine' },
                            ...(canReview ? [{ id: 'review', label: `Review (${pendingReports})` }] : []),
                        ].map(tb => (
                            <button key={tb.id} onClick={() => setTab(tb.id)}
                                style={{ padding: '6px 13px', background: tab === tb.id ? t.surfacePrimary : 'none', border: tab === tb.id ? `1px solid ${t.border}` : '1px solid transparent', borderRadius: '7px', color: tab === tb.id ? t.textPrimary : t.textMuted, fontSize: '12px', fontWeight: tab === tb.id ? '600' : '400', cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
                                {tb.label}
                            </button>
                        ))}
                    </div>

                    {/* Search */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 12px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '9px', flex: 1, minWidth: '180px', maxWidth: '280px' }}>
                        <Search size={13} color={t.textMuted} />
                        <input type="text" placeholder="Search reports…" value={search} onChange={e => setSearch(e.target.value)}
                            style={{ flex: 1, background: 'none', border: 'none', color: t.textPrimary, fontSize: '13px', outline: 'none' }} />
                        {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', display: 'flex', padding: 0 }}><X size={12} /></button>}
                    </div>

                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                        style={{ padding: '7px 12px', background: t.selectBg, border: `1px solid ${t.border}`, borderRadius: '9px', color: t.selectText, fontSize: '12px', cursor: 'pointer', outline: 'none' }}>
                        <option value="all">All Status</option>
                        {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>

                    <button onClick={fetchReports} style={{ padding: '7px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '9px', color: t.textMuted, cursor: 'pointer', display: 'flex', marginLeft: 'auto' }}><RefreshCw size={14} /></button>
                </div>

                {/* Report list */}
                <div style={{ padding: '16px 18px' }}>
                    {filtered.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '52px 20px' }}>
                            <FileText size={38} color={t.textMuted} />
                            <p style={{ color: t.textMuted, margin: '12px 0 0', fontSize: '14px' }}>
                                {search || statusFilter !== 'all' ? 'No reports match your filters' : 'No reports yet'}
                            </p>
                            <button onClick={() => setShowSubmit(true)} style={{ marginTop: '14px', padding: '9px 18px', background: t.accentBg, border: `1px solid ${t.accentBorder}`, borderRadius: '9px', color: t.accentText, fontSize: '13px', cursor: 'pointer', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <Plus size={14} /> Submit first report
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '10px' }}>
                            {filtered.map(r => (
                                <ReportCard key={r.id} t={t} report={r} onView={setViewReport}
                                    onDelete={setDeleteReport}
                                    canDelete={r.author_id === user?.id || r.submitted_by === user?.id || canReview} />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            {showSubmit && <SubmitModal t={t} tasks={tasks} onClose={() => setShowSubmit(false)} onSubmit={handleSubmit} />}

            {viewReport && (
                <ReportDetailModal t={t} report={viewReport} onClose={() => setViewReport(null)}
                    onApprove={handleApprove} onReject={handleReject} canReview={canReview} />
            )}

            {deleteReport && (
                <div style={{ position: 'fixed', inset: 0, background: t.overlayBg, backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => setDeleteReport(null)}>
                    <div style={{ background: t.modalBg, border: `1px solid ${t.dangerBorder}`, borderRadius: '18px', padding: '28px', width: '90%', maxWidth: '400px', boxShadow: '0 30px 70px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ margin: '0 0 12px', fontSize: '17px', fontWeight: '700', color: t.textPrimary }}>Delete Report?</h3>
                        <p style={{ margin: '0 0 20px', fontSize: '13px', color: t.textSecondary, lineHeight: '1.6' }}>
                            This will permanently delete <strong style={{ color: t.textPrimary }}>"{deleteReport.title}"</strong>.
                        </p>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={() => setDeleteReport(null)} style={{ flex: 1, padding: '9px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '9px', color: t.textSecondary, fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                            <button onClick={handleDelete} style={{ flex: 1, padding: '9px', background: t.dangerBtn, border: 'none', borderRadius: '9px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 3px 10px rgba(220,38,38,0.35)' }}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReportManagement;