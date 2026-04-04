// web/src/context/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
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
} from '../firebase.js';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};

const API_URL = 'https://syncline-1.onrender.com/api';

const normaliseUser = (raw) => {
    if (!raw) return null;
    const rawType     = raw.accountType || raw.account_type || 'personal';
    const accountType = rawType === 'company' ? 'company' : 'personal';
    return {
        ...raw,
        accountType,
        account_type: accountType,
        fullName:     raw.fullName     ?? raw.full_name     ?? null,
        full_name:    raw.full_name    ?? raw.fullName      ?? null,
        companyId:    raw.companyId    ?? raw.company_id    ?? null,
        company_id:   raw.company_id   ?? raw.companyId     ?? null,
        orgId:        raw.orgId        ?? raw.org_id        ?? null,
        org_id:       raw.org_id       ?? raw.orgId         ?? null,
    };
};

const setAxiosToken = async (firebaseUser) => {
    if (!firebaseUser) {
        delete axios.defaults.headers.common['Authorization'];
        console.log('🔓 Cleared Authorization header (no Firebase user)');
        return null;
    }
    try {
        const token = await firebaseUser.getIdToken(true);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        console.log('🔐 Set Authorization header with Firebase ID token (length:', token.length, ')');
        return token;
    } catch (err) {
        console.error('❌ Failed to get Firebase ID token:', err.message);
        throw err;
    }
};

export const AuthProvider = ({ children }) => {
    const [user,         setUser]         = useState(null);
    const [firebaseUser, setFirebaseUser] = useState(null);
    const [loading,      setLoading]      = useState(true);
    const [authError,    setAuthError]    = useState(null);

    // Mutex: prevents onAuthStateChanged from re-syncing during programmatic login/register
    const syncInProgress   = useRef(false);
    // Mutex: prevents onAuthStateChanged from re-creating a just-deleted account
    const deleteInProgress = useRef(false);

    // ── syncBackendUser ───────────────────────────────────────────────────────
    const syncBackendUser = useCallback(async (fbUser, registrationPayload = null) => {
        console.log('📡 syncBackendUser called with:', {
            fbUid: fbUser?.uid,
            hasRegistrationPayload: !!registrationPayload
        });

        await setAxiosToken(fbUser);

        if (registrationPayload) {
            console.log('📝 Registering new user...');
            const res = await axios.post(`${API_URL}/auth/register`, {
                ...registrationPayload,
                firebaseUid: fbUser.uid,
                email:       fbUser.email,
            });
            console.log('✅ Registration response:', { userId: res.data.user?.id });
            return normaliseUser(res.data.user);
        }

        // Always try /me first to get the full profile
        try {
            console.log('🔍 Fetching user from /api/auth/me...');
            const res = await axios.get(`${API_URL}/auth/me`);
            console.log('✅ /api/auth/me success:', { userId: res.data.user?.id, email: res.data.user?.email });
            return normaliseUser(res.data.user);
        } catch (err) {
            console.error('❌ /api/auth/me failed:', {
                status:  err.response?.status,
                error:   err.response?.data?.error,
                message: err.message,
            });

            if (err.response?.status === 404) {
                console.log('📝 User not found, creating via firebase-sync...');
                const res = await axios.post(`${API_URL}/auth/firebase-sync`, {
                    email:       fbUser.email,
                    fullName:    fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
                    firebaseUid: fbUser.uid,
                    avatar:      fbUser.photoURL || null,
                });
                console.log('✅ firebase-sync response:', { userId: res.data.user?.id });
                // Follow up with /me to get the full restored profile (name, avatar_url etc.)
                try {
                    const meRes = await axios.get(`${API_URL}/auth/me`);
                    return normaliseUser(meRes.data.user);
                } catch (_) {
                    return normaliseUser(res.data.user);
                }
            }

            throw err;
        }
    }, []);

    // ── Auth state listener ───────────────────────────────────────────────────
    useEffect(() => {
        console.log('🔌 Setting up Firebase auth listener...');
        const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
            console.log('🔄 Auth state changed:', { uid: fbUser?.uid, email: fbUser?.email });
            setFirebaseUser(fbUser);

            if (fbUser) {
                // Skip if a programmatic login/register or delete is already handling sync
                if (syncInProgress.current || deleteInProgress.current) {
                    console.log('⏭️  Skipping onAuthStateChanged sync — already handled by caller');
                    setLoading(false);
                    return;
                }

                try {
                    console.log('👤 Firebase user present, syncing full profile from backend...');
                    const backendUser = await syncBackendUser(fbUser);
                    console.log('✅ Backend sync successful:', { userId: backendUser?.id });
                    setUser(backendUser);
                } catch (err) {
                    console.error('❌ AuthContext: failed to sync user with backend:', err);
                    setUser(null);
                }
            } else {
                console.log('🚪 User logged out');
                delete axios.defaults.headers.common['Authorization'];
                setUser(null);
            }

            setLoading(false);
        });

        // Refresh Firebase token every 55 minutes
        const tokenInterval = setInterval(async () => {
            if (auth.currentUser) {
                await setAxiosToken(auth.currentUser);
            }
        }, 55 * 60 * 1000);

        return () => {
            console.log('🧹 Cleaning up auth listener');
            unsubscribe();
            clearInterval(tokenInterval);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Email / password login ────────────────────────────────────────────────
    const login = async (email, password) => {
        setAuthError(null);
        try {
            console.log('🔐 Logging in with email:', email);
            syncInProgress.current = true;
            const credential  = await signInWithEmailAndPassword(auth, email, password);
            const backendUser = await syncBackendUser(credential.user);
            console.log('✅ Login successful:', { userId: backendUser?.id });
            setUser(backendUser);
            return { success: true };
        } catch (err) {
            const message = firebaseErrorMessage(err.code) || err.message;
            console.error('❌ Login failed:', message);
            setAuthError(message);
            return { success: false, error: message };
        } finally {
            syncInProgress.current = false;
        }
    };

    // ── Email / password register ─────────────────────────────────────────────
    const register = async (email, password, fullName, accountType = 'personal', companyName = null, extraCompanyFields = null) => {
        setAuthError(null);
        try {
            console.log('📝 Registering new user:', { email, accountType });
            syncInProgress.current = true;
            const credential = await createUserWithEmailAndPassword(auth, email, password);
            const fbUser     = credential.user;
            sendEmailVerification(fbUser).catch(() => {});
            const backendUser = await syncBackendUser(fbUser, {
                fullName,
                accountType: accountType === 'company' ? 'company' : 'personal',
                companyName,
                ...(extraCompanyFields || {}),
            });
            console.log('✅ Registration successful:', { userId: backendUser?.id });
            setUser(backendUser);
            return { success: true, emailVerificationSent: true };
        } catch (err) {
            const message = firebaseErrorMessage(err.code) || err.message;
            console.error('❌ Registration failed:', message);
            setAuthError(message);
            return { success: false, error: message };
        } finally {
            syncInProgress.current = false;
        }
    };

    // ── Google LOGIN ──────────────────────────────────────────────────────────
    const loginWithGoogle = async () => {
        setAuthError(null);
        try {
            console.log('🔐 Google login attempt...');
            syncInProgress.current = true;

            const result = await signInWithPopup(auth, googleProvider);
            const fbUser = result.user;

            await setAxiosToken(fbUser);

            try {
                const res         = await axios.get(`${API_URL}/auth/me`);
                const backendUser = normaliseUser(res.data.user);
                console.log('✅ Google login successful:', { userId: backendUser?.id });
                setUser(backendUser);
                return { success: true };
            } catch (meErr) {
                if (meErr.response?.status === 404) {
                    console.warn('⚠️  Google login: no backend account, redirecting to register');
                    await signOut(auth);
                    delete axios.defaults.headers.common['Authorization'];
                    return {
                        success:           false,
                        needsRegistration: true,
                        googleUser: {
                            email:    fbUser.email,
                            fullName: fbUser.displayName || fbUser.email?.split('@')[0],
                            avatar:   fbUser.photoURL || null,
                        },
                    };
                }
                throw meErr;
            }
        } catch (err) {
            if (err.code === 'auth/popup-closed-by-user') return { success: false, error: null };
            const message = firebaseErrorMessage(err.code) || err.message;
            console.error('❌ Google login failed:', message);
            setAuthError(message);
            return { success: false, error: message };
        } finally {
            syncInProgress.current = false;
        }
    };

    // ── Google REGISTER ───────────────────────────────────────────────────────
    const registerWithGoogle = async (accountType = 'personal', companyName = null, extraCompanyFields = null) => {
        setAuthError(null);
        try {
            console.log('📝 Google register attempt:', { accountType });
            syncInProgress.current = true;

            const result = await signInWithPopup(auth, googleProvider);
            const fbUser = result.user;

            await setAxiosToken(fbUser);

            try {
                const res         = await axios.get(`${API_URL}/auth/me`);
                const backendUser = normaliseUser(res.data.user);
                console.log('✅ Google register: existing user, logging in:', { userId: backendUser?.id });
                setUser(backendUser);
                return { success: true };
            } catch (meErr) {
                if (meErr.response?.status !== 404) throw meErr;
            }

            const backendUser = await syncBackendUser(fbUser, {
                fullName:    fbUser.displayName || fbUser.email?.split('@')[0],
                avatar:      fbUser.photoURL    || null,
                accountType: accountType === 'company' ? 'company' : 'personal',
                companyName,
                googleLogin: true,
                ...(extraCompanyFields || {}),
            });

            console.log('✅ Google register successful:', { userId: backendUser?.id });
            setUser(backendUser);
            return { success: true };

        } catch (err) {
            if (err.code === 'auth/popup-closed-by-user') return { success: false, error: null };
            const message = firebaseErrorMessage(err.code) || err.message;
            console.error('❌ Google register failed:', message);
            setAuthError(message);
            return { success: false, error: message };
        } finally {
            syncInProgress.current = false;
        }
    };

    // ── Logout ────────────────────────────────────────────────────────────────
    const logout = async () => {
        try {
            console.log('🚪 Logging out...');
            await signOut(auth);
            console.log('✅ Logged out');
            return { success: true };
        } catch (err) {
            console.error('❌ Logout failed:', err.message);
            return { success: false, error: err.message };
        }
    };

    // ── Delete Account ────────────────────────────────────────────────────────
    // Full sequence:
    //   1. Re-authenticate (required by Firebase before account deletion)
    //      - Email/password users: re-auth with password
    //      - Google users: re-auth via Google popup
    //   2. Delete backend DB row (anonymize the user row)
    //   3. Delete Firebase Auth account (blocks future logins permanently)
    //   4. Sign out and clear all local state
    //
    // IMPORTANT: Step 3 (fbUser.delete()) is what prevents the user from
    // logging back in. Without it, a Google user can re-authenticate and
    // firebase-sync will re-create their DB row.
    const deleteAccount = async ({ device = 'Unknown device', currentPassword = null } = {}) => {
        const fbUser = auth.currentUser;
        if (!fbUser) return { success: false, error: 'Not authenticated.' };

        try {
            console.log('🗑️  Starting account deletion...');
            deleteInProgress.current = true;

            // ── Step 1: Re-authenticate ───────────────────────────────────────
            const isGoogleUser = fbUser.providerData?.some(p => p.providerId === 'google.com');

            if (isGoogleUser) {
                // Google users must re-authenticate via popup
                try {
                    console.log('🔐 Re-authenticating Google user before delete...');
                    const result     = await signInWithPopup(auth, googleProvider);
                    const credential = result.credential;
                    if (credential) {
                        await reauthenticateWithCredential(fbUser, credential);
                    }
                    console.log('✅ Google re-authentication successful');
                } catch (reAuthErr) {
                    if (reAuthErr.code === 'auth/popup-closed-by-user') {
                        deleteInProgress.current = false;
                        return {
                            success: false,
                            error:   'Please confirm the Google sign-in popup to delete your account.',
                        };
                    }
                    // Re-auth failed — log but continue, token may still be fresh enough
                    console.warn('⚠️  Google re-auth warning:', reAuthErr.message);
                }
            } else if (currentPassword && fbUser.email) {
                // Email/password user — re-auth with password
                try {
                    console.log('🔐 Re-authenticating email/password user before delete...');
                    const credential = EmailAuthProvider.credential(fbUser.email, currentPassword);
                    await reauthenticateWithCredential(fbUser, credential);
                    console.log('✅ Re-authentication successful');
                } catch (reAuthErr) {
                    deleteInProgress.current = false;
                    const message = firebaseErrorMessage(reAuthErr.code) || reAuthErr.message;
                    console.error('❌ Re-authentication failed:', message);
                    return { success: false, error: `Re-authentication failed: ${message}` };
                }
            }

            // ── Step 2: Delete from backend DB ────────────────────────────────
            try {
                console.log('🗑️  Deleting backend account...');
                await axios.delete(`${API_URL}/users/me`, { data: { device } });
                console.log('✅ Backend account deleted (user row anonymized)');
            } catch (backendErr) {
                if (backendErr.response?.status !== 404) {
                    deleteInProgress.current = false;
                    console.error('❌ Backend delete failed:', backendErr.message);
                    return {
                        success: false,
                        error:   backendErr.response?.data?.error || 'Failed to delete account data. Please try again.',
                    };
                }
                console.warn('⚠️  Backend returned 404 — user may already be deleted, continuing...');
            }

            // ── Step 3: Delete the Firebase Auth account ──────────────────────
            // This is critical — it permanently blocks the user from logging in again.
            // Without this step, Google users can sign in again and get a new DB row.
            try {
                console.log('🗑️  Deleting Firebase Auth account...');
                await fbUser.delete();
                console.log('✅ Firebase Auth account deleted — login permanently blocked');
            } catch (firebaseErr) {
                if (firebaseErr.code === 'auth/requires-recent-login') {
                    deleteInProgress.current = false;
                    return {
                        success:        false,
                        error:          'Your session has expired. Please sign out, sign back in immediately, then delete your account.',
                        requiresReauth: true,
                    };
                }
                // Other Firebase errors — backend is already anonymized so the user
                // can't really log back in meaningfully (their DB row is gone),
                // but log the error for debugging.
                console.error('❌ Firebase Auth delete error (backend already cleaned up):', firebaseErr.message);
            }

            // ── Step 4: Sign out and clear everything ─────────────────────────
            console.log('🚪 Signing out after account deletion...');
            await signOut(auth).catch(() => {});
            delete axios.defaults.headers.common['Authorization'];
            setUser(null);
            setFirebaseUser(null);

            try { localStorage.clear(); } catch (_) {}
            try { sessionStorage.clear(); } catch (_) {}

            console.log('✅ Account fully deleted and signed out');
            return { success: true };

        } catch (err) {
            console.error('❌ Delete account failed unexpectedly:', err);
            return { success: false, error: err.message || 'Failed to delete account.' };
        } finally {
            // Release the mutex after a delay so the final onAuthStateChanged(null)
            // fired by signOut has time to process before re-enabling normal sync.
            setTimeout(() => { deleteInProgress.current = false; }, 3000);
        }
    };

    // ── Other helpers ─────────────────────────────────────────────────────────
    const resetPassword = async (email) => {
        try {
            console.log('📧 Sending password reset email to:', email);
            await sendPasswordResetEmail(auth, email);
            console.log('✅ Password reset email sent');
            return { success: true };
        } catch (err) {
            const message = firebaseErrorMessage(err.code) || err.message;
            console.error('❌ Reset password failed:', message);
            return { success: false, error: message };
        }
    };

    const changePassword = async (currentPassword, newPassword) => {
        const fbUser = auth.currentUser;
        if (!fbUser) return { success: false, error: 'Not authenticated.' };
        try {
            console.log('🔐 Changing password...');
            const credential = EmailAuthProvider.credential(fbUser.email, currentPassword);
            await reauthenticateWithCredential(fbUser, credential);
            await updatePassword(fbUser, newPassword);
            console.log('✅ Password changed');
            return { success: true };
        } catch (err) {
            const message = firebaseErrorMessage(err.code) || err.message;
            console.error('❌ Change password failed:', message);
            return { success: false, error: message };
        }
    };

    const resendVerificationEmail = async () => {
        const fbUser = auth.currentUser;
        if (!fbUser) return { success: false, error: 'Not signed in.' };
        try {
            console.log('📧 Resending verification email...');
            await sendEmailVerification(fbUser);
            console.log('✅ Verification email sent');
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    };

    const updateUser = (userData) => setUser(prev => normaliseUser({ ...prev, ...userData }));

    const hasCompanyFeatures = () => user?.accountType === 'company';
    const isCompanyOwner     = () => user?.accountType === 'company' && user?.role === 'owner';
    const isEmailVerified    = () => auth.currentUser?.emailVerified ?? false;

    return (
        <AuthContext.Provider value={{
            user, firebaseUser, loading, authError,
            isAuthenticated: !!user,
            login, register, loginWithGoogle, registerWithGoogle,
            logout, deleteAccount,
            resetPassword, changePassword, resendVerificationEmail,
            updateUser, hasCompanyFeatures, isCompanyOwner, isEmailVerified,
        }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

const firebaseErrorMessage = (code) => {
    const map = {
        'auth/user-not-found':         'No account found with this email.',
        'auth/wrong-password':         'Incorrect password.',
        'auth/weak-password':          'Password must be at least 6 characters.',
        'auth/email-already-in-use':   'Email is already registered.',
        'auth/invalid-email':          'Invalid email address.',
        'auth/popup-closed-by-user':   'Sign-in popup was closed.',
        'auth/requires-recent-login':  'Please sign out and sign back in, then try again.',
        'auth/account-exists-with-different-credential': 'An account already exists with this email.',
        'auth/invalid-credential':     'Invalid credentials. Please check your email and password.',
    };
    return map[code] || null;
};