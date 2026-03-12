// web/src/App.js
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import Dashboard from './components/dashboard/Dashboard';
import ForgotPassword from './components/auth/ForgotPassword.jsx';
import ResetPassword from './components/auth/ResetPassword.jsx';
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
            <div className="loading-container">
                <div className="loading-spinner"></div>
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
            <div className="loading-container">
                <div className="loading-spinner"></div>
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

            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password"  element={<ResetPassword />} />

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

export default App;