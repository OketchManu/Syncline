// web/src/components/dashboard/Dashboard.jsx
import React, { useState, useEffect, createContext } from 'react';
import { useAuth } from '../../context/AuthContext';
import { taskAPI } from '../../services/api';
import wsService from '../../services/websocket';
import {
    Plus, Search, CheckCircle2, Clock,
    AlertCircle, Flag, Zap, LogOut, Activity, ListTodo,
    Sun, Moon, Trash2, Bell, X, Edit2
} from 'lucide-react';

// ─── Theme Context ───────────────────────────────────────────────────────────
const ThemeContext = createContext();

const themes = {
    dark: {
        bg: '#0f172a',
        surfacePrimary: '#1e293b',
        surfaceSecondary: 'rgba(30,41,59,0.85)',
        surfaceCard: 'rgba(255,255,255,0.04)',
        border: 'rgba(255,255,255,0.08)',
        borderMid: 'rgba(255,255,255,0.12)',
        text: '#e2e8f0',
        textPrimary: '#fff',
        textMuted: '#64748b',
        textSecondary: '#94a3b8',
        inputBg: 'rgba(255,255,255,0.07)',
        selectBg: '#334155',
        selectText: '#e2e8f0',
        selectOptionBg: '#1e293b',
        selectOptionText: '#e2e8f0',
        hoverSurface: 'rgba(255,255,255,0.06)',
        accentBg: 'rgba(99,102,241,0.15)',
        accentBorder: 'rgba(99,102,241,0.3)',
        accentText: '#a5b4fc',
        overdueBg: 'rgba(239,68,68,0.12)',
        overdueBorder: 'rgba(239,68,68,0.3)',
        overdueText: '#fca5a5',
        notifBg: 'rgba(239,68,68,0.15)',
        notifText: '#fca5a5',
        overlayBg: 'rgba(0,0,0,0.75)',
        modalBg: '#1e293b',
        errorBg: 'rgba(239,68,68,0.1)',
        errorBorder: 'rgba(239,68,68,0.3)',
        errorText: '#fca5a5',
        logoutBg: 'rgba(255,255,255,0.05)',
        logoutColor: '#94a3b8',
        toggleBg: 'rgba(255,255,255,0.08)',
        toggleIcon: '#f59e0b',
    },
    light: {
        bg: '#f1f5f9',
        surfacePrimary: '#ffffff',
        surfaceSecondary: 'rgba(255,255,255,0.95)',
        surfaceCard: 'rgba(0,0,0,0.02)',
        border: 'rgba(0,0,0,0.08)',
        borderMid: 'rgba(0,0,0,0.12)',
        text: '#334155',
        textPrimary: '#0f172a',
        textMuted: '#64748b',
        textSecondary: '#475569',
        inputBg: 'rgba(0,0,0,0.04)',
        selectBg: '#e2e8f0',
        selectText: '#1e293b',
        selectOptionBg: '#fff',
        selectOptionText: '#1e293b',
        hoverSurface: 'rgba(0,0,0,0.04)',
        accentBg: 'rgba(99,102,241,0.08)',
        accentBorder: 'rgba(99,102,241,0.25)',
        accentText: '#4f46e5',
        overdueBg: 'rgba(239,68,68,0.06)',
        overdueBorder: 'rgba(239,68,68,0.25)',
        overdueText: '#dc2626',
        notifBg: 'rgba(239,68,68,0.08)',
        notifText: '#dc2626',
        overlayBg: 'rgba(0,0,0,0.5)',
        modalBg: '#ffffff',
        errorBg: 'rgba(239,68,68,0.06)',
        errorBorder: 'rgba(239,68,68,0.25)',
        errorText: '#dc2626',
        logoutBg: 'rgba(0,0,0,0.05)',
        logoutColor: '#64748b',
        toggleBg: 'rgba(0,0,0,0.07)',
        toggleIcon: '#6366f1',
    }
};

// ─── Dashboard ───────────────────────────────────────────────────────────────
const Dashboard = () => {
    const { user, logout } = useAuth();
    const [dark, setDark] = useState(true);
    const t = dark ? themes.dark : themes.light;

    const [tasks, setTasks] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editTask, setEditTask] = useState(null);
    const [wsConnected, setWsConnected] = useState(false);
    const [recentActivity, setRecentActivity] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState(null); // taskId being updated

    const fetchTasks = async () => {
        try {
            const res = await taskAPI.getAll();
            setTasks(res.data.tasks);
        } catch (err) { console.error('Fetch tasks error:', err); }
    };

    const fetchStats = async () => {
        try {
            const res = await taskAPI.getStats();
            setStats(res.data.stats);
        } catch (err) { console.error('Fetch stats error:', err); }
    };

    const addActivity = (msg) => {
        setRecentActivity(prev => [{ id: Date.now(), message: msg, timestamp: new Date() }, ...prev].slice(0, 10));
    };

    const addNotification = (title, message, type = 'info') => {
        setNotifications(prev => [{ id: Date.now(), title, message, type, read: false }, ...prev].slice(0, 20));
    };

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            await Promise.all([fetchTasks(), fetchStats()]);
            setLoading(false);
        };
        load();

        const onConnection = (data) => setWsConnected(data.connected);
        const onCreated = (data) => {
            setTasks(prev => [data.task, ...prev]);
            addActivity(`${data.creator?.fullName || data.creator?.email} created "${data.task.title}"`);
            addNotification('New Task', `"${data.task.title}" was created`, 'info');
            fetchStats();
        };
        const onUpdated = (data) => {
            setTasks(prev => prev.map(t => t.id === data.task.id ? data.task : t));
            addActivity(`${data.updater?.fullName || data.updater?.email} updated "${data.task.title}"`);
            fetchStats();
        };
        const onStatusChanged = (data) => {
            setTasks(prev => prev.map(t => t.id === data.task.id ? data.task : t));
            addActivity(`"${data.title}" moved to ${data.newStatus}`);
            fetchStats();
        };
        const onDeleted = (data) => {
            setTasks(prev => prev.filter(t => t.id !== data.taskId));
            addActivity(`Task deleted by ${data.deleter?.fullName || data.deleter?.email}`);
            fetchStats();
        };
        const onFlagged = (data) => {
            setTasks(prev => prev.map(t => t.id === data.task.id ? data.task : t));
            addActivity(`"${data.task.title}" was flagged: ${data.reason}`);
            addNotification('Task Flagged', `"${data.task.title}": ${data.reason}`, 'warning');
        };

        wsService.on('connection', onConnection);
        wsService.on('task:created', onCreated);
        wsService.on('task:updated', onUpdated);
        wsService.on('task:status_changed', onStatusChanged);
        wsService.on('task:deleted', onDeleted);
        wsService.on('task:flagged', onFlagged);

        return () => {
            wsService.off('connection', onConnection);
            wsService.off('task:created', onCreated);
            wsService.off('task:updated', onUpdated);
            wsService.off('task:status_changed', onStatusChanged);
            wsService.off('task:deleted', onDeleted);
            wsService.off('task:flagged', onFlagged);
        };
    }, []);

    const filteredTasks = tasks.filter(task => {
        const matchesFilter = filter === 'all' || task.status === filter;
        const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (task.description || '').toLowerCase().includes(searchQuery.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const updateTaskStatus = async (taskId, newStatus) => {
        setUpdatingStatus(taskId);
        try { await taskAPI.update(taskId, { status: newStatus }); }
        catch (err) { console.error('Update error:', err); }
        finally { setUpdatingStatus(null); }
    };

    const deleteTask = async (taskId, title) => {
        if (!window.confirm(`Delete "${title}"? This can't be undone.`)) return;
        try {
            await taskAPI.delete(taskId);
            setTasks(prev => prev.filter(t => t.id !== taskId));
            addActivity(`You deleted "${title}"`);
            fetchStats();
        } catch (err) { console.error('Delete error:', err); }
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    if (loading) {
        return (
            <ThemeContext.Provider value={{ t, dark }}>
                <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: t.bg }}>
                    <div style={{ width: '48px', height: '48px', border: `4px solid ${dark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.15)'}`, borderTop: '4px solid #6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
                    <p style={{ color: t.textMuted, marginTop: '20px', fontSize: '15px' }}>Loading Syncline...</p>
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
                    button:hover { opacity: 0.85; }
                    ::-webkit-scrollbar { width: 6px; }
                    ::-webkit-scrollbar-track { background: transparent; }
                    ::-webkit-scrollbar-thumb { background: ${t.borderMid}; border-radius: 3px; }
                `}</style>

                {/* Header */}
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 32px', background: t.surfaceSecondary, backdropFilter: 'blur(20px)', borderBottom: `1px solid ${t.border}`, position: 'sticky', top: 0, zIndex: 100, transition: 'background 0.3s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Zap size={26} color="#6366f1" />
                            <h1 style={{ fontSize: '21px', fontWeight: '700', margin: 0, color: t.textPrimary }}>Syncline</h1>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px', background: t.toggleBg, borderRadius: '16px', border: `1px solid ${t.border}` }}>
                            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: wsConnected ? '#10b981' : '#ef4444' }}></div>
                            <span style={{ fontSize: '11px', color: t.textSecondary, fontWeight: '500' }}>{wsConnected ? 'Live' : 'Offline'}</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* Theme toggle */}
                        <button onClick={() => setDark(!dark)} style={{ padding: '7px', background: t.toggleBg, border: `1px solid ${t.border}`, borderRadius: '9px', color: t.toggleIcon, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                            {dark ? <Sun size={17} /> : <Moon size={17} />}
                        </button>

                        {/* Notification bell */}
                        <div style={{ position: 'relative' }}>
                            <button onClick={() => setShowNotifications(!showNotifications)} style={{ padding: '7px', background: t.toggleBg, border: `1px solid ${t.border}`, borderRadius: '9px', color: t.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                                <Bell size={17} />
                                {unreadCount > 0 && (
                                    <span style={{ position: 'absolute', top: '2px', right: '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#ef4444', color: '#fff', fontSize: '9px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${t.bg}` }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
                                )}
                            </button>

                            {/* Notifications panel */}
                            {showNotifications && (
                                <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '300px', background: t.modalBg, border: `1px solid ${t.border}`, borderRadius: '12px', boxShadow: '0 12px 40px rgba(0,0,0,0.25)', zIndex: 200, overflow: 'hidden' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: `1px solid ${t.border}` }}>
                                        <span style={{ fontSize: '14px', fontWeight: '600', color: t.textPrimary }}>Notifications</span>
                                        <button onClick={() => { setNotifications(prev => prev.map(n => ({ ...n, read: true }))); }} style={{ background: 'none', border: 'none', color: t.accentText, fontSize: '11px', cursor: 'pointer', fontWeight: '500' }}>Mark all read</button>
                                    </div>
                                    <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                                        {notifications.length === 0 ? (
                                            <p style={{ fontSize: '13px', color: t.textMuted, textAlign: 'center', padding: '24px 16px', margin: 0 }}>No notifications yet</p>
                                        ) : notifications.map(n => (
                                            <div key={n.id} style={{ padding: '12px 16px', borderBottom: `1px solid ${t.border}`, background: n.read ? 'transparent' : (n.type === 'warning' ? t.notifBg : t.accentBg), transition: 'background 0.2s' }}>
                                                <p style={{ margin: '0 0 3px', fontSize: '13px', fontWeight: n.read ? '400' : '600', color: t.textPrimary }}>{n.title}</p>
                                                <p style={{ margin: 0, fontSize: '12px', color: t.textMuted, lineHeight: '1.4' }}>{n.message}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* User info */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700', color: '#fff' }}>
                                {(user?.fullName || user?.email || '?').charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div style={{ fontSize: '13px', fontWeight: '600', color: t.textPrimary }}>{user?.fullName || user?.email}</div>
                                <div style={{ fontSize: '10px', color: t.textMuted, textTransform: 'capitalize' }}>{user?.role}</div>
                            </div>
                        </div>
                        <button onClick={logout} style={{ padding: '7px', background: t.logoutBg, border: `1px solid ${t.border}`, borderRadius: '9px', color: t.logoutColor, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <LogOut size={17} />
                        </button>
                    </div>
                </header>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', padding: '22px 32px 0', maxWidth: '1400px', margin: '0 auto' }}>
                    {[
                        { icon: <ListTodo size={22} />, value: stats?.total || 0, label: 'Total Tasks', color: '#6366f1' },
                        { icon: <Clock size={22} />, value: stats?.in_progress || 0, label: 'In Progress', color: '#f59e0b' },
                        { icon: <CheckCircle2 size={22} />, value: stats?.completed || 0, label: 'Completed', color: '#10b981' },
                        { icon: <AlertCircle size={22} />, value: stats?.overdue || 0, label: 'Overdue', color: '#ef4444' }
                    ].map((s, i) => (
                        <div key={i} style={{ background: t.surfacePrimary, border: `1px solid ${t.border}`, borderRadius: '13px', padding: '18px', display: 'flex', alignItems: 'center', gap: '14px', transition: 'background 0.3s' }}>
                            <div style={{ width: '44px', height: '44px', borderRadius: '11px', background: `${s.color}18`, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.icon}</div>
                            <div>
                                <div style={{ fontSize: '26px', fontWeight: '700', color: t.textPrimary, lineHeight: 1 }}>{s.value}</div>
                                <div style={{ fontSize: '11px', color: t.textMuted, marginTop: '3px' }}>{s.label}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Main */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 310px', gap: '18px', padding: '18px 32px 36px', maxWidth: '1400px', margin: '0 auto' }}>
                    {/* Tasks Panel */}
                    <div style={{ background: t.surfacePrimary, border: `1px solid ${t.border}`, borderRadius: '15px', padding: '22px', transition: 'background 0.3s' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                            <h2 style={{ fontSize: '17px', fontWeight: '600', color: t.textPrimary, margin: 0 }}>Tasks</h2>
                            <button style={{ padding: '9px 18px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: '9px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', boxShadow: '0 3px 12px rgba(99,102,241,0.35)' }} onClick={() => setShowCreateModal(true)}>
                                <Plus size={16} /><span>New Task</span>
                            </button>
                        </div>

                        {/* Search */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '9px 13px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '9px', marginBottom: '10px', transition: 'background 0.3s' }}>
                            <Search size={16} color={t.textMuted} />
                            <input type="text" placeholder="Search tasks..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ flex: 1, background: 'none', border: 'none', color: t.textPrimary, fontSize: '13px', outline: 'none' }} />
                        </div>

                        {/* Filters */}
                        <div style={{ display: 'flex', gap: '7px', marginBottom: '18px', flexWrap: 'wrap' }}>
                            {['all', 'pending', 'in_progress', 'completed', 'blocked'].map(s => (
                                <button key={s} style={{ padding: '6px 13px', background: filter === s ? t.accentBg : t.inputBg, border: `1px solid ${filter === s ? t.accentBorder : t.border}`, borderRadius: '18px', color: filter === s ? t.accentText : t.textSecondary, fontSize: '11px', fontWeight: '500', cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.2s' }} onClick={() => setFilter(s)}>
                                    {s.replace('_', ' ')}
                                </button>
                            ))}
                        </div>

                        {/* Task List */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', maxHeight: '500px', overflowY: 'auto' }}>
                            {filteredTasks.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '56px 20px' }}>
                                    <ListTodo size={44} color={t.textMuted} />
                                    <p style={{ color: t.textMuted, margin: '10px 0', fontSize: '14px' }}>No tasks found</p>
                                    <button style={{ padding: '9px 18px', background: t.accentBg, border: `1px solid ${t.accentBorder}`, borderRadius: '8px', color: t.accentText, fontSize: '13px', cursor: 'pointer', fontWeight: '500' }} onClick={() => setShowCreateModal(true)}>
                                        Create your first task
                                    </button>
                                </div>
                            ) : filteredTasks.map(task => (
                                <TaskCard key={task.id} task={task} t={t} dark={dark} onStatusChange={updateTaskStatus} onDelete={deleteTask} onEdit={() => setEditTask(task)} updatingStatus={updatingStatus} />
                            ))}
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div style={{ background: t.surfacePrimary, border: `1px solid ${t.border}`, borderRadius: '15px', padding: '22px', height: 'fit-content', position: 'sticky', top: '74px', transition: 'background 0.3s' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '18px' }}>
                            <Activity size={18} color="#6366f1" />
                            <h3 style={{ fontSize: '14px', fontWeight: '600', color: t.textPrimary, margin: 0 }}>Live Activity</h3>
                            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: wsConnected ? '#10b981' : '#ef4444', marginLeft: 'auto' }}></div>
                        </div>
                        <div style={{ maxHeight: '480px', overflowY: 'auto' }}>
                            {recentActivity.length === 0 ? (
                                <p style={{ fontSize: '12px', color: t.textMuted, textAlign: 'center', padding: '28px 0', lineHeight: '1.5', margin: 0 }}>Activity will appear here in real-time</p>
                            ) : recentActivity.map(a => (
                                <div key={a.id} style={{ display: 'flex', gap: '9px', marginBottom: '13px' }}>
                                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#6366f1', marginTop: '6px', flexShrink: 0 }}></div>
                                    <div>
                                        <p style={{ fontSize: '12px', color: t.text, margin: '0 0 2px', lineHeight: '1.4' }}>{a.message}</p>
                                        <p style={{ fontSize: '10px', color: t.textMuted, margin: 0 }}>{new Date(a.timestamp).toLocaleTimeString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Create Modal */}
                {showCreateModal && (
                    <TaskModal t={t} dark={dark} title="Create New Task" onClose={() => setShowCreateModal(false)} onSave={async (data) => {
                        try {
                            await taskAPI.create(data);
                            setShowCreateModal(false);
                            fetchTasks();
                            fetchStats();
                        } catch (err) { return err.response?.data?.error || 'Failed to create task'; }
                    }} />
                )}

                {/* Edit Modal */}
                {editTask && (
                    <TaskModal t={t} dark={dark} title="Edit Task" initialData={editTask} onClose={() => setEditTask(null)} onSave={async (data) => {
                        try {
                            await taskAPI.update(editTask.id, data);
                            setEditTask(null);
                            fetchTasks();
                            fetchStats();
                        } catch (err) { return err.response?.data?.error || 'Failed to update task'; }
                    }} />
                )}

                {/* Close notifications on outside click */}
                {showNotifications && <div onClick={() => setShowNotifications(false)} style={{ position: 'fixed', inset: 0, zIndex: 150 }}></div>}
            </div>
        </ThemeContext.Provider>
    );
};

// ─── TaskCard ─────────────────────────────────────────────────────────────────
const TaskCard = ({ task, t, dark, onStatusChange, onDelete, onEdit, updatingStatus }) => {
    const statusColor = { pending: '#f59e0b', in_progress: '#3b82f6', completed: '#10b981', blocked: '#ef4444' };
    const priorityColor = { low: '#64748b', medium: '#f59e0b', high: '#ef4444', urgent: '#dc2626' };

    const isOverdue = task.deadline && task.status !== 'completed' && new Date(task.deadline) < new Date();
    const isUpdating = updatingStatus === task.id;

    return (
        <div style={{ background: isOverdue ? t.overdueBg : t.surfaceCard, border: `1px solid ${isOverdue ? t.overdueBorder : t.border}`, borderRadius: '11px', padding: '14px', transition: 'all 0.2s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', color: t.textPrimary, margin: 0, lineHeight: '1.3' }}>{task.title}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    {task.flagged && <Flag size={14} color="#ef4444" fill="#ef4444" />}
                    <button onClick={onEdit} style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }} title="Edit">
                        <Edit2 size={13} />
                    </button>
                    <button onClick={() => onDelete(task.id, task.title)} style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }} title="Delete">
                        <Trash2 size={13} />
                    </button>
                </div>
            </div>

            {task.description && <p style={{ fontSize: '12px', color: t.textMuted, margin: '5px 0 0', lineHeight: '1.45' }}>{task.description}</p>}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                    <span style={{ padding: '2px 9px', borderRadius: '18px', fontSize: '10px', fontWeight: '600', textTransform: 'capitalize', background: `${statusColor[task.status]}20`, color: statusColor[task.status] }}>
                        {task.status.replace('_', ' ')}
                    </span>
                    <span style={{ padding: '2px 9px', borderRadius: '18px', fontSize: '10px', fontWeight: '600', textTransform: 'capitalize', background: `${priorityColor[task.priority]}20`, color: priorityColor[task.priority] }}>
                        {task.priority}
                    </span>
                </div>
                <select
                    value={task.status}
                    onChange={(e) => onStatusChange(task.id, e.target.value)}
                    disabled={isUpdating}
                    style={{
                        padding: '4px 9px',
                        background: t.selectBg,
                        border: `1px solid ${t.borderMid}`,
                        borderRadius: '6px',
                        color: t.selectText,
                        fontSize: '11px',
                        cursor: isUpdating ? 'wait' : 'pointer',
                        outline: 'none',
                        transition: 'all 0.2s',
                        opacity: isUpdating ? 0.6 : 1
                    }}
                >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="blocked">Blocked</option>
                </select>
            </div>

            <div style={{ marginTop: '8px', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                {task.assignee_name && (
                    <span style={{ fontSize: '11px', color: t.textMuted }}>👤 {task.assignee_name}</span>
                )}
                {task.deadline && (
                    <span style={{ fontSize: '11px', color: isOverdue ? t.overdueText : t.textMuted, fontWeight: isOverdue ? '600' : '400' }}>
                        {isOverdue ? '⚠️ Overdue: ' : '📅 Due: '}{new Date(task.deadline).toLocaleDateString()}
                    </span>
                )}
            </div>
        </div>
    );
};

// ─── TaskModal (shared for Create & Edit) ────────────────────────────────────
const TaskModal = ({ t, dark, title, initialData, onClose, onSave }) => {
    const [formTitle, setFormTitle] = useState(initialData?.title || '');
    const [description, setDescription] = useState(initialData?.description || '');
    const [priority, setPriority] = useState(initialData?.priority || 'medium');
    const [deadline, setDeadline] = useState(initialData?.deadline ? new Date(initialData.deadline).toISOString().split('T')[0] : '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        const err = await onSave({ title: formTitle, description, priority, deadline: deadline || null });
        if (err) setError(err);
        setLoading(false);
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: t.overlayBg, backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
            <div style={{ background: t.modalBg, border: `1px solid ${t.border}`, borderRadius: '16px', padding: '28px', width: '90%', maxWidth: '500px', boxShadow: '0 25px 60px rgba(0,0,0,0.4)', transition: 'background 0.3s' }} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: '600', color: t.textPrimary, margin: 0 }}>{title}</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.textMuted, fontSize: '20px', cursor: 'pointer', padding: '2px 6px', borderRadius: '6px', lineHeight: 1 }}>
                        <X size={18} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <label style={{ fontSize: '12px', fontWeight: '500', color: t.textSecondary, display: 'block', marginBottom: '5px' }}>Title *</label>
                        <input type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Enter task title" required style={{ width: '100%', padding: '9px 12px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '9px', fontSize: '13px', color: t.textPrimary, boxSizing: 'border-box', transition: 'border-color 0.2s, box-shadow 0.2s' }} />
                    </div>
                    <div>
                        <label style={{ fontSize: '12px', fontWeight: '500', color: t.textSecondary, display: 'block', marginBottom: '5px' }}>Description</label>
                        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the task..." style={{ width: '100%', minHeight: '88px', padding: '9px 12px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '9px', fontSize: '13px', color: t.textPrimary, resize: 'vertical', boxSizing: 'border-box', transition: 'border-color 0.2s, box-shadow 0.2s' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                        <div>
                            <label style={{ fontSize: '12px', fontWeight: '500', color: t.textSecondary, display: 'block', marginBottom: '5px' }}>Priority</label>
                            <select value={priority} onChange={(e) => setPriority(e.target.value)} style={{ width: '100%', padding: '9px 12px', background: t.selectBg, border: `1px solid ${t.border}`, borderRadius: '9px', fontSize: '13px', color: t.selectText, boxSizing: 'border-box', cursor: 'pointer', transition: 'border-color 0.2s, box-shadow 0.2s' }}>
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                                <option value="urgent">Urgent</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: '12px', fontWeight: '500', color: t.textSecondary, display: 'block', marginBottom: '5px' }}>Deadline</label>
                            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} style={{ width: '100%', padding: '9px 12px', background: t.selectBg, border: `1px solid ${t.border}`, borderRadius: '9px', fontSize: '13px', color: t.selectText, boxSizing: 'border-box', cursor: 'pointer', transition: 'border-color 0.2s, box-shadow 0.2s' }} />
                        </div>
                    </div>
                    {error && <div style={{ background: t.errorBg, border: `1px solid ${t.errorBorder}`, color: t.errorText, padding: '9px 12px', borderRadius: '8px', fontSize: '12px' }}>⚠️ {error}</div>}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
                        <button type="button" onClick={onClose} style={{ padding: '9px 18px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '9px', color: t.textSecondary, fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                        <button type="submit" disabled={loading} style={{ padding: '9px 22px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: '9px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: loading ? 'wait' : 'pointer', boxShadow: '0 3px 12px rgba(99,102,241,0.35)', opacity: loading ? 0.7 : 1 }}>
                            {loading ? '⏳ Saving...' : (initialData ? '✅ Save Changes' : '✅ Create Task')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Dashboard;