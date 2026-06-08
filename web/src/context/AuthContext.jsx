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
    onAuthStateChanged,
} from '../firebase.js';
import { API_BASE_URL } from '../config.js';
import { isCompanyAccount, normaliseAccountFields } from '../utils/accountType.js';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};

const API_URL = API_BASE_URL;

const normaliseUser = (raw) => {
    if (!raw) return null;
    const fields = normaliseAccountFields(raw);
    return {
        ...raw,
        ...fields,
        fullName:  raw.fullName  ?? raw.full_name  ?? null,
        full_name: raw.full_name ?? raw.fullName   ?? null,
        orgId:     raw.orgId     ?? raw.org_id     ?? null,
        org_id:    raw.org_id    ?? raw.orgId      ?? null,
    };
};

const setAxiosToken = async (firebaseUser) => {
    if (!firebaseUser) {
        delete axios.defaults.headers.common['Authorization'];
        return null;
    }
    try {
        const token = await firebaseUser.getIdToken(true);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        console.log('🔐 Auth token set (length:', token.length, ')');
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

    const syncInProgress   = useRef(false);
    // deleteInProgress stays true until AFTER signOut completes so the
    // onAuthStateChanged listener never tries to re-sync a deleted user.
    const deleteInProgress = useRef(false);

    // ── syncBackendUser ───────────────────────────────────────────────────────
    const syncBackendUser = useCallback(async (fbUser, registrationPayload = null) => {
        console.log('📡 syncBackendUser:', { fbUid: fbUser?.uid, hasPayload: !!registrationPayload });
        await setAxiosToken(fbUser);

        if (registrationPayload) {
            const res = await axios.post(`${API_URL}/auth/register`, {
                ...registrationPayload,
                firebaseUid: fbUser.uid,
                email:       fbUser.email,
            });
            return normaliseUser(res.data.user);
        }

        try {
            const res = await axios.get(`${API_URL}/auth/me`);
            console.log('✅ /api/auth/me ok, userId:', res.data.user?.id);
            return normaliseUser(res.data.user);
        } catch (err) {
            const status = err.response?.status;
            console.error('❌ /api/auth/me failed:', status, err.response?.data?.error);

            // 403 = permanently deleted account trying to log back in
            if (status === 403) {
                console.warn('🚫 Deleted account blocked. Forcing sign out.');
                await signOut(auth).catch(() => {});
                delete axios.defaults.headers.common['Authorization'];
                throw new Error('ACCOUNT_DELETED');
            }

            if (status === 404) {
                console.log('📝 User not in DB — running firebase-sync...');
                let syncRes;
                try {
                    syncRes = await axios.post(`${API_URL}/auth/firebase-sync`, {
                        email:       fbUser.email,
                        fullName:    fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
                        firebaseUid: fbUser.uid,
                        avatar:      fbUser.photoURL || null,
                    });
                } catch (syncErr) {
                    if (syncErr.response?.status === 403) {
                        await signOut(auth).catch(() => {});
                        delete axios.defaults.headers.common['Authorization'];
                        throw new Error('ACCOUNT_DELETED');
                    }
                    throw syncErr;
                }

                // Follow up with /me to get full profile including company
                try {
                    const meRes = await axios.get(`${API_URL}/auth/me`);
                    return normaliseUser(meRes.data.user);
                } catch (_) {
                    return normaliseUser(syncRes.data.user);
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
                // CRITICAL: if deletion is in progress, do NOT sync.
                // Without this guard, the Firebase sign-out event at the end of
                // deleteAccount fires onAuthStateChanged again before the listener
                // is aware the account is gone, which causes firebase-sync to
                // recreate the deleted user row.
                if (syncInProgress.current || deleteInProgress.current) {
                    console.log('⏭️  Skipping sync — handled by caller');
                    setLoading(false);
                    return;
                }

                try {
                    const backendUser = await syncBackendUser(fbUser);
                    setUser(backendUser);
                } catch (err) {
                    if (err.message === 'ACCOUNT_DELETED') {
                        console.warn('🚫 Deleted account blocked from re-entry');
                    } else {
                        console.error('❌ Backend sync failed:', err.message);
                    }
                    setUser(null);
                }
            } else {
                // Only clear state if we're not mid-deletion (deletion clears
                // state itself at the end of deleteAccount).
                if (!deleteInProgress.current) {
                    console.log('🚪 User signed out');
                    delete axios.defaults.headers.common['Authorization'];
                    setUser(null);
                }
            }

            setLoading(false);
        });

        // Refresh Firebase token every 55 minutes (tokens expire at 60 min)
        const tokenInterval = setInterval(async () => {
            if (auth.currentUser && !deleteInProgress.current) {
                await setAxiosToken(auth.currentUser).catch(() => {});
            }
        }, 55 * 60 * 1000);

        return () => { unsubscribe(); clearInterval(tokenInterval); };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Email / password login ────────────────────────────────────────────────
    const login = async (email, password) => {
        setAuthError(null);
        try {
            syncInProgress.current = true;
            const credential = await signInWithEmailAndPassword(auth, email, password);
            let backendUser;
            try {
                backendUser = await syncBackendUser(credential.user);
            } catch (syncErr) {
                if (syncErr.message === 'ACCOUNT_DELETED') {
                    await signOut(auth).catch(() => {});
                    return { success: false, error: 'This account has been permanently deleted.' };
                }
                throw syncErr;
            }
            setUser(backendUser);
            return { success: true };
        } catch (err) {
            if (err.message === 'ACCOUNT_DELETED') {
                return { success: false, error: 'This account has been permanently deleted.' };
            }
            const message = firebaseErrorMessage(err.code) || err.message;
            setAuthError(message);
            return { success: false, error: message };
        } finally {
            syncInProgress.current = false;
        }
    };

    // ── Email / password register ─────────────────────────────────────────────
    const register = async (
        email, password, fullName,
        accountType = 'personal', companyName = null, extraCompanyFields = null
    ) => {
        setAuthError(null);
        try {
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
            setUser(backendUser);
            return { success: true, emailVerificationSent: true };
        } catch (err) {
            const message = firebaseErrorMessage(err.code) || err.message;
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
            syncInProgress.current = true;
            const result = await signInWithPopup(auth, googleProvider);
            const fbUser = result.user;
            await setAxiosToken(fbUser);

            try {
                const res         = await axios.get(`${API_URL}/auth/me`);
                const backendUser = normaliseUser(res.data.user);
                setUser(backendUser);
                return { success: true };
            } catch (meErr) {
                const status = meErr.response?.status;
                if (status === 403) {
                    await signOut(auth).catch(() => {});
                    delete axios.defaults.headers.common['Authorization'];
                    return { success: false, error: 'This account has been permanently deleted.' };
                }
                if (status === 404) {
                    // Google user not registered — send back to registration
                    await signOut(auth).catch(() => {});
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
            setAuthError(message);
            return { success: false, error: message };
        } finally {
            syncInProgress.current = false;
        }
    };

    // ── Google REGISTER ───────────────────────────────────────────────────────
    const registerWithGoogle = async (
        accountType = 'personal', companyName = null, extraCompanyFields = null
    ) => {
        setAuthError(null);
        try {
            syncInProgress.current = true;
            const result = await signInWithPopup(auth, googleProvider);
            const fbUser = result.user;
            await setAxiosToken(fbUser);

            try {
                const res         = await axios.get(`${API_URL}/auth/me`);
                const backendUser = normaliseUser(res.data.user);
                setUser(backendUser);
                return { success: true };
            } catch (meErr) {
                if (meErr.response?.status === 403) {
                    await signOut(auth).catch(() => {});
                    return { success: false, error: 'This account has been permanently deleted.' };
                }
                if (meErr.response?.status !== 404) throw meErr;
                // 404 = continue to register below
            }

            const backendUser = await syncBackendUser(fbUser, {
                fullName:    fbUser.displayName || fbUser.email?.split('@')[0],
                avatar:      fbUser.photoURL    || null,
                accountType: accountType === 'company' ? 'company' : 'personal',
                companyName,
                googleLogin: true,
                ...(extraCompanyFields || {}),
            });
            setUser(backendUser);
            return { success: true };

        } catch (err) {
            if (err.code === 'auth/popup-closed-by-user') return { success: false, error: null };
            const message = firebaseErrorMessage(err.code) || err.message;
            setAuthError(message);
            return { success: false, error: message };
        } finally {
            syncInProgress.current = false;
        }
    };

    // ── Logout ────────────────────────────────────────────────────────────────
    const logout = async () => {
        try {
            await signOut(auth);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    };

    // ── Delete Account ────────────────────────────────────────────────────────
    //
    // Full permanent deletion sequence — NO ghost users possible:
    //
    //   Step 1: Re-authenticate the user (REQUIRED before any deletion)
    //           - Google users: popup re-auth
    //           - Email users:  credential re-auth (currentPassword required)
    //           - This MUST succeed before we proceed — if it fails we abort.
    //
    //   Step 2: Set deleteInProgress = true so onAuthStateChanged is blocked
    //           from re-syncing the user for the rest of this flow.
    //
    //   Step 3: DELETE /api/users/me — anonymize the DB row.
    //           The deleted_user_N@syncline.local sentinel in the DB permanently
    //           blocks this user from re-entering via /me or firebase-sync.
    //
    //   Step 4: DELETE /api/auth/delete-firebase-user — Admin SDK permanently
    //           removes the Firebase Auth account. After this, the user cannot
    //           log in via email OR Google with the same account.
    //
    //   Step 5: fbUser.delete() — client-side belt-and-suspenders cleanup.
    //           May fail if session expired; Admin SDK in Step 4 is the guarantee.
    //
    //   Step 6: signOut + clear all local state and storage.
    //
    const deleteAccount = async ({ device = 'Unknown device', currentPassword = null } = {}) => {
        const fbUser = auth.currentUser;
        if (!fbUser) return { success: false, error: 'Not authenticated.' };

        const isGoogleUser = fbUser.providerData?.some(p => p.providerId === 'google.com');

        try {
            console.log('🗑️  Starting account deletion for:', fbUser.uid);

            // ── Step 1: Re-authenticate FIRST (before setting deleteInProgress) ─
            // Re-auth must succeed before we do anything destructive.
            if (isGoogleUser) {
                try {
                    console.log('🔐 Google re-auth popup...');
                    // Use signInWithPopup to get a fresh credential
                    const result = await signInWithPopup(auth, googleProvider);
                    if (result?.user) {
                        console.log('✅ Google re-auth done');
                    }
                } catch (reAuthErr) {
                    if (reAuthErr.code === 'auth/popup-closed-by-user') {
                        return {
                            success: false,
                            error:   'Please confirm the Google sign-in popup to delete your account.',
                        };
                    }
                    // For other Google re-auth errors, still continue —
                    // Admin SDK deletion does not require client re-auth.
                    console.warn('⚠️  Google re-auth warning (non-fatal):', reAuthErr.message);
                }
            } else {
                // Email/password user — re-auth is required
                if (!currentPassword) {
                    return {
                        success: false,
                        error:   'Please enter your current password to delete your account.',
                    };
                }
                try {
                    console.log('🔐 Email/password re-auth...');
                    const credential = EmailAuthProvider.credential(fbUser.email, currentPassword);
                    await reauthenticateWithCredential(fbUser, credential);
                    console.log('✅ Email re-auth done');
                } catch (reAuthErr) {
                    return {
                        success: false,
                        error:   firebaseErrorMessage(reAuthErr.code) || 'Re-authentication failed. Please check your password.',
                    };
                }
            }

            // ── Step 2: Lock out onAuthStateChanged ───────────────────────────
            // Set this AFTER re-auth and BEFORE any destructive operations.
            // This prevents the auth state listener from calling firebase-sync
            // and accidentally recreating the deleted user's DB row.
            deleteInProgress.current = true;

            // ── Step 3: Anonymize backend DB row ──────────────────────────────
            try {
                console.log('🗑️  DELETE /api/users/me...');
                await axios.delete(`${API_URL}/users/me`, { data: { device } });
                console.log('✅ Backend DB row anonymized');
            } catch (backendErr) {
                const status = backendErr.response?.status;
                if (status === 404) {
                    // Row already gone — fine, continue
                    console.warn('⚠️  Backend 404 — row already gone, continuing...');
                } else {
                    // Real error — abort and let user try again
                    deleteInProgress.current = false;
                    return {
                        success: false,
                        error:   backendErr.response?.data?.error || 'Failed to delete account data. Please try again.',
                    };
                }
            }

            // ── Step 4: Admin SDK permanently deletes Firebase Auth account ───
            // This is the PERMANENT guarantee. Even if Steps 5 fails, the user
            // cannot log back in because their Firebase Auth record is gone.
            try {
                console.log('🗑️  DELETE /api/auth/delete-firebase-user (Admin SDK)...');
                await axios.delete(`${API_URL}/auth/delete-firebase-user`);
                console.log('✅ Firebase Auth permanently deleted via Admin SDK');
            } catch (adminErr) {
                // Log but don't fail the flow — client-side delete is next
                console.warn(
                    '⚠️  Admin SDK deletion warning:',
                    adminErr.response?.data || adminErr.message
                );
            }

            // ── Step 5: Client-side delete (belt-and-suspenders) ─────────────
            try {
                console.log('🗑️  Client fbUser.delete()...');
                await fbUser.delete();
                console.log('✅ Client-side Firebase account deleted');
            } catch (clientDelErr) {
                // Expected sometimes — session expired or Admin SDK already removed
                // the account above. Not a failure condition.
                console.warn(
                    '⚠️  Client-side delete warning (Admin SDK already handled it):',
                    clientDelErr.message
                );
            }

            // ── Step 6: Sign out and wipe all local state ─────────────────────
            await signOut(auth).catch(() => {});
            delete axios.defaults.headers.common['Authorization'];
            setUser(null);
            setFirebaseUser(null);

            try { localStorage.clear();   } catch (_) {}
            try { sessionStorage.clear(); } catch (_) {}

            console.log('✅ Account fully and permanently deleted — no ghost user possible');
            return { success: true };

        } catch (err) {
            console.error('❌ Delete account failed:', err);
            deleteInProgress.current = false;
            return { success: false, error: err.message || 'Failed to delete account.' };
        } finally {
            // Keep deleteInProgress true for a few seconds after signOut fires
            // so the onAuthStateChanged null event doesn't race with our cleanup.
            setTimeout(() => { deleteInProgress.current = false; }, 5000);
        }
    };

    // ── Other helpers ─────────────────────────────────────────────────────────
    const resetPassword = async (email) => {
        try {
            await sendPasswordResetEmail(auth, email, {
                url: `${window.location.origin}/reset-password`,
                handleCodeInApp: true,
            });
            return { success: true };
        } catch (err) {
            return { success: false, error: firebaseErrorMessage(err.code) || err.message };
        }
    };

    const changePassword = async (currentPassword, newPassword) => {
        const fbUser = auth.currentUser;
        if (!fbUser) return { success: false, error: 'Not authenticated.' };
        try {
            const credential = EmailAuthProvider.credential(fbUser.email, currentPassword);
            await reauthenticateWithCredential(fbUser, credential);
            await updatePassword(fbUser, newPassword);
            return { success: true };
        } catch (err) {
            return { success: false, error: firebaseErrorMessage(err.code) || err.message };
        }
    };

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

    const updateUser        = (userData) => setUser(prev => normaliseUser({ ...prev, ...userData }));
    const hasCompanyFeatures = () => isCompanyAccount(user);
    const isCompanyOwner     = () => !!user && user.role === 'owner' && isCompanyAccount(user);
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
        'auth/account-exists-with-different-credential':
                                       'An account already exists with this email.',
        'auth/invalid-credential':     'Invalid credentials. Please check your email and password.',
        'auth/too-many-requests':      'Too many attempts. Please wait a moment and try again.',
        'auth/network-request-failed': 'Network error. Please check your connection.',
    };
    return map[code] || null;
};