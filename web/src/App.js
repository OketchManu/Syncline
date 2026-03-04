// web/src/App.js
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import Dashboard from './components/dashboard/Dashboard';

// Company Management Components
import CompanyOnboarding from './components/company/CompanyOnboarding';
import TeamManagement from './components/company/TeamManagement';
import ProgressMonitor from './components/company/ProgressMonitor';
import ReportManagement from './components/company/ReportManagement';

import './App.css';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return (
            <div style={styles.loading}>
                <div style={styles.spinner}></div>
                <p>Loading Syncline...</p>
            </div>
        );
    }

    return isAuthenticated ? children : <Navigate to="/login" />;
};

// Public Route (redirect if already logged in)
const PublicRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return (
            <div style={styles.loading}>
                <div style={styles.spinner}></div>
                <p>Loading...</p>
            </div>
        );
    }

    return !isAuthenticated ? children : <Navigate to="/dashboard" />;
};

function AppRoutes() {
    return (
        <Routes>
            {/* Public Routes */}
            <Route 
                path="/login" 
                element={
                    <PublicRoute>
                        <Login />
                    </PublicRoute>
                } 
            />
            <Route 
                path="/register" 
                element={
                    <PublicRoute>
                        <Register />
                    </PublicRoute>
                } 
            />

            {/* Protected Routes */}
            <Route 
                path="/dashboard" 
                element={
                    <ProtectedRoute>
                        <Dashboard />
                    </ProtectedRoute>
                } 
            />

            {/* Company Management Routes */}
            <Route 
                path="/company/setup" 
                element={
                    <ProtectedRoute>
                        <CompanyOnboarding />
                    </ProtectedRoute>
                } 
            />
            <Route 
                path="/company/team" 
                element={
                    <ProtectedRoute>
                        <TeamManagement />
                    </ProtectedRoute>
                } 
            />
            <Route 
                path="/company/progress" 
                element={
                    <ProtectedRoute>
                        <ProgressMonitor />
                    </ProtectedRoute>
                } 
            />
            <Route 
                path="/company/reports" 
                element={
                    <ProtectedRoute>
                        <ReportManagement />
                    </ProtectedRoute>
                } 
            />

            {/* Fallback Routes */}
            <Route 
                path="/" 
                element={<Navigate to="/dashboard" />} 
            />
            <Route 
                path="*" 
                element={<Navigate to="/dashboard" />} 
            />
        </Routes>
    );
}

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <AppRoutes />
            </AuthProvider>
        </BrowserRouter>
    );
}

const styles = {
    loading: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#f5f5f5'
    },
    spinner: {
        width: '50px',
        height: '50px',
        border: '4px solid #f3f3f3',
        borderTop: '4px solid #667eea',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
    }
};

export default App;