// web/src/context/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

// ─── Normalise user object from API ──────────────────────────────────────────
// The API returns snake_case (account_type, org_id) but the frontend uses
// camelCase (accountType, orgId). This function converts both and ensures
// accountType is always 'company' or 'personal' (never 'individual').
const normaliseUser = (raw) => {
    if (!raw) return null;

    // Resolve account type — API may return snake_case or camelCase
    const rawType = raw.accountType || raw.account_type || 'personal';

    // 'individual' was an old value — treat it as 'personal'
    const accountType = rawType === 'company' ? 'company' : 'personal';

    return {
        ...raw,
        accountType,
        account_type: accountType,          // keep both for safety
        orgId:        raw.orgId      ?? raw.org_id      ?? null,
        org_id:       raw.org_id     ?? raw.orgId       ?? null,
        companyId:    raw.companyId  ?? raw.company_id  ?? null,
        company_id:   raw.company_id ?? raw.companyId   ?? null,
    };
};

// ─── Provider ─────────────────────────────────────────────────────────────────
export const AuthProvider = ({ children }) => {
    const [user,    setUser]    = useState(null);
    const [loading, setLoading] = useState(true);

    const API_URL = 'http://localhost:3001/api';

    // ── Restore session on mount ──────────────────────────────────────────────
    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('accessToken');
            if (token) {
                try {
                    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                    const response = await axios.get(`${API_URL}/auth/me`);
                    setUser(normaliseUser(response.data.user));
                } catch (error) {
                    console.error('Auth check failed:', error);
                    localStorage.removeItem('accessToken');
                    localStorage.removeItem('refreshToken');
                    delete axios.defaults.headers.common['Authorization'];
                }
            }
            setLoading(false);
        };

        checkAuth();
    }, []);

    // ── Login ─────────────────────────────────────────────────────────────────
    const login = async (email, password) => {
        try {
            const response = await axios.post(`${API_URL}/auth/login`, {
                email,
                password,
            });

            const { accessToken, refreshToken, user: userData } = response.data;

            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('refreshToken', refreshToken);
            axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

            setUser(normaliseUser(userData));

            return { success: true };
        } catch (error) {
            console.error('Login error:', error);
            return {
                success: false,
                error: error.response?.data?.error ||
                       error.response?.data?.message ||
                       'Login failed. Please try again.',
            };
        }
    };

    // ── Register ──────────────────────────────────────────────────────────────
    const register = async (email, password, fullName, accountType = 'personal', companyName = null) => {
        try {
            const response = await axios.post(`${API_URL}/auth/register`, {
                email,
                password,
                fullName,
                // Always send 'company' or 'personal' — never 'individual'
                accountType: accountType === 'company' ? 'company' : 'personal',
                companyName,
            });

            const { accessToken, refreshToken, user: userData } = response.data;

            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('refreshToken', refreshToken);
            axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

            setUser(normaliseUser(userData));

            return { success: true };
        } catch (error) {
            console.error('Registration error:', error);
            return {
                success: false,
                error: error.response?.data?.error ||
                       error.response?.data?.message ||
                       'Registration failed. Please try again.',
            };
        }
    };

    // ── Logout ────────────────────────────────────────────────────────────────
    const logout = () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        delete axios.defaults.headers.common['Authorization'];
        setUser(null);
    };

    // ── Update user (e.g. after profile save) ─────────────────────────────────
    const updateUser = (userData) => {
        setUser(prev => normaliseUser({ ...prev, ...userData }));
    };

    // ── Helpers ───────────────────────────────────────────────────────────────
    const hasCompanyFeatures = () => user?.accountType === 'company';
    const isCompanyOwner     = () => user?.accountType === 'company' && user?.role === 'owner';

    const value = {
        user,
        login,
        register,
        logout,
        updateUser,
        hasCompanyFeatures,
        isCompanyOwner,
        loading,
        isAuthenticated: !!user,
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};