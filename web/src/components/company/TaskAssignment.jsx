// web/src/components/company/TaskAssignment.jsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import {
    UserPlus, X, Search, Check, AlertCircle,
    Users
} from 'lucide-react';
import './TaskAssignment.css';

const TaskAssignmentModal = ({ task, onClose, onAssigned }) => {
    const [members, setMembers] = useState([]);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [requireReport, setRequireReport] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchCurrentAssignments = useCallback(async () => {
        try {
            const res = await api.get(`/tasks/${task.id}/assignments`);
            const assigned = res.data.assignments.map(a => a.user_id);
            setSelectedUsers(assigned);
        } catch (err) {
            console.error('Fetch assignments error:', err);
        }
    }, [task.id]);

    useEffect(() => {
        fetchMembers();
        // Load current assignments
        if (task.id) {
            fetchCurrentAssignments();
        }
    }, [task.id, fetchCurrentAssignments]);

    const fetchMembers = async () => {
        try {
            const res = await api.get('/company/team', { params: { active: true } });
            setMembers(res.data.members || []);
        } catch (err) {
            console.error('Fetch members error:', err);
        }
    };

    const toggleUser = (userId) => {
        if (selectedUsers.includes(userId)) {
            setSelectedUsers(selectedUsers.filter(id => id !== userId));
        } else {
            setSelectedUsers([...selectedUsers, userId]);
        }
    };

    const handleAssign = async () => {
        if (selectedUsers.length === 0) {
            setError('Please select at least one team member');
            return;
        }

        setLoading(true);
        setError('');

        try {
            await api.post(`/tasks/${task.id}/assign`, {
                user_ids: selectedUsers,
                require_report: requireReport
            });

            if (onAssigned) onAssigned();
            onClose();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to assign task');
        } finally {
            setLoading(false);
        }
    };

    const filteredMembers = members.filter(m =>
        m.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal task-assign-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-title">
                        <UserPlus size={20} />
                        <div>
                            <h3>Assign Task</h3>
                            <p className="task-title">{task.title}</p>
                        </div>
                    </div>
                    <button onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-body">
                    {error && (
                        <div className="error-alert">
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Search */}
                    <div className="search-box">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="Search team members..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Member Selection */}
                    <div className="member-selection">
                        <div className="selection-header">
                            <span>{selectedUsers.length} member(s) selected</span>
                            {selectedUsers.length > 0 && (
                                <button
                                    className="btn-text"
                                    onClick={() => setSelectedUsers([])}
                                >
                                    Clear all
                                </button>
                            )}
                        </div>

                        <div className="member-list">
                            {filteredMembers.length === 0 ? (
                                <div className="empty-state">
                                    <Users size={32} />
                                    <p>No team members found</p>
                                </div>
                            ) : filteredMembers.map(member => (
                                <div
                                    key={member.id}
                                    className={`member-item ${selectedUsers.includes(member.id) ? 'selected' : ''}`}
                                    onClick={() => toggleUser(member.id)}
                                >
                                    <div className="member-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={selectedUsers.includes(member.id)}
                                            onChange={() => {}}
                                        />
                                        <div className="checkbox-custom">
                                            {selectedUsers.includes(member.id) && <Check size={14} />}
                                        </div>
                                    </div>

                                    <div className="member-avatar">
                                        {member.avatar ? (
                                            <img src={member.avatar} alt={member.full_name} />
                                        ) : (
                                            <span>{member.full_name.charAt(0).toUpperCase()}</span>
                                        )}
                                    </div>

                                    <div className="member-details">
                                        <div className="member-name">{member.full_name}</div>
                                        <div className="member-meta">
                                            {member.email} • {member.role}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Options */}
                    <div className="assignment-options">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={requireReport}
                                onChange={(e) => setRequireReport(e.target.checked)}
                            />
                            <div className="checkbox-custom">
                                {requireReport && <Check size={14} />}
                            </div>
                            <div>
                                <span>Require completion report</span>
                                <p>Team members must submit a report when task is completed</p>
                            </div>
                        </label>
                    </div>
                </div>

                <div className="modal-actions">
                    <button
                        className="btn-secondary"
                        onClick={onClose}
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        className="btn-primary"
                        onClick={handleAssign}
                        disabled={loading || selectedUsers.length === 0}
                    >
                        {loading ? 'Assigning...' : `Assign to ${selectedUsers.length} member(s)`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TaskAssignmentModal;