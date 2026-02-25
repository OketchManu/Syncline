// web/src/context/AuthContext.jsx
// Authentication context for managing user state

import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import wsService from '../services/websocket';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Check for existing session on mount
    useEffect(() => {
        const initAuth = async () => {
            const token = localStorage.getItem('accessToken');
            const savedUser = localStorage.getItem('user');

            if (token && savedUser) {
                try {
                    setUser(JSON.parse(savedUser));
                    // Connect to WebSocket
                    wsService.connect(token);
                } catch (error) {
                    console.error('Failed to restore session:', error);
                    logout();
                }
            }
            setLoading(false);
        };

        initAuth();
    }, []);

    const login = async (email, password) => {
        try {
            setError(null);
            const response = await authAPI.login(email, password);
            const { user, accessToken, refreshToken } = response.data;

            // Save to localStorage
            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('refreshToken', refreshToken);
            localStorage.setItem('user', JSON.stringify(user));

            setUser(user);

            // Connect to WebSocket
            wsService.connect(accessToken);

            return { success: true };
        } catch (error) {
            const message = error.response?.data?.error || 'Login failed';
            setError(message);
            return { success: false, error: message };
        }
    };

    const register = async (email, password, fullName) => {
        try {
            setError(null);
            const response = await authAPI.register(email, password, fullName);
            const { user, accessToken, refreshToken } = response.data;

            // Save to localStorage
            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('refreshToken', refreshToken);
            localStorage.setItem('user', JSON.stringify(user));

            setUser(user);

            // Connect to WebSocket
            wsService.connect(accessToken);

            return { success: true };
        } catch (error) {
            const message = error.response?.data?.error || 'Registration failed';
            setError(message);
            return { success: false, error: message };
        }
    };

    const logout = () => {
        // Disconnect WebSocket
        wsService.disconnect();

        // Clear localStorage
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');

        setUser(null);
        setError(null);
    };

    const value = {
        user,
        loading,
        error,
        login,
        register,
        logout,
        isAuthenticated: !!user
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};