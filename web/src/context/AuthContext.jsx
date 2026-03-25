// src/context/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  auth,
  googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  onAuthStateChanged
} from '../../../src/firebase.js';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};

const API_URL = 'https://syncline1.onrender.com/api';

// ─── Normalise user object from backend ───────────────────────────────────────
const normaliseUser = (raw) => {
    if (!raw) return null;
    const rawType     = raw.accountType || raw.account_type || 'personal';
    const accountType = rawType === 'company' ? 'company' : 'personal';
    return {
        ...raw,
        accountType,
        account_type: accountType,
        orgId:      raw.orgId      ?? raw.org_id      ?? null,
        org_id:     raw.org_id     ?? raw.orgId       ?? null,
        companyId:  raw.companyId  ?? raw.company_id  ?? null,
        company_id: raw.company_id ?? raw.companyId   ?? null,
    };
};

// ─── Attach a fresh Firebase ID token to every axios request ─────────────────
const setAxiosToken = async (firebaseUser) => {
    if (!firebaseUser) {
        delete axios.defaults.headers.common['Authorization'];
        return null;
    }
    const token = await firebaseUser.getIdToken();
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    return token;
};

// ─── Provider ─────────────────────────────────────────────────────────────────
export const AuthProvider = ({ children }) => {
    const [user,         setUser]         = useState(null);
    const [firebaseUser, setFirebaseUser] = useState(null);
    const [loading,      setLoading]      = useState(true);
    const [authError,    setAuthError]    = useState(null);

    // ── Fetch (or create) the backend user record for a signed-in Firebase user.
    // This is the single source of truth for syncing — always called after any
    // Firebase sign-in so both email/password and Google flows go through the
    // same code path.
    const syncBackendUser = useCallback(async (fbUser, registrationPayload = null) => {
        await setAxiosToken(fbUser);

        // If we already have registration data (new email/password signup or
        // first-time Google login), POST it to /auth/register directly.
        if (registrationPayload) {
            const res = await axios.post(`${API_URL}/auth/register`, {
                ...registrationPayload,
                firebaseUid: fbUser.uid,
                email:       fbUser.email,
            });
            return normaliseUser(res.data.user);
        }

        // Otherwise try to load the existing user.
        try {
            const res = await axios.get(`${API_URL}/auth/me`);
            return normaliseUser(res.data.user);
        } catch (err) {
            if (err.response?.status === 404) {
                // Returning Google user whose backend record was deleted/missing —
                // recreate it via firebase-sync (no extra registration data needed).
                const res = await axios.post(`${API_URL}/auth/firebase-sync`, {
                    email:       fbUser.email,
                    fullName:    fbUser.displayName || fbUser.email.split('@')[0],
                    firebaseUid: fbUser.uid,
                    avatar:      fbUser.photoURL || null,
                });
                return normaliseUser(res.data.user);
            }
            throw err;
        }
    }, []);

    // ── Firebase auth state listener ──────────────────────────────────────────
    // Runs on every page load / token refresh. We only do the backend sync here
    // for returning sessions (not for fresh sign-ins, which call syncBackendUser
    // themselves so they can pass registration data).
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
            setFirebaseUser(fbUser);

            if (fbUser) {
                // Only sync if we don't already have the user in state
                // (avoids double-syncing immediately after login/register).
                if (!user) {
                    try {
                        const backendUser = await syncBackendUser(fbUser);
                        setUser(backendUser);
                    } catch (err) {
                        console.error('AuthContext: failed to sync user with backend:', err);
                        setUser(null);
                    }
                }
            } else {
                delete axios.defaults.headers.common['Authorization'];
                setUser(null);
            }

            setLoading(false);
        });

        // Proactively refresh the Firebase token every 55 min so it never
        // expires mid-session (tokens expire after 60 min).
        const tokenInterval = setInterval(async () => {
            if (auth.currentUser) await setAxiosToken(auth.currentUser);
        }, 55 * 60 * 1000);

        return () => {
            unsubscribe();
            clearInterval(tokenInterval);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    // Note: intentionally omitting `user` and `syncBackendUser` from deps to
    // avoid re-registering the listener; the `!user` guard inside handles it.

    // ── Email / Password Login ────────────────────────────────────────────────
    const login = async (email, password) => {
        setAuthError(null);
        try {
            const credential  = await signInWithEmailAndPassword(auth, email, password);
            const backendUser = await syncBackendUser(credential.user);
            setUser(backendUser);
            return { success: true };
        } catch (err) {
            const message = firebaseErrorMessage(err.code) || err.message;
            setAuthError(message);
            return { success: false, error: message };
        }
    };

    // ── Email / Password Register ─────────────────────────────────────────────
    const register = async (
        email,
        password,
        fullName,
        accountType        = 'personal',
        companyName        = null,
        extraCompanyFields = null,
    ) => {
        setAuthError(null);
        try {
            // 1. Create Firebase account.
            const credential = await createUserWithEmailAndPassword(auth, email, password);
            const fbUser     = credential.user;

            // 2. Send email verification (non-blocking — don't await result).
            sendEmailVerification(fbUser).catch(() => {});

            // 3. Register in backend, passing all registration data.
            const backendUser = await syncBackendUser(fbUser, {
                fullName,
                accountType: accountType === 'company' ? 'company' : 'personal',
                companyName,
                ...(extraCompanyFields || {}),
            });

            setUser(backendUser);
            return { success: true, emailVerificationSent: true };
        } catch (err) {
            const message = firebaseErrorMessage(err.code) || err.message;
            setAuthError(message);
            return { success: false, error: message };
        }
    };

    // ── Google Sign-In ────────────────────────────────────────────────────────
    const loginWithGoogle = async (accountType = 'personal', companyName = null) => {
        setAuthError(null);
        try {
            const result    = await signInWithPopup(auth, googleProvider);
            const fbUser    = result.user;
            const isNewUser = result._tokenResponse?.isNewUser ?? false;

            let backendUser;
            if (isNewUser) {
                // First-time Google sign-in: create the backend record.
                backendUser = await syncBackendUser(fbUser, {
                    fullName:    fbUser.displayName || fbUser.email.split('@')[0],
                    avatar:      fbUser.photoURL    || null,
                    accountType: accountType === 'company' ? 'company' : 'personal',
                    companyName,
                    googleLogin: true,
                });
            } else {
                // Returning Google user: just fetch/sync.
                backendUser = await syncBackendUser(fbUser);
            }

            setUser(backendUser);
            return { success: true };
        } catch (err) {
            if (err.code === 'auth/popup-closed-by-user') {
                // User dismissed the popup — not an error worth showing.
                return { success: false, error: null };
            }
            const message = firebaseErrorMessage(err.code) || err.message;
            setAuthError(message);
            return { success: false, error: message };
        }
    };

    // ── Logout ────────────────────────────────────────────────────────────────
    const logout = async () => {
        await signOut(auth);
        delete axios.defaults.headers.common['Authorization'];
        setUser(null);
    };

    // ── Password Reset (Firebase sends the email) ─────────────────────────────
    const resetPassword = async (email) => {
        try {
            await sendPasswordResetEmail(auth, email);
            return { success: true };
        } catch (err) {
            const message = firebaseErrorMessage(err.code) || err.message;
            return { success: false, error: message };
        }
    };

    // ── Change Password (requires recent login) ───────────────────────────────
    const changePassword = async (currentPassword, newPassword) => {
        const fbUser = auth.currentUser;
        if (!fbUser) return { success: false, error: 'Not authenticated.' };
        try {
            const credential = EmailAuthProvider.credential(fbUser.email, currentPassword);
            await reauthenticateWithCredential(fbUser, credential);
            await updatePassword(fbUser, newPassword);
            return { success: true };
        } catch (err) {
            const message = firebaseErrorMessage(err.code) || err.message;
            return { success: false, error: message };
        }
    };

    // ── Resend Verification Email ─────────────────────────────────────────────
    const resendVerificationEmail = async () => {
        const fbUser = auth.currentUser;
        if (!fbUser) return { success: false, error: 'Not signed in.' };
        try {
            await sendEmailVerification(fbUser);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    };

    // ── Patch local user state (e.g. after profile save) ─────────────────────
    const updateUser = (userData) => {
        setUser(prev => normaliseUser({ ...prev, ...userData }));
    };

    // ── Convenience helpers ───────────────────────────────────────────────────
    const hasCompanyFeatures = () => user?.accountType === 'company';
    const isCompanyOwner     = () => user?.accountType === 'company' && user?.role === 'owner';
    const isEmailVerified    = () => auth.currentUser?.emailVerified ?? false;

    const value = {
        user,
        firebaseUser,
        loading,
        authError,
        isAuthenticated: !!user,
        // Auth methods
        login,
        register,
        loginWithGoogle,
        logout,
        resetPassword,
        changePassword,
        resendVerificationEmail,
        updateUser,
        // Helpers
        hasCompanyFeatures,
        isCompanyOwner,
        isEmailVerified,
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

// ─── Firebase error code → human-readable message ────────────────────────────
const firebaseErrorMessage = (code) => {
    const map = {
        'auth/user-not-found':         'No account found with this email.',
        'auth/wrong-password':         'Incorrect password.',
        'auth/email-already-in-use':   'An account with this email already exists.',
        'auth/weak-password':          'Password must be at least 6 characters.',
        'auth/invalid-email':          'Please enter a valid email address.',
        'auth/too-many-requests':      'Too many attempts. Please try again later.',
        'auth/network-request-failed': 'Network error. Check your connection.',
        'auth/invalid-credential':     'Incorrect email or password.',
        'auth/requires-recent-login':  'Please sign in again to do this.',
        'auth/popup-blocked':          'Pop-up was blocked. Please allow pop-ups for this site.',
        'auth/account-exists-with-different-credential':
            'An account already exists with this email using a different sign-in method.',
    };
    return map[code] || null;
};