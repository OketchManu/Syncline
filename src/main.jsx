// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// ── Styles ────────────────────────────────────────────────────────────────────
import "../web/src/index.css";
import "../web/src/App.css";

// ── Auth context ──────────────────────────────────────────────────────────────
import { AuthProvider, useAuth } from "../web/src/context/AuthContext.jsx";

// ── Components ────────────────────────────────────────────────────────────────
import Login          from "../web/src/components/auth/Login.jsx";
import Register       from "../web/src/components/auth/Register.jsx";
import Dashboard      from "../web/src/components/dashboard/Dashboard.jsx";
import ErrorBoundary  from "../web/src/components/ErrorBoundary.jsx";

// ── Optional auth pages (only import if files exist) ─────────────────────────
// Remove any that don't exist yet to prevent white screen
// import ForgotPassword from "../web/src/components/auth/ForgotPassword.jsx";
// import ResetPassword  from "../web/src/components/auth/ResetPassword.jsx";
// import JoinCompany    from "../web/src/components/auth/JoinCompany.jsx";

// ── Protected route ───────────────────────────────────────────────────────────
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#05080f",
        flexDirection: "column",
        gap: "14px",
      }}>
        <div style={{
          width: "38px",
          height: "38px",
          border: "3px solid rgba(124,58,237,0.2)",
          borderTop: "3px solid #7c3aed",
          borderRadius: "50%",
          animation: "spin 0.75s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ color: "#3d4f6e", fontSize: "13px", margin: 0, fontFamily: "system-ui" }}>
          Loading Syncline…
        </p>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/login"    element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            {/* Catch-all */}
            <Route path="/"  element={<Navigate to="/dashboard" replace />} />
            <Route path="*"  element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);