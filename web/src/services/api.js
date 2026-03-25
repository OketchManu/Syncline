// web/src/services/api.js
import axios from 'axios';
import { auth } from '../firebase.js';

const API_BASE_URL = 'https://syncline-1.onrender.com/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'Content-Type': 'application/json' }
});

// ─── Request interceptor — attach fresh Firebase ID token ────────────────────
api.interceptors.request.use(
    async (config) => {
        const fbUser = auth.currentUser;
        if (fbUser) {
            const token = await fbUser.getIdToken(false);
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// ─── Response interceptor — retry once on 401 ────────────────────────────────
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            const fbUser = auth.currentUser;
            if (fbUser) {
                try {
                    const token = await fbUser.getIdToken(true);
                    originalRequest.headers['Authorization'] = `Bearer ${token}`;
                    return api(originalRequest);
                } catch (_) {}
            }
        }
        return Promise.reject(error);
    }
);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authAPI = {
    me:            ()     => api.get('/auth/me'),
    register:      (data) => api.post('/auth/register', data),
    firebaseSync:  (data) => api.post('/auth/firebase-sync', data),
    logout:        ()     => api.post('/auth/logout'),
};

// ─── Tasks ────────────────────────────────────────────────────────────────────
export const taskAPI = {
    getAll:  (filters = {}) => api.get('/tasks', { params: filters }),
    getById: (id)           => api.get(`/tasks/${id}`),
    create:  (data)         => api.post('/tasks', data),
    update:  (id, data)     => api.put(`/tasks/${id}`, data),
    delete:  (id)           => api.delete(`/tasks/${id}`),
    flag:    (id, reason)   => api.patch(`/tasks/${id}/flag`, { reason }),
    unflag:  (id)           => api.patch(`/tasks/${id}/unflag`),
};

// ─── Users ────────────────────────────────────────────────────────────────────
export const userAPI = {
    updateProfile:  (data) => {
        if (data instanceof FormData) {
            return api.put('/users/me', data, { headers: { 'Content-Type': 'multipart/form-data' } });
        }
        return api.put('/users/me', data);
    },
    changePassword: (data) => api.put('/users/me/password', data),
    deleteAccount:  (data) => api.delete('/users/me', { data }),
};

// ─── Company ──────────────────────────────────────────────────────────────────
export const companyAPI = {
    getTeam:          ()           => api.get('/company/team'),
    updateDetails:    (data)       => api.patch('/company/details', data),
    getJoinRequests:  ()           => api.get('/company/join-requests'),
    resolveRequest:   (id, action) => api.patch(`/company/join-requests/${id}/${action}`),
    join:             (code)       => api.post(`/company/join/${code}`),
    myStatus:         ()           => api.get('/company/my-status'),
    updateMemberRole: (id, role)   => api.patch(`/company/team/${id}/role`, { role }),
    removeMember:     (id)         => api.delete(`/company/team/${id}`),
    getInvitations:   ()           => api.get('/company/invitations'),
    deleteInvitation: (id)         => api.delete(`/company/invitations/${id}`),
};

// ─── Reports ──────────────────────────────────────────────────────────────────
export const reportAPI = {
    getAll:  ()           => api.get('/task-reports'),
    create:  (data)       => api.post('/task-reports', data),
    approve: (id, data)   => api.patch(`/task-reports/${id}/approve`, data),
    reject:  (id, data)   => api.patch(`/task-reports/${id}/reject`, data),
    delete:  (id)         => api.delete(`/task-reports/${id}`),
};

export default api;