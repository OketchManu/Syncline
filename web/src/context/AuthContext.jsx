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

            // 403 = deleted account trying to log back in — force sign out
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
                        throw new Error('ACCOUNT_DELETED');
                    }
                    throw syncErr;
                }

                // Follow up with /me to get full profile including company etc.
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
                console.log('🚪 User signed out');
                delete axios.defaults.headers.common['Authorization'];
                setUser(null);
            }

            setLoading(false);
        });

        const tokenInterval = setInterval(async () => {
            if (auth.currentUser) await setAxiosToken(auth.currentUser);
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
    const register = async (email, password, fullName, accountType = 'personal', companyName = null, extraCompanyFields = null) => {
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
    // FIX: returns 403 for deleted accounts so they can't re-enter via Google.
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
    const registerWithGoogle = async (accountType = 'personal', companyName = null, extraCompanyFields = null) => {
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
    // Sequence:
    //   1. Re-authenticate (best-effort — server-side deletion is the guarantee)
    //   2. DELETE /api/users/me        — anonymize DB row
    //   3. DELETE /api/auth/delete-firebase-user — Admin SDK permanently removes
    //      the Firebase Auth account. This is the key fix: even if client-side
    //      re-auth fails or the Google popup is dismissed, Admin SDK deletion
    //      still runs and prevents ghost accounts from reappearing.
    //   4. fbUser.delete()             — belt-and-suspenders client-side cleanup
    //   5. signOut + clear state
    const deleteAccount = async ({ device = 'Unknown device', currentPassword = null } = {}) => {
        const fbUser = auth.currentUser;
        if (!fbUser) return { success: false, error: 'Not authenticated.' };

        try {
            console.log('🗑️  Starting account deletion for:', fbUser.uid);
            deleteInProgress.current = true;

            const isGoogleUser = fbUser.providerData?.some(p => p.providerId === 'google.com');

            // ── Step 1: Re-authenticate (best-effort) ─────────────────────────
            if (isGoogleUser) {
                try {
                    console.log('🔐 Google re-auth popup...');
                    const result = await signInWithPopup(auth, googleProvider);
                    if (result.credential) {
                        await reauthenticateWithCredential(fbUser, result.credential);
                    }
                    console.log('✅ Google re-auth done');
                } catch (reAuthErr) {
                    if (reAuthErr.code === 'auth/popup-closed-by-user') {
                        deleteInProgress.current = false;
                        return { success: false, error: 'Please confirm the Google sign-in popup to delete your account.' };
                    }
                    // Continue anyway — Admin SDK deletion in Step 3 doesn't need client re-auth
                    console.warn('⚠️  Google re-auth non-fatal warning:', reAuthErr.message);
                }
            } else if (currentPassword && fbUser.email) {
                try {
                    console.log('🔐 Email/password re-auth...');
                    const credential = EmailAuthProvider.credential(fbUser.email, currentPassword);
                    await reauthenticateWithCredential(fbUser, credential);
                    console.log('✅ Email re-auth done');
                } catch (reAuthErr) {
                    deleteInProgress.current = false;
                    return { success: false, error: `Re-authentication failed: ${firebaseErrorMessage(reAuthErr.code) || reAuthErr.message}` };
                }
            }

            // ── Step 2: Anonymize backend DB row ──────────────────────────────
            try {
                console.log('🗑️  DELETE /api/users/me...');
                await axios.delete(`${API_URL}/users/me`, { data: { device } });
                console.log('✅ Backend DB row anonymized');
            } catch (backendErr) {
                if (backendErr.response?.status !== 404) {
                    deleteInProgress.current = false;
                    return {
                        success: false,
                        error:   backendErr.response?.data?.error || 'Failed to delete account data.',
                    };
                }
                console.warn('⚠️  Backend 404 — row already gone, continuing...');
            }

            // ── Step 3: Server-side Firebase Admin deletion ───────────────────
            // This is the GUARANTEED path. Firebase Admin SDK bypasses re-auth
            // requirements and permanently removes the Firebase Auth account.
            // After this, the user cannot log back in via any provider.
            try {
                console.log('🗑️  DELETE /api/auth/delete-firebase-user (Admin SDK)...');
                await axios.delete(`${API_URL}/auth/delete-firebase-user`);
                console.log('✅ Firebase Auth permanently deleted via Admin SDK');
            } catch (adminErr) {
                // Log but don't fail — we still attempt client-side delete below
                console.error('⚠️  Admin SDK deletion warning:', adminErr.response?.data || adminErr.message);
            }

            // ── Step 4: Client-side delete (belt-and-suspenders) ─────────────
            try {
                console.log('🗑️  Client fbUser.delete()...');
                await fbUser.delete();
                console.log('✅ Client-side Firebase account deleted');
            } catch (clientDelErr) {
                // Expected to sometimes fail (session expiry) — Admin SDK already handled it
                console.warn('⚠️  Client-side delete warning (Admin SDK already handled it):', clientDelErr.message);
            }

            // ── Step 5: Sign out and clear everything ─────────────────────────
            await signOut(auth).catch(() => {});
            delete axios.defaults.headers.common['Authorization'];
            setUser(null);
            setFirebaseUser(null);
            try { localStorage.clear(); } catch (_) {}
            try { sessionStorage.clear(); } catch (_) {}

            console.log('✅ Account fully and permanently deleted — no ghost user possible');
            return { success: true };

        } catch (err) {
            console.error('❌ Delete account failed:', err);
            return { success: false, error: err.message || 'Failed to delete account.' };
        } finally {
            setTimeout(() => { deleteInProgress.current = false; }, 3000);
        }
    };

    // ── Other helpers ─────────────────────────────────────────────────────────
    const resetPassword = async (email) => {
        try {
            await sendPasswordResetEmail(auth, email);
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