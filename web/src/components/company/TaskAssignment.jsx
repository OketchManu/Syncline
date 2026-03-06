// web/src/components/company/TaskAssignment.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { UserPlus, X, Search, Check, AlertCircle, Users, Shield, Briefcase, User, Crown } from 'lucide-react';

const API_BASE   = 'http://localhost:3001/api';
const API_ORIGIN = 'http://localhost:3001';

const resolveAvatar = (a) => {
    if (!a) return null;
    if (a.startsWith('http') || a.startsWith('data:')) return a;
    return `${API_ORIGIN}${a}`;
};

const roleConfig = {
    owner:   { label: 'Owner',   color: '#f59e0b', icon: <Crown size={11} />     },
    admin:   { label: 'Admin',   color: '#6366f1', icon: <Shield size={11} />    },
    manager: { label: 'Manager', color: '#10b981', icon: <Briefcase size={11} /> },
    member:  { label: 'Member',  color: '#94a3b8', icon: <User size={11} />      },
};

const Spinner = ({ size = 16, color = '#6366f1' }) => (
    <div style={{ width: size, height: size, border: `2px solid ${color}30`, borderTop: `2px solid ${color}`, borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
);

const TaskAssignmentModal = ({ task, onClose, onAssigned, dark = true }) => {
    const t = dark ? {
        overlayBg: 'rgba(0,0,0,0.8)', modalBg: '#1e293b',
        border: 'rgba(255,255,255,0.08)', borderMid: 'rgba(255,255,255,0.12)',
        textPrimary: '#fff', textMuted: '#64748b', textSecondary: '#94a3b8',
        inputBg: 'rgba(255,255,255,0.07)',
        accentBg: 'rgba(99,102,241,0.15)', accentBorder: 'rgba(99,102,241,0.3)', accentText: '#a5b4fc',
        errorBg: 'rgba(239,68,68,0.1)', errorBorder: 'rgba(239,68,68,0.3)', errorText: '#fca5a5',
        successBg: 'rgba(16,185,129,0.1)', successBorder: 'rgba(16,185,129,0.3)', successText: '#6ee7b7',
        surfaceCard: 'rgba(255,255,255,0.04)',
    } : {
        overlayBg: 'rgba(0,0,0,0.55)', modalBg: '#ffffff',
        border: 'rgba(0,0,0,0.08)', borderMid: 'rgba(0,0,0,0.12)',
        textPrimary: '#0f172a', textMuted: '#64748b', textSecondary: '#475569',
        inputBg: 'rgba(0,0,0,0.04)',
        accentBg: 'rgba(99,102,241,0.08)', accentBorder: 'rgba(99,102,241,0.25)', accentText: '#4f46e5',
        errorBg: 'rgba(239,68,68,0.06)', errorBorder: 'rgba(239,68,68,0.25)', errorText: '#dc2626',
        successBg: 'rgba(16,185,129,0.07)', successBorder: 'rgba(16,185,129,0.25)', successText: '#059669',
        surfaceCard: 'rgba(0,0,0,0.02)',
    };

    const [members,        setMembers]        = useState([]);
    const [selectedUsers,  setSelectedUsers]  = useState([]);
    const [requireReport,  setRequireReport]  = useState(true);
    const [searchQuery,    setSearchQuery]    = useState('');
    const [loading,        setLoading]        = useState(false);
    const [membersLoading, setMembersLoading] = useState(true);
    const [error,          setError]          = useState('');
    const [success,        setSuccess]        = useState('');

    const authHeaders = useCallback(() => ({
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
    }), []);

    useEffect(() => {
        const loadData = async () => {
            setMembersLoading(true);
            try {
                const [mRes, aRes] = await Promise.all([
                    fetch(`${API_BASE}/company/team?active=true`, { headers: authHeaders() }),
                    task?.id ? fetch(`${API_BASE}/tasks/${task.id}/assignments`, { headers: authHeaders() }) : Promise.resolve(null),
                ]);
                if (mRes.ok) { const d = await mRes.json(); setMembers(d.members || []); }
                if (aRes?.ok) { const d = await aRes.json(); setSelectedUsers((d.assignments || []).map(a => a.user_id)); }
            } catch (err) { console.error(err); }
            setMembersLoading(false);
        };
        loadData();
    }, [task?.id, authHeaders]);

    const toggleUser = (userId) =>
        setSelectedUsers(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);

    const handleAssign = async () => {
        if (selectedUsers.length === 0) { setError('Please select at least one team member'); return; }
        setLoading(true); setError(''); setSuccess('');
        try {
            const res = await fetch(`${API_BASE}/tasks/${task.id}/assign`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ user_ids: selectedUsers, require_report: requireReport }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || 'Failed to assign task'); setLoading(false); return; }
            setSuccess(`Task assigned to ${selectedUsers.length} member(s)!`);
            setTimeout(() => { if (onAssigned) onAssigned(); onClose(); }, 1200);
        } catch (err) { setError(err.message); }
        setLoading(false);
    };

    const filteredMembers = members.filter(m => {
        const name = (m.full_name || m.fullName || '').toLowerCase();
        const q    = searchQuery.toLowerCase();
        return name.includes(q) || m.email.toLowerCase().includes(q);
    });

    return (
        <div style={{ position: 'fixed', inset: 0, background: t.overlayBg, backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1500 }} onClick={onClose}>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{ background: t.modalBg, border: `1px solid ${t.border}`, borderRadius: '20px', width: '90%', maxWidth: '500px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.5)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div style={{ padding: '20px 22px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                        <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: t.accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <UserPlus size={17} color={t.accentText} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: t.textPrimary }}>Assign Task</h3>
                            <p style={{ margin: '2px 0 0', fontSize: '12px', color: t.textMuted, maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task?.title}</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '9px', color: t.textMuted, cursor: 'pointer', padding: '7px', display: 'flex' }}><X size={15} /></button>
                </div>

                {/* Body */}
                <div style={{ padding: '18px 22px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {error   && <div style={{ background: t.errorBg,   border: `1px solid ${t.errorBorder}`,   color: t.errorText,   padding: '9px 13px', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '7px' }}><AlertCircle size={14} /> {error}</div>}
                    {success && <div style={{ background: t.successBg, border: `1px solid ${t.successBorder}`, color: t.successText, padding: '9px 13px', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '7px' }}><Check size={14} /> {success}</div>}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '9px' }}>
                        <Search size={14} color={t.textMuted} />
                        <input type="text" placeholder="Search team members…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            style={{ flex: 1, background: 'none', border: 'none', color: t.textPrimary, fontSize: '13px', outline: 'none' }} />
                        {searchQuery && <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', display: 'flex', padding: 0 }}><X size={12} /></button>}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: t.textMuted }}>{selectedUsers.length} selected</span>
                        {selectedUsers.length > 0 && <button onClick={() => setSelectedUsers([])} style={{ background: 'none', border: 'none', color: t.accentText, fontSize: '12px', cursor: 'pointer', padding: 0, fontWeight: '500' }}>Clear all</button>}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '300px', overflowY: 'auto' }}>
                        {membersLoading ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '28px' }}><Spinner size={22} /></div>
                        ) : filteredMembers.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '28px', color: t.textMuted, fontSize: '13px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                <Users size={28} /> No members found
                            </div>
                        ) : filteredMembers.map(member => {
                            const selected  = selectedUsers.includes(member.id);
                            const name      = member.full_name || member.fullName || member.email;
                            const avatarSrc = resolveAvatar(member.avatar || member.avatar_url);
                            const roleInfo  = roleConfig[member.role] || roleConfig.member;
                            return (
                                <div key={member.id} onClick={() => toggleUser(member.id)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 13px', background: selected ? t.accentBg : t.surfaceCard, border: `1px solid ${selected ? t.accentBorder : t.border}`, borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s' }}>
                                    <div style={{ width: '18px', height: '18px', borderRadius: '5px', background: selected ? '#6366f1' : t.inputBg, border: `2px solid ${selected ? '#6366f1' : t.borderMid}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                                        {selected && <Check size={11} color="#fff" strokeWidth={3} />}
                                    </div>
                                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700', color: '#fff' }}>
                                        {avatarSrc ? <img src={avatarSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : name.charAt(0).toUpperCase()}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: t.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
                                        <p style={{ margin: '1px 0 0', fontSize: '11px', color: t.textMuted }}>{member.email}</p>
                                    </div>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '2px 7px', borderRadius: '20px', fontSize: '10px', fontWeight: '600', background: `${roleInfo.color}20`, color: roleInfo.color, flexShrink: 0 }}>
                                        {roleInfo.icon} {roleInfo.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    <div style={{ padding: '12px 14px', background: t.surfaceCard, border: `1px solid ${t.border}`, borderRadius: '10px' }}>
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }} onClick={() => setRequireReport(!requireReport)}>
                            <div style={{ width: '18px', height: '18px', borderRadius: '5px', background: requireReport ? '#6366f1' : t.inputBg, border: `2px solid ${requireReport ? '#6366f1' : t.borderMid}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px', transition: 'all 0.15s' }}>
                                {requireReport && <Check size={11} color="#fff" strokeWidth={3} />}
                            </div>
                            <div>
                                <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: t.textPrimary }}>Require completion report</p>
                                <p style={{ margin: '2px 0 0', fontSize: '11px', color: t.textMuted }}>Team members must submit a report when this task is completed</p>
                            </div>
                        </label>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '14px 22px', borderTop: `1px solid ${t.border}`, display: 'flex', gap: '10px' }}>
                    <button onClick={onClose} disabled={loading}
                        style={{ flex: 1, padding: '10px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '9px', color: t.textSecondary, fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>
                        Cancel
                    </button>
                    <button onClick={handleAssign} disabled={loading || selectedUsers.length === 0}
                        style={{ flex: 2, padding: '10px', background: loading || !selectedUsers.length ? t.inputBg : 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: '9px', color: loading || !selectedUsers.length ? t.textMuted : '#fff', fontSize: '13px', fontWeight: '600', cursor: !selectedUsers.length ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: !selectedUsers.length ? 0.6 : 1, boxShadow: !selectedUsers.length ? 'none' : '0 3px 12px rgba(99,102,241,0.35)' }}>
                        {loading ? <Spinner size={14} color="#6366f1" /> : <UserPlus size={14} />}
                        {loading ? 'Assigning…' : `Assign to ${selectedUsers.length} member${selectedUsers.length !== 1 ? 's' : ''}`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TaskAssignmentModal;