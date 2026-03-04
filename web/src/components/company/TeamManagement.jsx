// web/src/components/company/TeamManagement.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import {
    Users, Plus, Mail, Trash2, Shield, UserCheck, UserX,
    Search, Filter, MoreVertical, Crown, Award, X, Check,
    AlertCircle, Building2, Send
} from 'lucide-react';
import './TeamManagement.css';

const TeamManagement = () => {
    const { user } = useAuth();
    const [members, setMembers] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterRole, setFilterRole] = useState('all');
    const [filterDept, setFilterDept] = useState('all');

    // Invite form state
    const [inviteData, setInviteData] = useState({
        email: '',
        role: 'member',
        department_id: ''
    });
    const [inviteLoading, setInviteLoading] = useState(false);
    const [inviteError, setInviteError] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [membersRes, deptsRes] = await Promise.all([
                api.get('/company/team'),
                api.get('/company/departments')
            ]);
            setMembers(membersRes.data.members || []);
            setDepartments(deptsRes.data.departments || []);
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleInvite = async (e) => {
        e.preventDefault();
        setInviteLoading(true);
        setInviteError('');

        try {
            await api.post('/company/team/invite', inviteData);
            
            // Success!
            setShowInviteModal(false);
            setInviteData({ email: '', role: 'member', department_id: '' });
            
            // Show success message
            alert('✅ Invitation sent successfully!');
            
        } catch (err) {
            setInviteError(err.response?.data?.error || 'Failed to send invitation');
        } finally {
            setInviteLoading(false);
        }
    };

    const handleRemoveMember = async (member) => {
        if (!window.confirm(`Remove ${member.full_name} from the team?`)) return;

        try {
            await api.delete(`/company/team/${member.id}`);
            setMembers(members.filter(m => m.id !== member.id));
            alert('✅ User removed successfully');
        } catch (err) {
            alert('❌ ' + (err.response?.data?.error || 'Failed to remove user'));
        }
    };

    const handleChangeRole = async (member, newRole) => {
        if (!window.confirm(`Change ${member.full_name}'s role to ${newRole}?`)) return;

        try {
            await api.patch(`/company/team/${member.id}/role`, { role: newRole });
            setMembers(members.map(m => 
                m.id === member.id ? { ...m, role: newRole } : m
            ));
            alert('✅ Role updated successfully');
        } catch (err) {
            alert('❌ ' + (err.response?.data?.error || 'Failed to update role'));
        }
    };

    const handleToggleActive = async (member) => {
        const action = member.is_active ? 'deactivate' : 'activate';
        if (!window.confirm(`${action} ${member.full_name}'s account?`)) return;

        try {
            await api.patch(`/company/team/${member.id}/status`, { 
                is_active: !member.is_active 
            });
            setMembers(members.map(m => 
                m.id === member.id ? { ...m, is_active: !m.is_active } : m
            ));
            alert(`✅ User ${action}d successfully`);
        } catch (err) {
            alert('❌ Failed to update status');
        }
    };

    // Filter members
    const filteredMembers = members.filter(member => {
        const matchesSearch = 
            member.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            member.email.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesRole = filterRole === 'all' || member.role === filterRole;
        const matchesDept = filterDept === 'all' || member.department_id === parseInt(filterDept);

        return matchesSearch && matchesRole && matchesDept;
    });

    // Role badge component
    const RoleBadge = ({ role }) => {
        const styles = {
            owner: { bg: '#fef3c7', color: '#92400e', icon: <Crown size={12} /> },
            admin: { bg: '#dbeafe', color: '#1e40af', icon: <Shield size={12} /> },
            manager: { bg: '#e0e7ff', color: '#4338ca', icon: <Award size={12} /> },
            member: { bg: '#f3f4f6', color: '#374151', icon: <UserCheck size={12} /> }
        };
        const style = styles[role] || styles.member;

        return (
            <span className="role-badge" style={{ background: style.bg, color: style.color }}>
                {style.icon}
                <span>{role}</span>
            </span>
        );
    };

    // Stats cards
    const stats = {
        total: members.length,
        active: members.filter(m => m.is_active).length,
        managers: members.filter(m => m.role === 'manager' || m.role === 'admin').length,
        departments: departments.length
    };

    if (loading) {
        return (
            <div className="team-management loading">
                <div className="spinner"></div>
                <p>Loading team...</p>
            </div>
        );
    }

    return (
        <div className="team-management">
            {/* Header */}
            <div className="tm-header">
                <div className="tm-title">
                    <Users size={24} />
                    <div>
                        <h1>Team Management</h1>
                        <p>Manage your team members and permissions</p>
                    </div>
                </div>

                <button 
                    className="btn-primary"
                    onClick={() => setShowInviteModal(true)}
                >
                    <Plus size={18} />
                    Invite Member
                </button>
            </div>

            {/* Stats */}
            <div className="tm-stats">
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#dbeafe' }}>
                        <Users size={20} color="#1e40af" />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{stats.total}</span>
                        <span className="stat-label">Total Members</span>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#dcfce7' }}>
                        <UserCheck size={20} color="#15803d" />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{stats.active}</span>
                        <span className="stat-label">Active</span>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#e0e7ff' }}>
                        <Shield size={20} color="#4338ca" />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{stats.managers}</span>
                        <span className="stat-label">Managers</span>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#fef3c7' }}>
                        <Building2 size={20} color="#92400e" />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{stats.departments}</span>
                        <span className="stat-label">Departments</span>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="tm-filters">
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search members..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')}>
                            <X size={16} />
                        </button>
                    )}
                </div>

                <div className="filter-group">
                    <Filter size={18} />
                    <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
                        <option value="all">All Roles</option>
                        <option value="owner">Owner</option>
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="member">Member</option>
                    </select>

                    <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
                        <option value="all">All Departments</option>
                        {departments.map(dept => (
                            <option key={dept.id} value={dept.id}>{dept.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Members Table */}
            <div className="tm-table-container">
                <table className="tm-table">
                    <thead>
                        <tr>
                            <th>Member</th>
                            <th>Role</th>
                            <th>Department</th>
                            <th>Status</th>
                            <th>Joined</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredMembers.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="empty-state">
                                    <Users size={48} />
                                    <p>No members found</p>
                                </td>
                            </tr>
                        ) : filteredMembers.map(member => (
                            <tr key={member.id} className={!member.is_active ? 'inactive' : ''}>
                                <td>
                                    <div className="member-info">
                                        <div className="member-avatar">
                                            {member.avatar ? (
                                                <img src={member.avatar} alt={member.full_name} />
                                            ) : (
                                                <span>{member.full_name.charAt(0).toUpperCase()}</span>
                                            )}
                                        </div>
                                        <div>
                                            <div className="member-name">{member.full_name}</div>
                                            <div className="member-email">{member.email}</div>
                                        </div>
                                    </div>
                                </td>

                                <td>
                                    <RoleBadge role={member.role} />
                                </td>

                                <td>
                                    <span className="dept-badge">
                                        {member.department_name || 'No Department'}
                                    </span>
                                </td>

                                <td>
                                    <span className={`status-badge ${member.is_active ? 'active' : 'inactive'}`}>
                                        {member.is_active ? (
                                            <><Check size={14} /> Active</>
                                        ) : (
                                            <><X size={14} /> Inactive</>
                                        )}
                                    </span>
                                </td>

                                <td>
                                    {new Date(member.created_at).toLocaleDateString()}
                                </td>

                                <td>
                                    <div className="action-buttons">
                                        {member.id !== user.id && (
                                            <>
                                                <div className="dropdown">
                                                    <button className="btn-icon">
                                                        <MoreVertical size={16} />
                                                    </button>
                                                    <div className="dropdown-menu">
                                                        {user.role === 'owner' && member.role !== 'owner' && (
                                                            <>
                                                                <button onClick={() => handleChangeRole(member, 'admin')}>
                                                                    <Shield size={14} /> Make Admin
                                                                </button>
                                                                <button onClick={() => handleChangeRole(member, 'manager')}>
                                                                    <Award size={14} /> Make Manager
                                                                </button>
                                                                <button onClick={() => handleChangeRole(member, 'member')}>
                                                                    <UserCheck size={14} /> Make Member
                                                                </button>
                                                                <div className="dropdown-divider"></div>
                                                            </>
                                                        )}
                                                        <button onClick={() => handleToggleActive(member)}>
                                                            {member.is_active ? (
                                                                <><UserX size={14} /> Deactivate</>
                                                            ) : (
                                                                <><UserCheck size={14} /> Activate</>
                                                            )}
                                                        </button>
                                                        <button 
                                                            className="danger"
                                                            onClick={() => handleRemoveMember(member)}
                                                        >
                                                            <Trash2 size={14} /> Remove
                                                        </button>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="modal-overlay" onClick={() => setShowInviteModal(false)}>
                    <div className="modal invite-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">
                                <Mail size={20} />
                                <h3>Invite Team Member</h3>
                            </div>
                            <button onClick={() => setShowInviteModal(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleInvite} className="modal-body">
                            {inviteError && (
                                <div className="error-alert">
                                    <AlertCircle size={16} />
                                    <span>{inviteError}</span>
                                </div>
                            )}

                            <div className="form-group">
                                <label>Email Address *</label>
                                <input
                                    type="email"
                                    value={inviteData.email}
                                    onChange={(e) => setInviteData({...inviteData, email: e.target.value})}
                                    placeholder="colleague@company.com"
                                    required
                                    autoFocus
                                />
                            </div>

                            <div className="form-group">
                                <label>Role *</label>
                                <select
                                    value={inviteData.role}
                                    onChange={(e) => setInviteData({...inviteData, role: e.target.value})}
                                >
                                    {user.role === 'owner' && (
                                        <>
                                            <option value="admin">Admin - Full access</option>
                                            <option value="manager">Manager - Team management</option>
                                        </>
                                    )}
                                    <option value="member">Member - Task execution</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Department</label>
                                <select
                                    value={inviteData.department_id}
                                    onChange={(e) => setInviteData({...inviteData, department_id: e.target.value})}
                                >
                                    <option value="">No Department</option>
                                    {departments.map(dept => (
                                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => setShowInviteModal(false)}
                                    disabled={inviteLoading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn-primary"
                                    disabled={inviteLoading || !inviteData.email}
                                >
                                    {inviteLoading ? 'Sending...' : (
                                        <>
                                            <Send size={16} />
                                            Send Invitation
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeamManagement;