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
        api.get('/users/online')
};

export default api;