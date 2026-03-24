// web/src/services/api.js
// API service for making HTTP requests to backend

import axios from 'axios';
import { auth } from '../firebase';

const API_BASE_URL = 'http://localhost:3001/api';

// Create axios instance with default config
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// ─── Request interceptor — always attach a fresh Firebase ID token ────────────
api.interceptors.request.use(
    async (config) => {
        const fbUser = auth.currentUser;
        if (fbUser) {
            // forceRefresh=false uses cached token unless it's expired
            const token = await fbUser.getIdToken(false);
            config.headers['Authorization'] = `Bearer ${token}`;
        } else {
            // Fallback to localStorage token for non-Firebase flows
            const token = localStorage.getItem('accessToken');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// ─── Response interceptor — retry once with a fresh token on 401 ─────────────
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            const fbUser = auth.currentUser;
            if (fbUser) {
                try {
                    const token = await fbUser.getIdToken(true); // force refresh
                    originalRequest.headers['Authorization'] = `Bearer ${token}`;
                    return api(originalRequest);
                } catch (_) {
                    // Token refresh failed — user will be signed out by onAuthStateChanged
                }
            } else {
                // Non-Firebase flow: clear stored tokens and redirect
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem('user');
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

// ═══════════════════════════════════════════════════════════════
// AUTH ENDPOINTS
// ═══════════════════════════════════════════════════════════════

export const authAPI = {
    login: (email, password) =>
        api.post('/auth/login', { email, password }),

    register: (email, password, fullName, accountType = 'individual', companyName = null) =>
        api.post('/auth/register', {
            email,
            password,
            fullName,
            accountType,
            companyName
        }),

    refreshToken: (refreshToken) =>
        api.post('/auth/refresh', { refreshToken }),

    getCurrentUser: () =>
        api.get('/auth/me'),

    // Alias kept for compatibility
    me: () =>
        api.get('/auth/me'),

    logout: () =>
        api.post('/auth/logout'),

    // Sync Firebase-authenticated user with the backend
    firebaseSync: (data) =>
        api.post('/auth/firebase-sync', data),
};

// ═══════════════════════════════════════════════════════════════
// TASK ENDPOINTS
// ═══════════════════════════════════════════════════════════════

export const taskAPI = {
    getAll: (filters = {}) => {
        const params = new URLSearchParams();
        Object.keys(filters).forEach(key => {
            if (filters[key]) params.append(key, filters[key]);
        });
        return api.get(`/tasks?${params.toString()}`);
    },

    getById: (id) =>
        api.get(`/tasks/${id}`),

    getMy: () =>
        api.get('/tasks/my'),

    getStats: (userId = null) =>
        api.get(`/tasks/stats${userId ? `?userId=${userId}` : ''}`),

    getOverdue: () =>
        api.get('/tasks/overdue'),

    create: (taskData) =>
        api.post('/tasks', taskData),

    update: (id, updates) =>
        api.put(`/tasks/${id}`, updates),

    flag: (id, reason) =>
        api.patch(`/tasks/${id}/flag`, { reason }),

    unflag: (id) =>
        api.patch(`/tasks/${id}/unflag`),

    delete: (id) =>
        api.delete(`/tasks/${id}`)
};

// ═══════════════════════════════════════════════════════════════
// USER ENDPOINTS
// ═══════════════════════════════════════════════════════════════

export const userAPI = {
    getAll: () =>
        api.get('/users'),

    getById: (id) =>
        api.get(`/users/${id}`),

    getOnline: () =>
        api.get('/users/online'),

    getProfile: () =>
        api.get('/user/profile'),

    // Update name and/or avatar photo
    updateProfile: (data) => {
        if (data instanceof FormData) {
            return api.put('/users/me', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
        }
        return api.put('/users/me', data);
    },

    // Change password
    changePassword: (data) =>
        api.put('/users/me/password', data),

    // Delete account
    deleteAccount: (data) =>
        api.delete('/users/me', { data }),
};

// ═══════════════════════════════════════════════════════════════
// COMPANY MANAGEMENT ENDPOINTS
// ═══════════════════════════════════════════════════════════════

export const companyAPI = {
    // Company registration & details
    register: (data) =>
        api.post('/company/register', data),

    getDetails: () =>
        api.get('/company/details'),

    updateDetails: (data) =>
        api.patch('/company/details', data),

    // Team management
    getTeam: (filters = {}) =>
        api.get('/company/team', { params: filters }),

    inviteMember: (data) =>
        api.post('/company/team/invite', data),

    updateMemberRole: (userId, role) =>
        api.patch(`/company/team/${userId}/role`, { role }),

    updateMemberStatus: (userId, isActive) =>
        api.patch(`/company/team/${userId}/status`, { is_active: isActive }),

    removeMember: (userId) =>
        api.delete(`/company/team/${userId}`),

    // Join flow
    join: (code) =>
        api.post(`/company/join/${code}`),

    myStatus: () =>
        api.get('/company/my-status'),

    // Join requests (incoming requests to join the company)
    getJoinRequests: () =>
        api.get('/company/join-requests'),

    resolveRequest: (id, action) =>
        api.patch(`/company/join-requests/${id}/${action}`),

    // Invitations
    getInvitations: () =>
        api.get('/company/invitations'),

    deleteInvitation: (id) =>
        api.delete(`/company/invitations/${id}`),

    // Departments
    getDepartments: () =>
        api.get('/company/departments'),

    createDepartment: (data) =>
        api.post('/company/departments', data),

    updateDepartment: (deptId, data) =>
        api.patch(`/company/departments/${deptId}`, data),

    deleteDepartment: (deptId) =>
        api.delete(`/company/departments/${deptId}`),

    // Analytics & Performance
    getAnalytics: (period = 30) =>
        api.get('/company/analytics', { params: { period } }),

    getPerformance: (departmentId = null) =>
        api.get('/company/performance', { params: { department_id: departmentId } })
};

// ═══════════════════════════════════════════════════════════════
// TASK ASSIGNMENT & REPORTS ENDPOINTS
// ═══════════════════════════════════════════════════════════════

export const taskReportsAPI = {
    // Task assignment
    assignTask: (taskId, data) =>
        api.post(`/tasks/${taskId}/assign`, data),

    getAssignments: (taskId) =>
        api.get(`/tasks/${taskId}/assignments`),

    // Progress tracking
    submitProgress: (taskId, data) =>
        api.post(`/tasks/${taskId}/progress`, data),

    getProgress: (taskId) =>
        api.get(`/tasks/${taskId}/progress`),

    // Report management
    requestReport: (taskId, data) =>
        api.post(`/tasks/${taskId}/request-report`, data),

    getMyReportRequests: () =>
        api.get('/tasks/my-report-requests'),

    submitReport: (taskId, data) =>
        api.post(`/tasks/${taskId}/reports`, data),

    getReports: (taskId) =>
        api.get(`/tasks/${taskId}/reports`),

    getMyReports: () =>
        api.get('/tasks/my-reports'),

    reviewReport: (reportId, data) =>
        api.patch(`/reports/${reportId}/review`, data),

    // User overview
    getUserOverview: (userId) =>
        api.get(`/tasks/user/${userId}/overview`)
};

// ═══════════════════════════════════════════════════════════════
// STANDALONE REPORT ENDPOINTS
// ═══════════════════════════════════════════════════════════════

export const reportAPI = {
    getAll:  ()         => api.get('/task-reports'),
    create:  (data)     => api.post('/task-reports', data),
    approve: (id, data) => api.patch(`/task-reports/${id}/approve`, data),
    reject:  (id, data) => api.patch(`/task-reports/${id}/reject`, data),
    delete:  (id)       => api.delete(`/task-reports/${id}`),
};

export default api;