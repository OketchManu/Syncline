// web/src/services/api.js
// API service for making HTTP requests to backend

import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';

// Create axios instance with default config
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Add token to requests automatically
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('accessToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Handle token expiration
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Token expired or invalid
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// Auth endpoints
export const authAPI = {
    login: (email, password) => 
        api.post('/auth/login', { email, password }),
    
    register: (email, password, fullName) => 
        api.post('/auth/register', { email, password, fullName }),
    
    refreshToken: (refreshToken) => 
        api.post('/auth/refresh', { refreshToken }),
    
    getCurrentUser: () => 
        api.get('/auth/me'),
    
    logout: () => 
        api.post('/auth/logout')
};

// Task endpoints
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

// User endpoints
export const userAPI = {
    getAll: () =>
        api.get('/users'),

    getById: (id) =>
        api.get(`/users/${id}`),

    getOnline: () =>
        api.get('/users/online'),

    // Update name and/or avatar photo.
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
// COMPANY MANAGEMENT ENDPOINTS (NEW)
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
// TASK ASSIGNMENT & REPORTS ENDPOINTS (NEW)
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

export default api;