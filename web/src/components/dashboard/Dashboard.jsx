// web/src/components/dashboard/Dashboard.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { taskAPI, userAPI } from '../../services/api';
import { auth } from '../../firebase.js';
import wsService from '../../services/websocket';
import CompanyOnboarding   from '../company/CompanyOnboarding';
import TeamManagement      from '../company/TeamManagement';
import ProgressMonitor     from '../company/ProgressMonitor';
import ReportManagement    from '../company/ReportManagement';
import TaskAssignmentModal from '../company/TaskAssignment';
import {
    Plus, Search, CheckCircle2, Clock, AlertCircle, Flag, Zap, LogOut,
    Activity, ListTodo, Sun, Moon, Trash2, Bell, X, Edit2, WifiOff, Wifi,
    User, Camera, Shield, Smartphone, Save, Eye, EyeOff,
    AlertTriangle, Building2, Users, TrendingUp, FileText, LayoutDashboard,
    ChevronLeft, Lock, ArrowRight, Sparkles, Menu, ChevronDown, UserPlus
} from 'lucide-react';

const API_ORIGIN = 'https://syncline-1.onrender.com';

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

// ── Theme tokens ──────────────────────────────────────────────────────────────
const PERSONAL = {
    bg:'#05080f', surface:'#0a0f1e', surfaceRaised:'#0f1628',
    card:'rgba(255,255,255,0.025)', cardHover:'rgba(255,255,255,0.045)',
    border:'rgba(255,255,255,0.06)', borderMid:'rgba(255,255,255,0.1)', borderStrong:'rgba(255,255,255,0.16)',
    textPrimary:'#f0f4ff', text:'#94a3b8', textMuted:'#3d4f6e',
    accent:'#7c3aed', accentLight:'#a78bfa', accentBg:'rgba(124,58,237,0.1)', accentBorder:'rgba(124,58,237,0.25)',
    accentGrad:'linear-gradient(135deg,#7c3aed 0%,#5b21b6 100%)',
    success:'#10b981', successBg:'rgba(16,185,129,0.1)', successBorder:'rgba(16,185,129,0.2)',
    warning:'#f59e0b', warningBg:'rgba(245,158,11,0.1)', warningBorder:'rgba(245,158,11,0.2)',
    danger:'#ef4444', dangerBg:'rgba(239,68,68,0.1)', dangerBorder:'rgba(239,68,68,0.22)',
    info:'#3b82f6', infoBg:'rgba(59,130,246,0.1)', infoBorder:'rgba(59,130,246,0.2)',
    inputBg:'rgba(255,255,255,0.04)', selectBg:'#0f1628', modalBg:'#080d1a', overlay:'rgba(0,0,0,0.85)',
    sidebarBg:'#080d1a', sidebarBorder:'rgba(255,255,255,0.05)',
    sidebarActive:'rgba(124,58,237,0.14)', sidebarActiveBorder:'rgba(124,58,237,0.4)',
    online:'#10b981', onlineBg:'rgba(16,185,129,0.12)',
    offline:'#ef4444', offlineBg:'rgba(239,68,68,0.12)',
    modeLabel:'Personal', modeIcon:'👤',
};
const COMPANY = {
    ...PERSONAL,
    accent:'#0ea5e9', accentLight:'#38bdf8', accentBg:'rgba(14,165,233,0.1)', accentBorder:'rgba(14,165,233,0.25)',
    accentGrad:'linear-gradient(135deg,#0ea5e9 0%,#0284c7 100%)',
    sidebarActive:'rgba(14,165,233,0.12)', sidebarActiveBorder:'rgba(14,165,233,0.4)',
    modeLabel:'Company', modeIcon:'🏢',
};
const LIGHT_PERSONAL = {
    bg:'#f5f3ff', surface:'#ffffff', surfaceRaised:'#faf9ff',
    card:'rgba(0,0,0,0.02)', cardHover:'rgba(0,0,0,0.04)',
    border:'rgba(0,0,0,0.07)', borderMid:'rgba(0,0,0,0.12)', borderStrong:'rgba(0,0,0,0.2)',
    textPrimary:'#0f0a1e', text:'#4c5577', textMuted:'#9fa6c0',
    accent:'#7c3aed', accentLight:'#6d28d9', accentBg:'rgba(124,58,237,0.06)', accentBorder:'rgba(124,58,237,0.18)',
    accentGrad:'linear-gradient(135deg,#7c3aed 0%,#5b21b6 100%)',
    success:'#059669', successBg:'rgba(5,150,105,0.07)', successBorder:'rgba(5,150,105,0.2)',
    warning:'#d97706', warningBg:'rgba(217,119,6,0.07)', warningBorder:'rgba(217,119,6,0.2)',
    danger:'#dc2626', dangerBg:'rgba(220,38,38,0.06)', dangerBorder:'rgba(220,38,38,0.18)',
    info:'#2563eb', infoBg:'rgba(37,99,235,0.07)', infoBorder:'rgba(37,99,235,0.2)',
    inputBg:'rgba(0,0,0,0.03)', selectBg:'#f5f3ff', modalBg:'#ffffff', overlay:'rgba(0,0,0,0.5)',
    sidebarBg:'#ffffff', sidebarBorder:'rgba(0,0,0,0.06)',
    sidebarActive:'rgba(124,58,237,0.07)', sidebarActiveBorder:'rgba(124,58,237,0.3)',
    online:'#059669', onlineBg:'rgba(5,150,105,0.09)',
    offline:'#dc2626', offlineBg:'rgba(220,38,38,0.09)',
    modeLabel:'Personal', modeIcon:'👤',
};
const LIGHT_COMPANY = {
    ...LIGHT_PERSONAL,
    bg:'#f0f9ff',
    accent:'#0ea5e9', accentLight:'#0284c7', accentBg:'rgba(14,165,233,0.06)', accentBorder:'rgba(14,165,233,0.18)',
    accentGrad:'linear-gradient(135deg,#0ea5e9 0%,#0284c7 100%)',
    sidebarActive:'rgba(14,165,233,0.07)', sidebarActiveBorder:'rgba(14,165,233,0.3)',
    modeLabel:'Company', modeIcon:'🏢',
};

const STATUS_COLOR  = { pending:'#f59e0b', in_progress:'#3b82f6', completed:'#10b981', blocked:'#ef4444' };
const PRIORITY_COLOR = { low:'#64748b', medium:'#f59e0b', high:'#ef4444', urgent:'#dc2626' };
const STATUS_LABEL  = { pending:'Pending', in_progress:'In Progress', completed:'Completed', blocked:'Blocked' };

// ── Primitive UI components ───────────────────────────────────────────────────
const Pill = ({ color, children }) => (
    <span style={{ padding:'2px 7px', borderRadius:'20px', fontSize:'10px', fontWeight:'700',
        background:`${color}20`, color, display:'inline-block', letterSpacing:'0.02em' }}>
        {children}
    </span>
);

const Btn = ({ t, children, variant='primary', size='md', disabled, onClick, style:sx={}, ...rest }) => {
    const pad = { sm:'5px 11px', md:'9px 18px', lg:'12px 24px' }[size];
    const bg  = variant==='primary' ? t.accentGrad : variant==='danger' ? t.dangerBg : 'transparent';
    const bdr = variant==='primary' ? 'transparent' : variant==='danger' ? t.dangerBorder : t.border;
    const clr = variant==='primary' ? '#fff' : variant==='danger' ? t.danger : t.text;
    return (
        <button onClick={onClick} disabled={disabled} {...rest} style={{
            padding:bg, background:bg, border:`1px solid ${bdr}`, borderRadius:'8px', color:clr,
            fontSize:size==='sm'?'11px':'13px', fontWeight:'600',
            cursor:disabled?'not-allowed':'pointer', opacity:disabled?0.5:1,
            display:'inline-flex', alignItems:'center', gap:'6px', transition:'all 0.15s',
            boxShadow:variant==='primary'&&!disabled?`0 4px 14px ${t.accent}40`:'none',
            // eslint-disable-next-line no-dupe-keys
            fontFamily:'inherit', padding:pad, ...sx,
        }}>{children}</button>
    );
};

const Input = ({ t, label, ...props }) => (
    <div>
        {label && <label style={{ display:'block', fontSize:'11px', fontWeight:'600', color:t.textMuted,
            marginBottom:'5px', letterSpacing:'0.06em', textTransform:'uppercase' }}>{label}</label>}
        <input {...props} style={{ width:'100%', padding:'10px 12px', background:t.inputBg,
            border:`1px solid ${t.border}`, borderRadius:'8px', fontSize:'13px', color:t.textPrimary,
            boxSizing:'border-box', fontFamily:'inherit', outline:'none', ...(props.style||{}) }} />
    </div>
);

const Alert = ({ t, type, children }) => {
    const map = { error:[t.dangerBg,t.dangerBorder,t.danger], success:[t.successBg,t.successBorder,t.success], warning:[t.warningBg,t.warningBorder,t.warning], info:[t.infoBg,t.infoBorder,t.info] };
    const [bg,border,color] = map[type]||map.info;
    return (
        <div style={{ display:'flex', alignItems:'flex-start', gap:'8px', padding:'10px 13px',
            background:bg, border:`1px solid ${border}`, borderRadius:'8px',
            fontSize:'12px', color, lineHeight:1.5 }}>
            {children}
        </div>
    );
};

const StatCard = ({ t, icon, value, label, color }) => (
    <div style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:'12px',
        padding:'14px', display:'flex', alignItems:'center', gap:'10px',
        position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:0, right:0, width:'60px', height:'60px', borderRadius:'50%',
            background:`radial-gradient(circle at 70% 30%,${color}18,transparent 70%)`, pointerEvents:'none' }} />
        <div style={{ width:'36px', height:'36px', borderRadius:'9px', background:`${color}15`,
            color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            {icon}
        </div>
        <div style={{ minWidth:0 }}>
            <div style={{ fontSize:'clamp(15px,3.5vw,22px)', fontWeight:'800', color:t.textPrimary,
                lineHeight:1, fontVariantNumeric:'tabular-nums' }}>{value}</div>
            <div style={{ fontSize:'10px', color:t.textMuted, marginTop:'2px', fontWeight:'500',
                whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{label}</div>
        </div>
    </div>
);

// ── Modals ────────────────────────────────────────────────────────────────────
const LogoutModal = ({ t, onConfirm, onCancel }) => (
    <div style={{ position:'fixed', inset:0, background:t.overlay, backdropFilter:'blur(10px)',
        display:'flex', alignItems:'center', justifyContent:'center', zIndex:3000, padding:'16px' }}
        onClick={onCancel}>
        <div style={{ background:t.modalBg, border:`1px solid ${t.borderMid}`, borderRadius:'20px',
            padding:'28px', width:'100%', maxWidth:'360px', boxShadow:'0 40px 80px rgba(0,0,0,0.5)' }}
            onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'14px' }}>
                <div style={{ width:'42px', height:'42px', borderRadius:'12px', background:t.dangerBg,
                    border:`1px solid ${t.dangerBorder}`, display:'flex', alignItems:'center',
                    justifyContent:'center', flexShrink:0 }}>
                    <LogOut size={18} color={t.danger} />
                </div>
                <div>
                    <h3 style={{ margin:0, fontSize:'15px', fontWeight:'700', color:t.textPrimary }}>Sign Out</h3>
                    <p style={{ margin:'2px 0 0', fontSize:'11px', color:t.textMuted }}>You'll need to sign in again</p>
                </div>
            </div>
            <p style={{ fontSize:'13px', color:t.text, margin:'0 0 20px', lineHeight:1.6 }}>
                Are you sure you want to sign out of Syncline?
            </p>
            <div style={{ display:'flex', gap:'10px', justifyContent:'flex-end' }}>
                <Btn t={t} variant="ghost" onClick={onCancel}>Stay Signed In</Btn>
                <Btn t={t} onClick={onConfirm}
                    style={{ background:t.danger, color:'#fff', border:'none', boxShadow:`0 4px 14px ${t.danger}40`,
                        padding:'9px 18px', borderRadius:'8px', fontWeight:'600', cursor:'pointer',
                        display:'inline-flex', alignItems:'center', gap:'6px', fontSize:'13px', fontFamily:'inherit' }}>
                    <LogOut size={13} /> Sign Out
                </Btn>
            </div>
        </div>
    </div>
);

const TaskCard = ({ t, task, onStatusChange, onDelete, onEdit, onAssign, updatingStatus, isOnline, canAssign }) => {
    const isOverdue  = task.deadline && task.status !== 'completed' && new Date(task.deadline) < new Date();
    const isUpdating = updatingStatus === task.id;
    return (
        <div style={{ background:isOverdue?t.dangerBg:t.card,
            border:`1px solid ${isOverdue?t.dangerBorder:t.border}`,
            borderRadius:'11px', padding:'11px 13px', transition:'all 0.15s' }}
            onMouseEnter={e=>{if(!isOverdue)e.currentTarget.style.background=t.cardHover;e.currentTarget.style.borderColor=t.borderMid;}}
            onMouseLeave={e=>{if(!isOverdue)e.currentTarget.style.background=t.card;e.currentTarget.style.borderColor=isOverdue?t.dangerBorder:t.border;}}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'8px' }}>
                <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'5px', marginBottom:'3px' }}>
                        {!!task.flagged && <Flag size={11} color={t.danger} fill={t.danger} />}
                        <h3 style={{ fontSize:'13px', fontWeight:'600', color:t.textPrimary, margin:0,
                            lineHeight:1.4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {task.title}
                        </h3>
                    </div>
                    {task.description && (
                        <p style={{ fontSize:'11px', color:t.textMuted, margin:'0 0 6px', lineHeight:1.5,
                            display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                            {task.description}
                        </p>
                    )}
                    <div style={{ display:'flex', gap:'4px', flexWrap:'wrap', alignItems:'center' }}>
                        <Pill color={STATUS_COLOR[task.status]}>{STATUS_LABEL[task.status]}</Pill>
                        <Pill color={PRIORITY_COLOR[task.priority]}>{task.priority}</Pill>
                        {task.assignee_name && <span style={{ fontSize:'10px', color:t.textMuted }}>· {task.assignee_name}</span>}
                        {task.deadline && (
                            <span style={{ fontSize:'10px', color:isOverdue?t.danger:t.textMuted, fontWeight:isOverdue?'700':'400' }}>
                                {isOverdue?'⚠ Overdue · ':' · '}{new Date(task.deadline).toLocaleDateString()}
                            </span>
                        )}
                    </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'1px', flexShrink:0 }}>
                    <select value={task.status} onChange={e=>onStatusChange(task.id,e.target.value)}
                        disabled={isUpdating||!isOnline}
                        style={{ padding:'3px 5px', background:t.selectBg, border:`1px solid ${t.border}`,
                            borderRadius:'5px', color:t.text, fontSize:'9px', cursor:'pointer',
                            fontFamily:'inherit', outline:'none', marginRight:'2px', maxWidth:'82px' }}>
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="blocked">Blocked</option>
                    </select>
                    {canAssign && (
                        <button onClick={onAssign} disabled={!isOnline} title="Assign"
                            style={{ background:'none', border:'none', color:t.textMuted,
                                cursor:isOnline?'pointer':'not-allowed', padding:'5px', display:'flex', borderRadius:'5px' }}
                            onMouseEnter={e=>{e.currentTarget.style.background=t.accentBg;e.currentTarget.style.color=t.accentLight;}}
                            onMouseLeave={e=>{e.currentTarget.style.background='none';e.currentTarget.style.color=t.textMuted;}}>
                            <UserPlus size={12}/>
                        </button>
                    )}
                    <button onClick={onEdit} disabled={!isOnline} title="Edit"
                        style={{ background:'none', border:'none', color:t.textMuted,
                            cursor:isOnline?'pointer':'not-allowed', padding:'5px', display:'flex', borderRadius:'5px' }}
                        onMouseEnter={e=>{e.currentTarget.style.background=t.accentBg;e.currentTarget.style.color=t.accentLight;}}
                        onMouseLeave={e=>{e.currentTarget.style.background='none';e.currentTarget.style.color=t.textMuted;}}>
                        <Edit2 size={12}/>
                    </button>
                    <button onClick={onDelete} disabled={!isOnline} title="Delete"
                        style={{ background:'none', border:'none', color:t.textMuted,
                            cursor:isOnline?'pointer':'not-allowed', padding:'5px', display:'flex', borderRadius:'5px' }}
                        onMouseEnter={e=>{e.currentTarget.style.background=t.dangerBg;e.currentTarget.style.color=t.danger;}}
                        onMouseLeave={e=>{e.currentTarget.style.background='none';e.currentTarget.style.color=t.textMuted;}}>
                        <Trash2 size={12}/>
                    </button>
                </div>
            </div>
        </div>
    );
};

const TaskModal = ({ t, title, initialData, onClose, onSave, isOnline }) => {
    const [formTitle,setFormTitle]=useState(initialData?.title||'');
    const [description,setDescription]=useState(initialData?.description||'');
    const [priority,setPriority]=useState(initialData?.priority||'medium');
    const [deadline,setDeadline]=useState(initialData?.deadline?new Date(initialData.deadline).toISOString().split('T')[0]:'');
    const [loading,setLoading]=useState(false);
    const [error,setError]=useState('');
    const handleSubmit=async(e)=>{
        e.preventDefault();
        if(!formTitle.trim()){setError('Task title is required.');return;}
        setLoading(true);setError('');
        const err=await onSave({title:formTitle.trim(),description,priority,deadline:deadline||null});
        if(err){setError(err);setLoading(false);}
    };
    return (
        <div style={{ position:'fixed',inset:0,background:t.overlay,backdropFilter:'blur(10px)',
            display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:'16px' }}
            onClick={onClose}>
            <div style={{ background:t.modalBg,border:`1px solid ${t.borderMid}`,borderRadius:'18px',
                padding:'22px',width:'100%',maxWidth:'460px',maxHeight:'90vh',overflowY:'auto',
                boxShadow:'0 40px 80px rgba(0,0,0,0.5)' }}
                onClick={e=>e.stopPropagation()}>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'18px' }}>
                    <h2 style={{ fontSize:'16px',fontWeight:'700',color:t.textPrimary,margin:0 }}>{title}</h2>
                    <button onClick={onClose} style={{ background:t.inputBg,border:`1px solid ${t.border}`,
                        borderRadius:'7px',color:t.textMuted,cursor:'pointer',padding:'6px',display:'flex' }}>
                        <X size={14}/>
                    </button>
                </div>
                {!isOnline&&<div style={{marginBottom:'14px'}}><Alert t={t} type="warning"><WifiOff size={13}/> You're offline.</Alert></div>}
                <form onSubmit={handleSubmit} style={{ display:'flex',flexDirection:'column',gap:'14px' }}>
                    <Input t={t} label="Title" type="text" value={formTitle}
                        onChange={e=>setFormTitle(e.target.value)} placeholder="Enter task title" required/>
                    <div>
                        <label style={{ display:'block',fontSize:'11px',fontWeight:'600',color:t.textMuted,
                            marginBottom:'5px',letterSpacing:'0.06em',textTransform:'uppercase' }}>Description</label>
                        <textarea value={description} onChange={e=>setDescription(e.target.value)}
                            placeholder="What needs to be done?" rows={3}
                            style={{ width:'100%',padding:'10px 12px',background:t.inputBg,border:`1px solid ${t.border}`,
                                borderRadius:'8px',fontSize:'13px',color:t.textPrimary,resize:'vertical',
                                boxSizing:'border-box',fontFamily:'inherit',outline:'none'}}/>
                    </div>
                    <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px' }}>
                        <div>
                            <label style={{ display:'block',fontSize:'11px',fontWeight:'600',color:t.textMuted,
                                marginBottom:'5px',letterSpacing:'0.06em',textTransform:'uppercase' }}>Priority</label>
                            <select value={priority} onChange={e=>setPriority(e.target.value)}
                                style={{ width:'100%',padding:'10px 12px',background:t.selectBg,border:`1px solid ${t.border}`,
                                    borderRadius:'8px',fontSize:'13px',color:t.textPrimary,fontFamily:'inherit',outline:'none' }}>
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                                <option value="urgent">Urgent</option>
                            </select>
                        </div>
                        <Input t={t} label="Deadline" type="date" value={deadline}
                            onChange={e=>setDeadline(e.target.value)} style={{background:t.selectBg,color:t.textPrimary}}/>
                    </div>
                    {error&&<Alert t={t} type="error"><AlertCircle size={13}/> {error}</Alert>}
                    <div style={{ display:'flex',justifyContent:'flex-end',gap:'10px' }}>
                        <Btn t={t} variant="ghost" onClick={onClose} type="button">Cancel</Btn>
                        <Btn t={t} variant="primary" disabled={loading||!isOnline} type="submit">
                            {loading?'Saving...':initialData?'Save Changes':'Create Task'}
                        </Btn>
                    </div>
                </form>
            </div>
        </div>
    );
};

const DeleteTaskModal = ({ t, task, onConfirm, onCancel, loading }) => (
    <div style={{ position:'fixed',inset:0,background:t.overlay,backdropFilter:'blur(10px)',
        display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000,padding:'16px' }}
        onClick={()=>!loading&&onCancel()}>
        <div style={{ background:t.modalBg,border:`1px solid ${t.dangerBorder}`,borderRadius:'18px',
            padding:'22px',width:'100%',maxWidth:'360px',boxShadow:'0 40px 80px rgba(0,0,0,0.5)' }}
            onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex',alignItems:'center',gap:'12px',marginBottom:'12px' }}>
                <div style={{ width:'40px',height:'40px',borderRadius:'11px',background:t.dangerBg,
                    border:`1px solid ${t.dangerBorder}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                    <Trash2 size={17} color={t.danger}/>
                </div>
                <div>
                    <h3 style={{ margin:0,fontSize:'15px',fontWeight:'700',color:t.textPrimary }}>Delete Task</h3>
                    <p style={{ margin:'2px 0 0',fontSize:'11px',color:t.textMuted }}>This cannot be undone</p>
                </div>
            </div>
            <p style={{ fontSize:'13px',color:t.text,margin:'0 0 18px',lineHeight:1.6 }}>
                Delete <strong style={{color:t.textPrimary}}>"{task.title}"</strong>?
            </p>
            <div style={{ display:'flex',gap:'10px',justifyContent:'flex-end' }}>
                <Btn t={t} variant="ghost" onClick={onCancel} disabled={loading}>Cancel</Btn>
                <Btn t={t} onClick={onConfirm} disabled={loading}
                    style={{ background:t.danger,color:'#fff',border:'none',padding:'9px 18px',
                        borderRadius:'8px',fontWeight:'600',cursor:loading?'not-allowed':'pointer',
                        display:'inline-flex',alignItems:'center',gap:'6px',fontSize:'13px',fontFamily:'inherit',opacity:loading?0.6:1 }}>
                    <Trash2 size={13}/>{loading?'Deleting...':'Delete'}
                </Btn>
            </div>
        </div>
    </div>
);

const ProfileModal = ({ t, user, onClose, onSave, onDeleteAccount, isOnline }) => {
    const [tab,setTab]=useState('profile');
    const [fullName,setFullName]=useState(user?.fullName||'');
    const [avatarPreview,setAvatarPreview]=useState(resolveAvatar(user?.avatar||user?.avatar_url));
    const [avatarFile,setAvatarFile]=useState(null);
    const [currentPw,setCurrentPw]=useState('');
    const [newPw,setNewPw]=useState('');
    const [confirmPw,setConfirmPw]=useState('');
    const [showCurrent,setShowCurrent]=useState(false);
    const [showNew,setShowNew]=useState(false);
    const [loading,setLoading]=useState(false);
    const [status,setStatus]=useState(null);
    const [deleteConfirm,setDeleteConfirm]=useState('');
    const [deleteStep,setDeleteStep]=useState(1);
    const [deleteError,setDeleteError]=useState('');
    const fileRef=useRef();
    const device=getDeviceInfo();
    const pwStrength=newPw.length===0?0:newPw.length<6?1:newPw.length<8?2:newPw.length<12?3:4;
    const pwColors=['','#ef4444','#f59e0b','#3b82f6','#10b981'];

    const handleAvatarChange=(e)=>{
        const file=e.target.files[0];
        if(!file)return;
        if(file.size>3*1024*1024){setStatus({type:'error',msg:'Image must be under 3 MB'});return;}
        setAvatarFile(file);
        const reader=new FileReader();
        reader.onload=ev=>setAvatarPreview(ev.target.result);
        reader.readAsDataURL(file);
    };
    const saveProfile=async()=>{
        if(!isOnline){setStatus({type:'error',msg:'You are offline.'});return;}
        setLoading(true);setStatus(null);
        const avatarPayload=avatarFile?avatarFile:avatarPreview===null?null:undefined;
        const err=await onSave({fullName,avatar:avatarPayload},'profile',device);
        setLoading(false);
        setStatus(err?{type:'error',msg:err}:{type:'success',msg:'Profile updated!'});
    };
    const savePassword=async()=>{
        if(!isOnline){setStatus({type:'error',msg:'You are offline.'});return;}
        if(newPw!==confirmPw){setStatus({type:'error',msg:'Passwords do not match.'});return;}
        if(newPw.length<8){setStatus({type:'error',msg:'Password must be at least 8 characters.'});return;}
        setLoading(true);setStatus(null);
        const err=await onSave({currentPassword:currentPw,newPassword:newPw},'password',device);
        setLoading(false);
        if(err)setStatus({type:'error',msg:err});
        else{setStatus({type:'success',msg:'Password updated!'});setCurrentPw('');setNewPw('');setConfirmPw('');}
    };
    const doDelete=async()=>{
        if(deleteConfirm!=='DELETE'){setDeleteError('Type DELETE to confirm.');return;}
        setLoading(true);setDeleteError('');
        const result=await onDeleteAccount(device);
        if(result&&!result.success){setDeleteError(result.error||'Failed to delete account.');setLoading(false);}
    };

    const TABS=[{id:'profile',icon:<User size={13}/>,label:'Profile'},{id:'security',icon:<Shield size={13}/>,label:'Security'},{id:'danger',icon:<AlertTriangle size={13}/>,label:'Danger'}];
    return (
        <div style={{ position:'fixed',inset:0,background:t.overlay,backdropFilter:'blur(10px)',
            display:'flex',alignItems:'center',justifyContent:'center',zIndex:1500,padding:'12px' }}
            onClick={onClose}>
            <div style={{ background:t.modalBg,border:`1px solid ${t.borderMid}`,borderRadius:'20px',
                width:'100%',maxWidth:'480px',maxHeight:'92vh',display:'flex',flexDirection:'column',
                boxShadow:'0 50px 100px rgba(0,0,0,0.6)' }}
                onClick={e=>e.stopPropagation()}>
                <div style={{ padding:'18px 20px 0',borderBottom:`1px solid ${t.border}`,flexShrink:0 }}>
                    <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'14px' }}>
                        <div>
                            <h2 style={{ margin:0,fontSize:'16px',fontWeight:'700',color:t.textPrimary }}>Account Settings</h2>
                            <p style={{ margin:'2px 0 0',fontSize:'10px',color:t.textMuted,display:'flex',alignItems:'center',gap:'4px' }}>
                                <Smartphone size={10}/>{device}
                            </p>
                        </div>
                        <button onClick={onClose} style={{ background:t.inputBg,border:`1px solid ${t.border}`,
                            borderRadius:'7px',color:t.textMuted,cursor:'pointer',padding:'6px',display:'flex' }}>
                            <X size={14}/>
                        </button>
                    </div>
                    <div style={{ display:'flex',overflowX:'auto' }}>
                        {TABS.map(tb=>(
                            <button key={tb.id} onClick={()=>{setTab(tb.id);setStatus(null);setDeleteError('');}}
                                style={{ padding:'8px 14px',background:'none',border:'none',whiteSpace:'nowrap',
                                    borderBottom:`2px solid ${tab===tb.id?t.accent:'transparent'}`,
                                    color:tab===tb.id?t.accent:t.textMuted,fontSize:'12px',
                                    fontWeight:tab===tb.id?'700':'400',cursor:'pointer',
                                    display:'flex',alignItems:'center',gap:'5px',fontFamily:'inherit',flexShrink:0 }}>
                                {tb.icon}{tb.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div style={{ padding:'18px 20px',overflowY:'auto',flex:1 }}>
                    {status&&<div style={{marginBottom:'14px'}}><Alert t={t} type={status.type}>
                        {status.type==='success'?<CheckCircle2 size={13}/>:<AlertCircle size={13}/>} {status.msg}
                    </Alert></div>}

                    {tab==='profile'&&(
                        <div style={{ display:'flex',flexDirection:'column',gap:'16px' }}>
                            <div style={{ display:'flex',alignItems:'center',gap:'14px',padding:'14px',
                                background:t.accentBg,border:`1px solid ${t.accentBorder}`,borderRadius:'12px',flexWrap:'wrap' }}>
                                <div style={{ position:'relative',flexShrink:0 }}>
                                    <div style={{ width:'60px',height:'60px',borderRadius:'50%',overflow:'hidden',border:`3px solid ${t.accentBorder}` }}>
                                        {avatarPreview
                                            ?<img src={avatarPreview} alt="av" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                                            :<div style={{width:'100%',height:'100%',background:t.accentGrad,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px',fontWeight:'800',color:'#fff'}}>
                                                {(user?.fullName||user?.email||'?').charAt(0).toUpperCase()}
                                             </div>
                                        }
                                    </div>
                                    <button onClick={()=>fileRef.current.click()}
                                        style={{ position:'absolute',bottom:0,right:0,width:'20px',height:'20px',borderRadius:'50%',
                                            background:t.accent,border:`2px solid ${t.modalBg}`,color:'#fff',cursor:'pointer',
                                            display:'flex',alignItems:'center',justifyContent:'center' }}>
                                        <Camera size={9}/>
                                    </button>
                                    <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleAvatarChange}/>
                                </div>
                                <div style={{flex:1,minWidth:'120px'}}>
                                    <p style={{margin:'0 0 2px',fontSize:'12px',fontWeight:'600',color:t.textPrimary}}>Profile Photo</p>
                                    <p style={{margin:'0 0 8px',fontSize:'11px',color:t.textMuted}}>JPG, PNG &middot; Max 3 MB</p>
                                    <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
                                        <Btn t={t} variant="ghost" size="sm" onClick={()=>fileRef.current.click()}
                                            style={{border:`1px solid ${t.accentBorder}`,color:t.accentLight}}>Upload</Btn>
                                        {avatarPreview&&<Btn t={t} variant="danger" size="sm"
                                            onClick={()=>{setAvatarPreview(null);setAvatarFile(null);}}>Remove</Btn>}
                                    </div>
                                </div>
                            </div>
                            <Input t={t} label="Full Name" type="text" value={fullName}
                                onChange={e=>setFullName(e.target.value)} placeholder="Your full name"/>
                            <div>
                                <Input t={t} label="Email" type="email" value={user?.email||''} readOnly
                                    style={{opacity:0.5,cursor:'not-allowed'}}/>
                                <p style={{margin:'4px 0 0',fontSize:'10px',color:t.textMuted}}>
                                    Email can only be changed via support.
                                </p>
                            </div>
                            <div style={{display:'flex',justifyContent:'flex-end'}}>
                                <Btn t={t} variant="primary" onClick={saveProfile} disabled={loading||!isOnline}>
                                    <Save size={13}/>{loading?'Saving...':'Save Changes'}
                                </Btn>
                            </div>
                        </div>
                    )}

                    {tab==='security'&&(
                        <div style={{ display:'flex',flexDirection:'column',gap:'14px' }}>
                            <Alert t={t} type="info"><Shield size={13}/> Password changes will sign out all devices.</Alert>
                            {[['Current Password',currentPw,setCurrentPw,showCurrent,setShowCurrent],
                              ['New Password',newPw,setNewPw,showNew,setShowNew]].map(([lbl,val,setter,show,setShow],idx)=>(
                                <div key={lbl}>
                                    <label style={{display:'block',fontSize:'11px',fontWeight:'600',color:t.textMuted,
                                        marginBottom:'5px',letterSpacing:'0.06em',textTransform:'uppercase'}}>{lbl}</label>
                                    <div style={{position:'relative'}}>
                                        <input type={show?'text':'password'} value={val} onChange={e=>setter(e.target.value)}
                                            placeholder={idx===0?'Current password':'Min. 8 characters'}
                                            style={{width:'100%',padding:'10px 40px 10px 12px',background:t.inputBg,
                                                border:`1px solid ${t.border}`,borderRadius:'8px',fontSize:'13px',
                                                color:t.textPrimary,boxSizing:'border-box',fontFamily:'inherit',outline:'none'}}/>
                                        <button type="button" onClick={()=>setShow(!show)}
                                            style={{position:'absolute',right:'10px',top:'50%',transform:'translateY(-50%)',
                                                background:'none',border:'none',color:t.textMuted,cursor:'pointer',display:'flex'}}>
                                            {show?<EyeOff size={14}/>:<Eye size={14}/>}
                                        </button>
                                    </div>
                                    {idx===1&&newPw&&(
                                        <div style={{marginTop:'6px'}}>
                                            <div style={{display:'flex',gap:'3px',marginBottom:'3px'}}>
                                                {[1,2,3,4].map(i=><div key={i} style={{flex:1,height:'3px',borderRadius:'2px',
                                                    background:i<=pwStrength?pwColors[pwStrength]:t.border,transition:'background 0.2s'}}/>)}
                                            </div>
                                            <span style={{fontSize:'10px',color:pwColors[pwStrength],fontWeight:'600'}}>
                                                {['','Too weak','Weak','Good','Strong'][pwStrength]}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ))}
                            <Input t={t} label="Confirm New Password" type="password" value={confirmPw}
                                onChange={e=>setConfirmPw(e.target.value)} placeholder="Re-enter new password"/>
                            <div style={{display:'flex',justifyContent:'flex-end'}}>
                                <Btn t={t} variant="primary" onClick={savePassword}
                                    disabled={loading||!isOnline||!currentPw||!newPw||!confirmPw}>
                                    <Shield size={13}/>{loading?'Updating...':'Update Password'}
                                </Btn>
                            </div>
                        </div>
                    )}

                    {tab==='danger'&&(
                        <div style={{ display:'flex',flexDirection:'column',gap:'14px' }}>
                            <Alert t={t} type="error"><AlertTriangle size={13}/> Account deletion is permanent and cannot be reversed.</Alert>
                            {deleteStep===1?(
                                <div style={{padding:'16px',background:t.dangerBg,border:`1px solid ${t.dangerBorder}`,borderRadius:'12px'}}>
                                    <h4 style={{margin:'0 0 7px',fontSize:'14px',fontWeight:'700',color:t.danger}}>Delete My Account</h4>
                                    <p style={{margin:'0 0 14px',fontSize:'13px',color:t.text,lineHeight:1.6}}>
                                        Your profile name and avatar stay on historical tasks. Your login access is permanently removed.
                                    </p>
                                    <Btn t={t} variant="danger" onClick={()=>setDeleteStep(2)}
                                        style={{background:t.danger,color:'#fff',border:'none',boxShadow:`0 4px 12px ${t.danger}40`}}>
                                        <Trash2 size={13}/> I understand, proceed
                                    </Btn>
                                </div>
                            ):(
                                <div style={{padding:'16px',background:t.dangerBg,border:`1px solid ${t.dangerBorder}`,borderRadius:'12px',display:'flex',flexDirection:'column',gap:'12px'}}>
                                    <p style={{margin:0,fontSize:'13px',color:t.text}}>
                                        Type <strong style={{color:t.danger,fontFamily:'monospace'}}>DELETE</strong> to confirm:
                                    </p>
                                    <input type="text" value={deleteConfirm}
                                        onChange={e=>{setDeleteConfirm(e.target.value);setDeleteError('');}}
                                        placeholder="Type DELETE here"
                                        style={{width:'100%',padding:'10px 12px',background:t.inputBg,
                                            border:`2px solid ${deleteConfirm==='DELETE'?t.danger:t.dangerBorder}`,
                                            borderRadius:'8px',fontSize:'14px',color:t.textPrimary,
                                            boxSizing:'border-box',fontFamily:'monospace',outline:'none'}}/>
                                    {deleteError&&<Alert t={t} type="error"><AlertCircle size={13}/> {deleteError}</Alert>}
                                    <div style={{display:'flex',gap:'10px'}}>
                                        <Btn t={t} variant="ghost" disabled={loading}
                                            onClick={()=>{setDeleteStep(1);setDeleteConfirm('');setDeleteError('');}}
                                            style={{flex:1,justifyContent:'center'}}>Cancel</Btn>
                                        <Btn t={t} disabled={deleteConfirm!=='DELETE'||loading} onClick={doDelete}
                                            style={{flex:1,justifyContent:'center',
                                                background:deleteConfirm==='DELETE'?t.danger:t.inputBg,
                                                color:deleteConfirm==='DELETE'?'#fff':t.textMuted,border:'none',
                                                boxShadow:deleteConfirm==='DELETE'?`0 4px 12px ${t.danger}40`:'none',
                                                padding:'9px 18px',borderRadius:'8px',fontWeight:'600',
                                                cursor:deleteConfirm==='DELETE'&&!loading?'pointer':'not-allowed',
                                                // eslint-disable-next-line no-dupe-keys
                                                display:'inline-flex',alignItems:'center',justifyContent:'center',
                                                gap:'6px',fontSize:'13px',fontFamily:'inherit',opacity:loading?0.6:1}}>
                                            {loading?'Deleting...':'Delete Forever'}
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

// ── Sidebar ───────────────────────────────────────────────────────────────────
const Sidebar = ({ t, currentView, onNavigate, collapsed, onToggle, isCompany, onMobileClose }) => {
    const personalNav=[
        {id:'dashboard',    icon:<LayoutDashboard size={15}/>,label:'Dashboard'},
        {id:'reports',      icon:<FileText size={15}/>,       label:'My Reports'},
        {id:'company-setup',icon:<Building2 size={15}/>,      label:'Upgrade to Team'},
    ];
    const companyNav=[
        {id:'dashboard',    icon:<LayoutDashboard size={15}/>,label:'Dashboard'},
        {id:'company-setup',icon:<Building2 size={15}/>,      label:'Company'},
        {id:'team',         icon:<Users size={15}/>,           label:'Team'},
        {id:'progress',     icon:<TrendingUp size={15}/>,      label:'Progress'},
        {id:'reports',      icon:<FileText size={15}/>,        label:'Reports'},
    ];
    const nav=isCompany?companyNav:personalNav;

    const handleNav=(id)=>{onNavigate(id);if(onMobileClose)onMobileClose();};

    return (
        <div style={{ display:'flex',flexDirection:'column',height:'100%',overflow:'hidden' }}>
            {!collapsed&&(
                <div style={{padding:'10px 10px 6px'}}>
                    <div style={{padding:'5px 8px',background:t.accentBg,border:`1px solid ${t.accentBorder}`,
                        borderRadius:'7px',display:'flex',alignItems:'center',gap:'6px'}}>
                        <span style={{fontSize:'12px'}}>{t.modeIcon}</span>
                        <span style={{fontSize:'9px',fontWeight:'700',color:t.accentLight,textTransform:'uppercase',letterSpacing:'0.07em'}}>
                            {t.modeLabel} Mode
                        </span>
                    </div>
                </div>
            )}
            <nav style={{ flex:1,display:'flex',flexDirection:'column',gap:'2px',
                padding:collapsed?'10px 6px':'6px 8px',overflowY:'auto' }}>
                {nav.map(item=>{
                    const active=currentView===item.id;
                    return (
                        <button key={item.id} onClick={()=>handleNav(item.id)} style={{
                            padding:collapsed?'10px':'9px 10px',
                            background:active?t.sidebarActive:'transparent',
                            border:`1px solid ${active?t.sidebarActiveBorder:'transparent'}`,
                            borderRadius:'8px',color:active?t.accentLight:t.textMuted,
                            fontSize:'12px',fontWeight:active?'700':'400',cursor:'pointer',
                            display:'flex',alignItems:'center',gap:'8px',
                            justifyContent:collapsed?'center':'flex-start',
                            width:'100%',transition:'all 0.13s',textAlign:'left',
                            whiteSpace:'nowrap',fontFamily:'inherit',
                        }}
                            onMouseEnter={e=>{if(!active){e.currentTarget.style.background=t.sidebarActive+'88';e.currentTarget.style.color=t.text;}}}
                            onMouseLeave={e=>{if(!active){e.currentTarget.style.background='transparent';e.currentTarget.style.color=t.textMuted;}}}>
                            <span style={{flexShrink:0}}>{item.icon}</span>
                            {!collapsed&&<span>{item.label}</span>}
                        </button>
                    );
                })}
                {!isCompany&&!collapsed&&(
                    <div style={{marginTop:'10px',paddingTop:'10px',borderTop:`1px solid ${t.border}`}}>
                        <p style={{margin:'0 0 5px',fontSize:'9px',fontWeight:'700',color:t.textMuted,
                            textTransform:'uppercase',letterSpacing:'0.07em',padding:'0 4px'}}>Team Features</p>
                        {[['team','Team',<Users size={14}/>],['progress','Progress',<TrendingUp size={14}/>]].map(([id,label,icon])=>(
                            <div key={id} style={{display:'flex',alignItems:'center',gap:'8px',padding:'8px 10px',
                                borderRadius:'8px',opacity:0.3,cursor:'not-allowed',color:t.textMuted}}>
                                {icon}<span style={{fontSize:'12px',flex:1}}>{label}</span><Lock size={10}/>
                            </div>
                        ))}
                    </div>
                )}
            </nav>
            <div style={{padding:'8px',borderTop:`1px solid ${t.border}`}}>
                <button onClick={onToggle} style={{ width:'100%',padding:'7px',background:t.inputBg,
                    border:`1px solid ${t.border}`,borderRadius:'7px',color:t.textMuted,cursor:'pointer',
                    display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',fontFamily:'inherit' }}>
                    {collapsed?<Menu size={14}/>:<><ChevronLeft size={13}/><span style={{fontSize:'11px',fontWeight:'500'}}>Collapse</span></>}
                </button>
            </div>
        </div>
    );
};

// ── Task list panel ───────────────────────────────────────────────────────────
const TaskPanel = ({t,isOnline,filteredTasks,filter,setFilter,searchQuery,setSearchQuery,
    setShowCreateModal,updateTaskStatus,setDeleteTarget,setEditTask,updatingStatus,
    canAssign,onAssign,title}) => (
    <div style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:'14px',overflow:'hidden'}}>
        <div style={{padding:'13px 15px',borderBottom:`1px solid ${t.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',gap:'8px'}}>
            <h2 style={{fontSize:'13px',fontWeight:'700',color:t.textPrimary,margin:0,display:'flex',alignItems:'center',gap:'6px',minWidth:0}}>
                <ListTodo size={14} color={t.accentLight}/>
                <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{title}</span>
                <span style={{fontSize:'10px',fontWeight:'600',color:t.textMuted,background:t.inputBg,
                    border:`1px solid ${t.border}`,borderRadius:'20px',padding:'1px 6px',flexShrink:0}}>
                    {filteredTasks.length}
                </span>
            </h2>
            <Btn t={t} variant="primary" size="sm" onClick={()=>isOnline&&setShowCreateModal(true)} disabled={!isOnline}>
                <Plus size={12}/> New
            </Btn>
        </div>
        <div style={{padding:'11px 13px'}}>
            <div style={{display:'flex',alignItems:'center',gap:'7px',padding:'7px 10px',background:t.inputBg,
                border:`1px solid ${t.border}`,borderRadius:'8px',marginBottom:'9px'}}>
                <Search size={12} color={t.textMuted}/>
                <input type="text" placeholder="Search tasks..." value={searchQuery}
                    onChange={e=>setSearchQuery(e.target.value)}
                    style={{flex:1,background:'none',border:'none',color:t.textPrimary,fontSize:'12px',outline:'none',fontFamily:'inherit'}}/>
                {searchQuery&&<button onClick={()=>setSearchQuery('')}
                    style={{background:'none',border:'none',color:t.textMuted,cursor:'pointer',display:'flex',padding:'2px'}}>
                    <X size={11}/>
                </button>}
            </div>
            <div style={{display:'flex',gap:'4px',marginBottom:'10px',flexWrap:'wrap'}}>
                {['all','pending','in_progress','completed','blocked'].map(s=>(
                    <button key={s} onClick={()=>setFilter(s)} style={{
                        padding:'3px 8px',background:filter===s?t.accentBg:'transparent',
                        border:`1px solid ${filter===s?t.accentBorder:t.border}`,borderRadius:'20px',
                        color:filter===s?t.accentLight:t.textMuted,fontSize:'10px',
                        fontWeight:filter===s?'700':'400',cursor:'pointer',fontFamily:'inherit',textTransform:'capitalize',
                    }}>{s.replace('_',' ')}</button>
                ))}
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'6px',maxHeight:'400px',overflowY:'auto'}}>
                {filteredTasks.length===0?(
                    <div style={{textAlign:'center',padding:'36px 20px'}}>
                        <ListTodo size={26} color={t.textMuted}/>
                        <p style={{color:t.textMuted,margin:'8px 0 0',fontSize:'12px'}}>
                            {searchQuery||filter!=='all'?'No matching tasks':'No tasks yet'}
                        </p>
                        {!searchQuery&&filter==='all'&&isOnline&&(
                            <button onClick={()=>setShowCreateModal(true)}
                                style={{marginTop:'10px',padding:'6px 14px',background:'transparent',
                                    border:`1px solid ${t.accentBorder}`,borderRadius:'7px',color:t.accentLight,
                                    fontSize:'11px',fontWeight:'600',cursor:'pointer',fontFamily:'inherit'}}>
                                Create first task
                            </button>
                        )}
                    </div>
                ):filteredTasks.map(task=>(
                    <TaskCard key={task.id} t={t} task={task}
                        onStatusChange={updateTaskStatus}
                        onDelete={()=>setDeleteTarget(task)}
                        onEdit={()=>setEditTask(task)}
                        onAssign={()=>onAssign&&onAssign(task)}
                        canAssign={canAssign}
                        updatingStatus={updatingStatus}
                        isOnline={isOnline}/>
                ))}
            </div>
        </div>
    </div>
);

// ── Personal dashboard view ───────────────────────────────────────────────────
const PersonalDashboard = ({t,user,tasks,isOnline,wsConnected,recentActivity,filteredTasks,filter,setFilter,
    searchQuery,setSearchQuery,setShowCreateModal,updateTaskStatus,setDeleteTarget,setEditTask,updatingStatus,onNavigate}) => {
    const hour=new Date().getHours();
    const greeting=hour<12?'Good morning':hour<18?'Good afternoon':'Good evening';
    const completed=tasks.filter(tk=>tk.status==='completed').length;
    const overdue=tasks.filter(tk=>tk.deadline&&new Date(tk.deadline)<new Date()&&tk.status!=='completed').length;
    const rate=tasks.length>0?Math.round((completed/tasks.length)*100):0;
    return (
        <div style={{padding:'14px 12px 40px',display:'flex',flexDirection:'column',gap:'12px'}}>
            <div style={{padding:'18px',background:`linear-gradient(135deg,${t.accentBg},transparent)`,
                border:`1px solid ${t.accentBorder}`,borderRadius:'14px',position:'relative',overflow:'hidden'}}>
                <div style={{position:'absolute',top:'-40px',right:'-20px',width:'130px',height:'130px',borderRadius:'50%',
                    background:`radial-gradient(circle,${t.accent}20,transparent 70%)`,pointerEvents:'none'}}/>
                <p style={{margin:'0 0 2px',fontSize:'11px',color:t.accentLight,fontWeight:'600'}}>{greeting},</p>
                <h2 style={{margin:'0 0 12px',fontSize:'clamp(15px,4vw,20px)',fontWeight:'800',color:t.textPrimary,letterSpacing:'-0.3px'}}>
                    {user?.fullName||user?.email?.split('@')[0]} 👋
                </h2>
                <div style={{display:'flex',alignItems:'center',gap:'14px',flexWrap:'wrap'}}>
                    <div style={{flex:1,minWidth:'130px'}}>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:'5px'}}>
                            <span style={{fontSize:'11px',color:t.textMuted}}>Completion</span>
                            <span style={{fontSize:'11px',fontWeight:'800',color:rate>=70?t.success:rate>=40?t.warning:t.accentLight}}>{rate}%</span>
                        </div>
                        <div style={{height:'4px',background:t.border,borderRadius:'3px',overflow:'hidden'}}>
                            <div style={{height:'100%',width:`${rate}%`,borderRadius:'3px',transition:'width 0.6s ease',
                                background:rate>=70?`linear-gradient(90deg,${t.success},#34d399)`:t.accentGrad}}/>
                        </div>
                    </div>
                    <div style={{display:'flex',gap:'5px'}}>
                        {[{v:tasks.length,label:'Total',color:t.accent},{v:completed,label:'Done',color:t.success},{v:overdue,label:'Late',color:t.danger}].map((s,i)=>(
                            <div key={i} style={{textAlign:'center',padding:'6px 10px',background:'rgba(255,255,255,0.03)',borderRadius:'9px',border:`1px solid ${t.border}`}}>
                                <div style={{fontSize:'18px',fontWeight:'800',color:s.color,lineHeight:1}}>{s.v}</div>
                                <div style={{fontSize:'9px',color:t.textMuted,marginTop:'1px',fontWeight:'600',textTransform:'uppercase'}}>{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <div style={{padding:'12px 14px',background:`linear-gradient(135deg,rgba(124,58,237,0.08),rgba(16,185,129,0.04))`,
                border:`1px solid ${t.accentBorder}`,borderRadius:'11px',display:'flex',alignItems:'center',gap:'12px',flexWrap:'wrap'}}>
                <div style={{width:'30px',height:'30px',borderRadius:'8px',background:t.accentGrad,
                    display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <Sparkles size={14} color="#fff"/>
                </div>
                <div style={{flex:1,minWidth:'130px'}}>
                    <p style={{margin:'0 0 1px',fontSize:'12px',fontWeight:'700',color:t.textPrimary}}>Unlock Team Collaboration</p>
                    <p style={{margin:0,fontSize:'11px',color:t.textMuted}}>Set up a company workspace for team features.</p>
                </div>
                <button onClick={()=>onNavigate('company-setup')} style={{padding:'7px 12px',background:t.accentGrad,
                    border:'none',borderRadius:'7px',color:'#fff',fontSize:'11px',fontWeight:'700',cursor:'pointer',
                    display:'flex',alignItems:'center',gap:'4px',flexShrink:0,boxShadow:`0 4px 12px ${t.accent}40`,fontFamily:'inherit'}}>
                    Set up <ArrowRight size={11}/>
                </button>
            </div>
            <div className="dash-content-grid" style={{display:'grid',gap:'12px'}}>
                <TaskPanel t={t} isOnline={isOnline} filteredTasks={filteredTasks} filter={filter}
                    setFilter={setFilter} searchQuery={searchQuery} setSearchQuery={setSearchQuery}
                    setShowCreateModal={setShowCreateModal} updateTaskStatus={updateTaskStatus}
                    setDeleteTarget={setDeleteTarget} setEditTask={setEditTask} updatingStatus={updatingStatus}
                    canAssign={false} title="My Tasks"/>
                <div style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:'14px',padding:'14px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'10px'}}>
                        <Activity size={13} color={t.accentLight}/>
                        <h3 style={{fontSize:'13px',fontWeight:'700',color:t.textPrimary,margin:0}}>Live Activity</h3>
                        <div style={{width:'6px',height:'6px',borderRadius:'50%',background:wsConnected&&isOnline?t.success:t.danger,marginLeft:'auto',flexShrink:0}}/>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:'8px',maxHeight:'240px',overflowY:'auto'}}>
                        {recentActivity.length===0
                            ?<p style={{fontSize:'12px',color:t.textMuted,textAlign:'center',padding:'18px 0',margin:0}}>Activity will appear here.</p>
                            :recentActivity.map(a=>(
                                <div key={a.id} style={{display:'flex',gap:'8px'}}>
                                    <div style={{width:'5px',height:'5px',borderRadius:'50%',background:t.accent,marginTop:'5px',flexShrink:0}}/>
                                    <div>
                                        <p style={{fontSize:'12px',color:t.text,margin:'0 0 1px',lineHeight:1.4}}>{a.message}</p>
                                        <p style={{fontSize:'10px',color:t.textMuted,margin:0}}>{new Date(a.timestamp).toLocaleTimeString()}</p>
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

const CompanyDashboard = ({t,user,tasks,isOnline,wsConnected,recentActivity,filteredTasks,filter,setFilter,
    searchQuery,setSearchQuery,setShowCreateModal,updateTaskStatus,setDeleteTarget,setEditTask,updatingStatus,companyName,onAssign}) => {
    const canAssign=['owner','admin','manager'].includes(user?.role);
    const completed=tasks.filter(tk=>tk.status==='completed').length;
    const inProgress=tasks.filter(tk=>tk.status==='in_progress').length;
    const overdue=tasks.filter(tk=>tk.deadline&&new Date(tk.deadline)<new Date()&&tk.status!=='completed').length;
    const flagged=tasks.filter(tk=>tk.flagged).length;
    const rate=tasks.length>0?Math.round((completed/tasks.length)*100):0;
    const byAssignee=tasks.reduce((acc,tk)=>{const n=tk.assignee_name||'Unassigned';if(!acc[n])acc[n]={total:0,completed:0};acc[n].total++;if(tk.status==='completed')acc[n].completed++;return acc;},{});
    return (
        <div style={{padding:'14px 12px 40px',display:'flex',flexDirection:'column',gap:'12px'}}>
            <div style={{padding:'16px',background:`linear-gradient(135deg,${t.accentBg},transparent)`,
                border:`1px solid ${t.accentBorder}`,borderRadius:'14px',display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'12px',flexWrap:'wrap'}}>
                <div>
                    <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'5px'}}>
                        <div style={{width:'30px',height:'30px',borderRadius:'8px',background:t.accentGrad,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                            <Building2 size={15} color="#fff"/>
                        </div>
                        <div>
                            <p style={{margin:0,fontSize:'10px',color:t.accentLight,fontWeight:'600',textTransform:'uppercase',letterSpacing:'0.05em'}}>Company</p>
                            <h2 style={{margin:0,fontSize:'clamp(14px,3.5vw,18px)',fontWeight:'800',color:t.textPrimary,letterSpacing:'-0.2px'}}>
                                {companyName||'Team Overview'}
                            </h2>
                        </div>
                    </div>
                    <p style={{margin:0,fontSize:'11px',color:t.textMuted}}>
                        Welcome, <strong style={{color:t.text}}>{user?.fullName}</strong> &middot; {user?.role}
                    </p>
                </div>
                <div style={{textAlign:'right',flexShrink:0}}>
                    <div style={{fontSize:'clamp(20px,5vw,30px)',fontWeight:'900',color:t.textPrimary,lineHeight:1}}>{rate}%</div>
                    <div style={{fontSize:'10px',color:t.textMuted,fontWeight:'600',textTransform:'uppercase',marginTop:'2px'}}>Team Completion</div>
                    <div style={{marginTop:'5px',height:'4px',background:t.border,borderRadius:'2px',width:'70px',overflow:'hidden',marginLeft:'auto'}}>
                        <div style={{height:'100%',width:`${rate}%`,background:t.accentGrad,borderRadius:'2px',transition:'width 0.6s'}}/>
                    </div>
                </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px'}}>
                {[{icon:<Clock size={15}/>,v:inProgress,label:'In Progress',color:t.info},
                  {icon:<CheckCircle2 size={15}/>,v:completed,label:'Completed',color:t.success},
                  {icon:<AlertCircle size={15}/>,v:overdue,label:'Overdue',color:t.danger}].map((s,i)=>(
                    <div key={i} style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:'11px',padding:'11px',display:'flex',alignItems:'center',gap:'8px'}}>
                        <div style={{width:'30px',height:'30px',borderRadius:'8px',background:`${s.color}15`,color:s.color,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{s.icon}</div>
                        <div>
                            <div style={{fontSize:'clamp(16px,4vw,22px)',fontWeight:'800',color:t.textPrimary,lineHeight:1}}>{s.v}</div>
                            <div style={{fontSize:'9px',color:t.textMuted,marginTop:'1px',fontWeight:'500'}}>{s.label}</div>
                        </div>
                    </div>
                ))}
            </div>
            <div className="dash-content-grid" style={{display:'grid',gap:'12px'}}>
                <TaskPanel t={t} isOnline={isOnline} filteredTasks={filteredTasks} filter={filter}
                    setFilter={setFilter} searchQuery={searchQuery} setSearchQuery={setSearchQuery}
                    setShowCreateModal={setShowCreateModal} updateTaskStatus={updateTaskStatus}
                    setDeleteTarget={setDeleteTarget} setEditTask={setEditTask} updatingStatus={updatingStatus}
                    canAssign={canAssign} onAssign={onAssign} title="All Team Tasks"/>
                <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                    <div style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:'14px',padding:'14px'}}>
                        <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'10px'}}>
                            <Users size={13} color={t.accentLight}/>
                            <h3 style={{fontSize:'13px',fontWeight:'700',color:t.textPrimary,margin:0}}>Team Workload</h3>
                        </div>
                        {Object.entries(byAssignee).length===0
                            ?<p style={{fontSize:'12px',color:t.textMuted,margin:0}}>No assignments yet</p>
                            :Object.entries(byAssignee).map(([name,data])=>{const pct=data.total>0?Math.round((data.completed/data.total)*100):0;return(
                                <div key={name} style={{marginBottom:'9px'}}>
                                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'3px'}}>
                                        <span style={{fontSize:'12px',color:t.text,fontWeight:'500',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'65%'}}>{name}</span>
                                        <span style={{fontSize:'10px',color:t.textMuted}}>{data.completed}/{data.total}</span>
                                    </div>
                                    <div style={{height:'4px',background:t.border,borderRadius:'2px',overflow:'hidden'}}>
                                        <div style={{height:'100%',width:`${pct}%`,background:pct===100?t.success:t.accentGrad,borderRadius:'2px'}}/>
                                    </div>
                                </div>
                            );})}
                    </div>
                    <div style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:'14px',padding:'14px'}}>
                        <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'10px'}}>
                            <Activity size={13} color={t.accentLight}/>
                            <h3 style={{fontSize:'13px',fontWeight:'700',color:t.textPrimary,margin:0}}>Team Activity</h3>
                            <div style={{width:'6px',height:'6px',borderRadius:'50%',background:wsConnected&&isOnline?t.success:t.danger,marginLeft:'auto',flexShrink:0}}/>
                        </div>
                        <div style={{display:'flex',flexDirection:'column',gap:'7px',maxHeight:'180px',overflowY:'auto'}}>
                            {recentActivity.length===0?<p style={{fontSize:'12px',color:t.textMuted,margin:0}}>No recent activity</p>
                                :recentActivity.map(a=>(
                                    <div key={a.id} style={{display:'flex',gap:'7px'}}>
                                        <div style={{width:'4px',height:'4px',borderRadius:'50%',background:t.accent,marginTop:'5px',flexShrink:0}}/>
                                        <div><p style={{fontSize:'11px',color:t.text,margin:'0 0 1px',lineHeight:1.4}}>{a.message}</p>
                                        <p style={{fontSize:'10px',color:t.textMuted,margin:0}}>{new Date(a.timestamp).toLocaleTimeString()}</p></div>
                                    </div>
                                ))}
                        </div>
                    </div>
                    {flagged>0&&(
                        <div style={{padding:'11px',background:t.warningBg,border:`1px solid ${t.warningBorder}`,borderRadius:'11px',display:'flex',alignItems:'center',gap:'9px'}}>
                            <Flag size={14} color={t.warning}/>
                            <div>
                                <p style={{margin:0,fontSize:'12px',fontWeight:'700',color:t.textPrimary}}>{flagged} Flagged {flagged===1?'Task':'Tasks'}</p>
                                <p style={{margin:'1px 0 0',fontSize:'11px',color:t.textMuted}}>Requires attention</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const LockedView=({t,label,onSetup})=>(
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'320px',gap:'12px',padding:'32px 16px'}}>
        <div style={{width:'48px',height:'48px',borderRadius:'13px',background:t.inputBg,border:`1px solid ${t.border}`,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <Lock size={20} color={t.textMuted}/>
        </div>
        <div style={{textAlign:'center'}}>
            <h3 style={{margin:'0 0 5px',fontSize:'16px',fontWeight:'700',color:t.textPrimary}}>{label}</h3>
            <p style={{margin:0,fontSize:'13px',color:t.textMuted}}>This feature requires a company workspace.</p>
        </div>
        <Btn t={t} variant="primary" onClick={onSetup}><Building2 size={13}/> Set Up Company</Btn>
    </div>
);

// ── Main Dashboard ────────────────────────────────────────────────────────────
const Dashboard = () => {
    const { user, logout, updateUser, deleteAccount } = useAuth();

    const [dark,setDark]=useState(()=>{
        const saved=localStorage.getItem('syncline_theme');
        if(saved!==null)return saved==='dark';
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });
    const isCompany=user?.accountType==='company'||user?.account_type==='company';
    const t=dark?(isCompany?COMPANY:PERSONAL):(isCompany?LIGHT_COMPANY:LIGHT_PERSONAL);

    const [currentView,setCurrentView]=useState(()=>{
        const saved=sessionStorage.getItem('syncline_view');
        const valid=['dashboard','company-setup','team','progress','reports'];
        return(saved&&valid.includes(saved))?saved:'dashboard';
    });
    const navigateTo=(view)=>{setCurrentView(view);sessionStorage.setItem('syncline_view',view);};

    const [sidebarCollapsed,setSidebarCollapsed]=useState(false);
    const [mobileSidebarOpen,setMobileSidebarOpen]=useState(false);
    const [tasks,setTasks]=useState([]);
    const [loading,setLoading]=useState(true);
    const [filter,setFilter]=useState('all');
    const [searchQuery,setSearchQuery]=useState('');
    const [showCreateModal,setShowCreateModal]=useState(false);
    const [editTask,setEditTask]=useState(null);
    const [deleteTarget,setDeleteTarget]=useState(null);
    const [deleteLoading,setDeleteLoading]=useState(false);
    const [showProfile,setShowProfile]=useState(false);
    const [showLogoutConfirm,setShowLogoutConfirm]=useState(false);
    const [wsConnected,setWsConnected]=useState(false);
    const [recentActivity,setRecentActivity]=useState([]);
    const [notifications,setNotifications]=useState([]);
    const [showNotifications,setShowNotifications]=useState(false);
    const [updatingStatus,setUpdatingStatus]=useState(null);
    const [isOnline,setIsOnline]=useState(navigator.onLine);
    const [companyName,setCompanyName]=useState(user?.companyName||user?.company_name||null);
    const [companyLogo,setCompanyLogo]=useState(null);
    const [assigningTask,setAssigningTask]=useState(null);

    const userIdRef=useRef(user?.id);
    useEffect(()=>{userIdRef.current=user?.id;},[user?.id]);

    const addActivity=useCallback((msg)=>{setRecentActivity(prev=>[{id:Date.now()+Math.random(),message:msg,timestamp:new Date()},...prev].slice(0,12));},[]);
    const addNotification=useCallback((title,message,type='info')=>{setNotifications(prev=>[{id:Date.now(),title,message,type,read:false},...prev].slice(0,20));},[]);

    const fetchTasks=useCallback(async()=>{
        try{
            const res=await taskAPI.getAll();
            const all=res.data.tasks||[];
            setTasks(all);
        }catch(err){console.error('Fetch tasks:',err);}
    },[]);

    useEffect(()=>{
        if(!isCompany||!user?.company_id)return;
        const load=async()=>{
            try{
                const token=await auth.currentUser?.getIdToken();
                if(!token)return;
                const res=await fetch(`${API_ORIGIN}/api/company/team`,{headers:{Authorization:`Bearer ${token}`}});
                const data=await res.json();
                if(data.company?.name)setCompanyName(data.company.name);
                if(data.company?.logo_url)setCompanyLogo(data.company.logo_url);
            }catch(err){console.error('Load company:',err);}
        };
        load();
    },[isCompany,user?.company_id]);

    useEffect(()=>{
        const online=()=>{setIsOnline(true);addActivity('Connection restored');};
        const offline=()=>{setIsOnline(false);addActivity('Lost connection');};
        window.addEventListener('online',online);window.addEventListener('offline',offline);
        return()=>{window.removeEventListener('online',online);window.removeEventListener('offline',offline);};
    },[addActivity]);

    useEffect(()=>{
        const load=async()=>{setLoading(true);await fetchTasks();setLoading(false);};
        load();
        let pollCount=0;
        const pollInterval=setInterval(()=>{const state=wsService?.socket?.readyState??wsService?.readyState;if(state===1){setWsConnected(true);clearInterval(pollInterval);}else if(++pollCount>=10)clearInterval(pollInterval);},1000);
        const onCreated=(data)=>{setTasks(prev=>[data.task,...prev]);addActivity(`${data.creator?.fullName||'Someone'} created "${data.task.title}"`);};
        const onUpdated=(data)=>{setTasks(prev=>prev.map(tk=>tk.id===data.task.id?data.task:tk));};
        const onDeleted=(data)=>setTasks(prev=>prev.filter(tk=>tk.id!==data.taskId));
        const onFlagged=(data)=>{setTasks(prev=>prev.map(tk=>tk.id===data.task.id?data.task:tk));addNotification('Task Flagged',`"${data.task.title}": ${data.reason}`,'warning');};
        wsService.on('connection',(d)=>{if(typeof d==='boolean')setWsConnected(d);else if(d?.connected!==undefined)setWsConnected(d.connected);});
        wsService.on('task:created',onCreated);wsService.on('task:updated',onUpdated);wsService.on('task:deleted',onDeleted);wsService.on('task:flagged',onFlagged);
        return()=>{clearInterval(pollInterval);wsService.off('task:created',onCreated);wsService.off('task:updated',onUpdated);wsService.off('task:deleted',onDeleted);wsService.off('task:flagged',onFlagged);};
    },[addActivity,addNotification,fetchTasks]);

    const filteredTasks=tasks.filter(task=>{
        const matchesFilter=filter==='all'||task.status===filter;
        const matchesSearch=task.title.toLowerCase().includes(searchQuery.toLowerCase())||(task.description||'').toLowerCase().includes(searchQuery.toLowerCase());
        return matchesFilter&&matchesSearch;
    });

    const updateTaskStatus=async(taskId,newStatus)=>{
        if(!isOnline)return;
        const prev=tasks;
        setTasks(p=>p.map(tk=>tk.id===taskId?{...tk,status:newStatus}:tk));
        setUpdatingStatus(taskId);
        try{await taskAPI.update(taskId,{status:newStatus});addActivity(`Task status changed to ${STATUS_LABEL[newStatus]}`);}
        catch{setTasks(prev);}
        finally{setUpdatingStatus(null);}
    };

    const confirmDeleteTask=async()=>{
        if(!deleteTarget||!isOnline){setDeleteTarget(null);return;}
        setDeleteLoading(true);
        try{
            await taskAPI.delete(deleteTarget.id);
            setTasks(prev=>prev.filter(tk=>tk.id!==deleteTarget.id));
            addActivity(`Deleted "${deleteTarget.title}"`);
            setDeleteTarget(null);
        }catch(err){addNotification('Delete Failed',err.response?.data?.error||'Failed to delete task','error');}
        finally{setDeleteLoading(false);}
    };

    const handleProfileSave=async(data,type,device)=>{
        try{
            if(type==='profile'){
                let updatedUser;
                if(data.avatar instanceof File){const form=new FormData();form.append('avatar',data.avatar,data.avatar.name);form.append('fullName',data.fullName||'');form.append('device',device);const res=await userAPI.updateProfile(form);updatedUser=res.data?.user??res.data;}
                else if(data.avatar===null){const res=await userAPI.updateProfile({fullName:data.fullName,removeAvatar:true,device});updatedUser=res.data?.user??res.data;}
                else{const res=await userAPI.updateProfile({fullName:data.fullName,device});updatedUser=res.data?.user??res.data;}
                if(updatedUser&&updateUser)updateUser(updatedUser);
            }else if(type==='password'){await userAPI.changePassword({currentPassword:data.currentPassword,newPassword:data.newPassword,device});}
            return null;
        }catch(err){return err.response?.data?.error||err.response?.data?.message||err.message||`Failed to update ${type}`;}
    };

    const handleDeleteAccount=async(device)=>{
        try{localStorage.clear();}catch(_){}
        try{sessionStorage.clear();}catch(_){}
        return await deleteAccount({device});
    };

    const unreadCount=notifications.filter(n=>!n.read).length;
    const headerLabel=isCompany?(companyName||'Company'):'Syncline';
    const sharedDashProps={t,user,tasks,isOnline,wsConnected,recentActivity,filteredTasks,filter,setFilter,searchQuery,setSearchQuery,setShowCreateModal,updateTaskStatus,setDeleteTarget,setEditTask,updatingStatus};

    if(loading)return(
        <div style={{minHeight:'100vh',background:t.bg,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:'14px',fontFamily:"'DM Sans',system-ui,sans-serif"}}>
            <div style={{width:'38px',height:'38px',border:`3px solid ${t.border}`,borderTop:`3px solid ${t.accent}`,borderRadius:'50%',animation:'spin 0.75s linear infinite'}}/>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <p style={{color:t.textMuted,fontSize:'13px',margin:0}}>Loading Syncline...</p>
        </div>
    );

    return (
        <div style={{minHeight:'100vh',background:t.bg,color:t.text,fontFamily:"'DM Sans',system-ui,sans-serif",display:'flex',flexDirection:'column'}}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
                @keyframes spin{to{transform:rotate(360deg)}}
                @keyframes slideDown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
                *,*::before,*::after{box-sizing:border-box}
                html,body,#root{overflow-x:hidden;max-width:100vw}
                input:focus,select:focus,textarea:focus{outline:none;border-color:${t.accent}!important;box-shadow:0 0 0 3px ${t.accent}22!important}
                ::-webkit-scrollbar{width:4px;height:4px}
                ::-webkit-scrollbar-track{background:transparent}
                ::-webkit-scrollbar-thumb{background:${t.border};border-radius:2px}
                select option{background:${t.surfaceRaised};color:${t.textPrimary}}
                @media(max-width:768px){input,select,textarea{font-size:16px!important}}

                /* Stats grid */
                .dash-stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;padding:12px 12px 0}
                @media(max-width:600px){.dash-stats-grid{grid-template-columns:repeat(2,1fr);gap:7px;padding:9px 10px 0}}
                @media(max-width:350px){.dash-stats-grid{gap:5px;padding:7px 8px 0}}

                /* Content grid */
                .dash-content-grid{grid-template-columns:1fr 240px}
                @media(max-width:840px){.dash-content-grid{grid-template-columns:1fr!important}}

                /* Hide connecting label on mobile — show only the dot */
                .dash-status-label{display:inline}
                @media(max-width:480px){.dash-status-label{display:none}}

                /* Hide header name on small phones */
                .dash-header-name{display:flex}
                @media(max-width:480px){.dash-header-name{display:none!important}}
            `}</style>

            {/* ── Header ── */}
            <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0 10px',background:t.sidebarBg,borderBottom:`1px solid ${t.sidebarBorder}`,position:'sticky',top:0,zIndex:100,height:'54px',flexShrink:0,gap:'6px'}}>
                <div style={{display:'flex',alignItems:'center',gap:'7px',minWidth:0}}>
                    {/* Hamburger — mobile only */}
                    <button onClick={()=>setMobileSidebarOpen(o=>!o)}
                        style={{padding:'6px',background:t.inputBg,border:`1px solid ${t.border}`,borderRadius:'7px',color:t.text,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,
                            // Hide on desktop via inline style + we handle with media query via CSS
                        }}>
                        <Menu size={15}/>
                    </button>

                    {/* Logo */}
                    <div style={{display:'flex',alignItems:'center',gap:'7px',flexShrink:0}}>
                        {companyLogo
                            ?<img src={companyLogo.startsWith('http')?companyLogo:`${API_ORIGIN}${companyLogo}`} alt="logo"
                                style={{width:'28px',height:'28px',borderRadius:'6px',objectFit:'cover',border:`1px solid ${t.border}`}}/>
                            :<div style={{width:'25px',height:'25px',borderRadius:'6px',background:t.accentGrad,display:'flex',alignItems:'center',justifyContent:'center'}}>
                                <Zap size={12} color="#fff"/>
                             </div>
                        }
                        <span className="dash-header-name" style={{fontSize:'14px',fontWeight:'800',color:t.textPrimary,letterSpacing:'-0.2px',whiteSpace:'nowrap'}}>
                            {headerLabel}
                        </span>
                    </div>

                    {/* Connection status — dot always visible, text hidden on mobile */}
                    <div style={{display:'flex',alignItems:'center',gap:'4px',padding:'3px 7px',
                        background:isOnline?t.onlineBg:t.offlineBg,borderRadius:'20px',
                        border:`1px solid ${isOnline?t.successBorder:t.dangerBorder}`,flexShrink:0}}>
                        {isOnline?<Wifi size={9} color={t.online}/>:<WifiOff size={9} color={t.offline}/>}
                        {/* FIX Issue 4: text hidden on mobile via CSS class */}
                        <span className="dash-status-label" style={{fontSize:'9px',color:isOnline?t.online:t.offline,fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.05em'}}>
                            {!isOnline?'Offline':wsConnected?'Live':'Connecting'}
                        </span>
                    </div>

                    {isCompany&&(
                        <div className="dash-header-name" style={{display:'flex',alignItems:'center',gap:'4px',padding:'3px 7px',background:t.accentBg,borderRadius:'20px',border:`1px solid ${t.accentBorder}`,flexShrink:0}}>
                            <Building2 size={9} color={t.accentLight}/>
                            <span style={{fontSize:'9px',color:t.accentLight,fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.05em'}}>Team</span>
                        </div>
                    )}
                </div>

                <div style={{display:'flex',alignItems:'center',gap:'5px',flexShrink:0}}>
                    <button onClick={()=>{const next=!dark;setDark(next);localStorage.setItem('syncline_theme',next?'dark':'light');}}
                        style={{padding:'6px',background:t.inputBg,border:`1px solid ${t.border}`,borderRadius:'6px',color:t.text,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                        {dark?<Sun size={13}/>:<Moon size={13}/>}
                    </button>

                    {/* Notifications — FIX Issue 3: panel positioned to stay on screen */}
                    <div style={{position:'relative'}}>
                        <button onClick={()=>setShowNotifications(!showNotifications)}
                            style={{padding:'6px',background:t.inputBg,border:`1px solid ${t.border}`,borderRadius:'6px',color:t.text,cursor:'pointer',display:'flex',position:'relative'}}>
                            <Bell size={13}/>
                            {unreadCount>0&&<span style={{position:'absolute',top:'1px',right:'1px',width:'13px',height:'13px',borderRadius:'50%',background:t.danger,color:'#fff',fontSize:'7px',fontWeight:'800',display:'flex',alignItems:'center',justifyContent:'center',border:`2px solid ${t.sidebarBg}`}}>
                                {unreadCount>9?'9+':unreadCount}
                            </span>}
                        </button>
                        {showNotifications&&(
                            <div style={{
                                position:'fixed', // FIX: use fixed instead of absolute to prevent off-screen
                                top:'58px',
                                right:'10px',    // FIX: fixed distance from right edge of viewport
                                width:'min(300px, calc(100vw - 20px))', // FIX: never wider than viewport
                                background:t.modalBg,border:`1px solid ${t.borderMid}`,borderRadius:'14px',
                                boxShadow:'0 20px 50px rgba(0,0,0,0.35)',zIndex:500,overflow:'hidden',
                                animation:'slideDown 0.15s ease',
                            }}>
                                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'11px 13px',borderBottom:`1px solid ${t.border}`}}>
                                    <span style={{fontSize:'12px',fontWeight:'700',color:t.textPrimary}}>Notifications</span>
                                    <button onClick={()=>setNotifications(p=>p.map(n=>({...n,read:true})))}
                                        style={{background:'none',border:'none',color:t.accentLight,fontSize:'11px',cursor:'pointer',fontWeight:'600',fontFamily:'inherit'}}>
                                        Mark all read
                                    </button>
                                </div>
                                <div style={{maxHeight:'260px',overflowY:'auto'}}>
                                    {notifications.length===0
                                        ?<p style={{fontSize:'12px',color:t.textMuted,textAlign:'center',padding:'20px',margin:0}}>No notifications</p>
                                        :notifications.map(n=>(
                                            <div key={n.id} onClick={()=>setNotifications(p=>p.map(i=>i.id===n.id?{...i,read:true}:i))}
                                                style={{padding:'9px 13px',borderBottom:`1px solid ${t.border}`,background:n.read?'transparent':t.accentBg,cursor:'pointer'}}>
                                                <p style={{margin:'0 0 2px',fontSize:'12px',fontWeight:n.read?'500':'700',color:t.textPrimary}}>{n.title}</p>
                                                <p style={{margin:0,fontSize:'11px',color:t.textMuted,lineHeight:1.4}}>{n.message}</p>
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Profile button */}
                    <button onClick={()=>setShowProfile(true)}
                        style={{display:'flex',alignItems:'center',gap:'5px',padding:'4px 8px 4px 4px',background:t.inputBg,border:`1px solid ${t.border}`,borderRadius:'8px',cursor:'pointer'}}>
                        <div style={{width:'22px',height:'22px',borderRadius:'5px',overflow:'hidden',flexShrink:0}}>
                            {(user?.avatar||user?.avatar_url)
                                ?<img src={resolveAvatar(user.avatar||user.avatar_url)} alt="av" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                                :<div style={{width:'100%',height:'100%',background:t.accentGrad,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:'800',color:'#fff'}}>
                                    {(user?.fullName||user?.email||'?').charAt(0).toUpperCase()}
                                 </div>
                            }
                        </div>
                        <div className="dash-header-name" style={{textAlign:'left'}}>
                            <div style={{fontSize:'11px',fontWeight:'700',color:t.textPrimary,maxWidth:'75px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user?.fullName||user?.email}</div>
                            <div style={{fontSize:'9px',color:t.textMuted,textTransform:'capitalize'}}>{user?.role}</div>
                        </div>
                        <ChevronDown size={9} color={t.textMuted}/>
                    </button>

                    <button onClick={()=>setShowLogoutConfirm(true)} title="Sign out"
                        style={{padding:'6px',background:t.inputBg,border:`1px solid ${t.border}`,borderRadius:'6px',color:t.textMuted,cursor:'pointer',display:'flex'}}>
                        <LogOut size={13}/>
                    </button>
                </div>
            </header>

            {!isOnline&&(
                <div style={{padding:'6px 14px',background:t.offlineBg,borderBottom:`1px solid ${t.dangerBorder}`,display:'flex',alignItems:'center',gap:'7px',justifyContent:'center'}}>
                    <WifiOff size={11} color={t.offline}/><span style={{fontSize:'12px',color:t.offline,fontWeight:'600'}}>You're offline — some features are limited.</span>
                </div>
            )}

            <div style={{display:'flex',width:'100%',flex:1}}>
                {/* Desktop sidebar */}
                <div style={{
                    width:sidebarCollapsed?'52px':'196px',
                    height:'calc(100vh - 54px)',
                    position:'sticky',top:'54px',
                    background:t.sidebarBg,borderRight:`1px solid ${t.sidebarBorder}`,
                    flexShrink:0,transition:'width 0.22s ease',overflow:'hidden',
                    // Hide on mobile — mobile uses drawer
                    display: typeof window !== 'undefined' && window.innerWidth <= 600 ? 'none' : 'block',
                }}>
                    <Sidebar t={t} currentView={currentView} onNavigate={navigateTo}
                        collapsed={sidebarCollapsed} onToggle={()=>setSidebarCollapsed(!sidebarCollapsed)}
                        isCompany={isCompany}/>
                </div>

                {/* Mobile drawer */}
                {mobileSidebarOpen&&(
                    <>
                        <div onClick={()=>setMobileSidebarOpen(false)}
                            style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:140}}/>
                        <div style={{position:'fixed',top:'54px',left:0,height:'calc(100vh - 54px)',width:'210px',
                            zIndex:150,background:t.sidebarBg,borderRight:`1px solid ${t.sidebarBorder}`,
                            display:'flex',flexDirection:'column',overflow:'hidden',
                            boxShadow:'4px 0 30px rgba(0,0,0,0.4)',animation:'slideDown 0.2s ease'}}>
                            <Sidebar t={t} currentView={currentView} onNavigate={navigateTo}
                                collapsed={false} onToggle={()=>setMobileSidebarOpen(false)}
                                isCompany={isCompany} onMobileClose={()=>setMobileSidebarOpen(false)}/>
                        </div>
                    </>
                )}

                <main style={{flex:1,width:'100%',overflowX:'hidden',minWidth:0}}>
                    <div className="dash-stats-grid">
                        <StatCard t={t} icon={<ListTodo size={15}/>} value={tasks.length} label="Total" color={t.accent}/>
                        <StatCard t={t} icon={<Clock size={15}/>} value={tasks.filter(tk=>tk.status==='in_progress').length} label="In Progress" color={t.info}/>
                        <StatCard t={t} icon={<CheckCircle2 size={15}/>} value={tasks.filter(tk=>tk.status==='completed').length} label="Completed" color={t.success}/>
                        <StatCard t={t} icon={<AlertCircle size={15}/>} value={tasks.filter(tk=>tk.deadline&&new Date(tk.deadline)<new Date()&&tk.status!=='completed').length} label="Overdue" color={t.danger}/>
                    </div>

                    {currentView==='dashboard'&&(isCompany
                        ?<CompanyDashboard {...sharedDashProps} companyName={companyName} onAssign={setAssigningTask}/>
                        :<PersonalDashboard {...sharedDashProps} onNavigate={navigateTo}/>
                    )}
                    {currentView==='company-setup'&&<CompanyOnboarding dark={dark}/>}
                    {currentView==='team'&&(isCompany?<TeamManagement dark={dark}/>:<LockedView t={t} label="Team Management" onSetup={()=>navigateTo('company-setup')}/>)}
                    {currentView==='progress'&&(isCompany?<ProgressMonitor dark={dark}/>:<LockedView t={t} label="Progress Monitor" onSetup={()=>navigateTo('company-setup')}/>)}
                    {currentView==='reports'&&<ReportManagement dark={dark}/>}
                </main>
            </div>

            {showCreateModal&&<TaskModal t={t} title="Create New Task" onClose={()=>setShowCreateModal(false)} isOnline={isOnline}
                onSave={async(data)=>{try{await taskAPI.create(data);setShowCreateModal(false);addActivity(`Created "${data.title}"`);fetchTasks();}catch(err){return err.response?.data?.error||'Failed to create task. Please try again.';}}}/>}
            {editTask&&<TaskModal t={t} title="Edit Task" initialData={editTask} onClose={()=>setEditTask(null)} isOnline={isOnline}
                onSave={async(data)=>{try{await taskAPI.update(editTask.id,data);setEditTask(null);addActivity(`Updated "${data.title}"`);fetchTasks();}catch(err){return err.response?.data?.error||'Failed to update task. Please try again.';}}}/>}
            {deleteTarget&&<DeleteTaskModal t={t} task={deleteTarget} loading={deleteLoading} onConfirm={confirmDeleteTask} onCancel={()=>!deleteLoading&&setDeleteTarget(null)}/>}
            {showProfile&&<ProfileModal t={t} user={user} isOnline={isOnline} onClose={()=>setShowProfile(false)} onSave={handleProfileSave} onDeleteAccount={handleDeleteAccount}/>}
            {showLogoutConfirm&&<LogoutModal t={t} onConfirm={()=>{try{sessionStorage.removeItem('syncline_view');}catch(_){}logout();}} onCancel={()=>setShowLogoutConfirm(false)}/>}
            {showNotifications&&<div onClick={()=>setShowNotifications(false)} style={{position:'fixed',inset:0,zIndex:490}}/>}
            {assigningTask&&<TaskAssignmentModal task={assigningTask} dark={dark} onClose={()=>setAssigningTask(null)} onAssigned={()=>{setAssigningTask(null);fetchTasks();}}/>}
        </div>
    );
};

export default Dashboard;