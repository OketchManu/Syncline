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
        console.log('🔐 Set Authorization header (length:', token.length, ')');
        return token;
    } catch (err) {
        console.error('❌ Failed to get Firebase ID token:', err.message);
        throw err;
    }
};

// Translate backend/Firebase error codes into friendly messages
function friendlyError(err) {
    // Firebase auth codes
    const firebaseMap = {
        'auth/user-not-found':         'No account found with this email address.',
        'auth/wrong-password':         'Incorrect password. Please try again.',
        'auth/invalid-credential':     'Incorrect email or password. Please try again.',
        'auth/weak-password':          'Password must be at least 6 characters.',
        'auth/email-already-in-use':   'An account with this email already exists.',
        'auth/invalid-email':          'Please enter a valid email address.',
        'auth/popup-closed-by-user':   null, // silent — user closed popup
        'auth/requires-recent-login':  'For security, please sign out and sign back in, then try again.',
        'auth/too-many-requests':      'Too many failed attempts. Please wait a moment and try again.',
        'auth/network-request-failed': 'Network error. Please check your internet connection.',
        'auth/account-exists-with-different-credential': 'An account already exists with this email using a different sign-in method.',
    };
    if (err.code && firebaseMap[err.code] !== undefined) return firebaseMap[err.code];

    // Backend error field
    const backendMsg = err.response?.data?.error;
    if (backendMsg) return backendMsg;

    // Generic fallback
    return err.message || 'Something went wrong. Please try again.';
}

export const AuthProvider = ({ children }) => {
    const [user,         setUser]         = useState(null);
    const [firebaseUser, setFirebaseUser] = useState(null);
    const [loading,      setLoading]      = useState(true);
    const [authError,    setAuthError]    = useState(null);

    // Mutex: prevents onAuthStateChanged double-sync when login() already called syncBackendUser
    const syncInProgress = useRef(false);
    // Mutex: prevents re-sync after account deletion signs the user out
    const deleteInProgress = useRef(false);

    // ── syncBackendUser ───────────────────────────────────────────────────────
    // FIX for Issue 1 (second user breaks all accounts):
    // The root cause was that after a DB wipe, firebase-sync would be called
    // for EVERY user on auth state change — but firebase-sync creates a new row
    // for anyone whose firebase_uid isn't in the DB. This meant user B would
    // get re-created fine, but user A's row might have a stale firebase_uid
    // mapping. Now syncBackendUser ONLY calls firebase-sync when /me returns 404,
    // and only for the specific user making the request — not globally.
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
            console.log('✅ /api/auth/me success:', { userId: res.data.user?.id });
            return normaliseUser(res.data.user);
        } catch (err) {
            const status = err.response?.status;
            const code   = err.response?.data?.code;

            console.error('❌ /api/auth/me failed:', { status, code });

            if (status === 404) {
                // User's firebase_uid not in DB (first login after DB wipe, or new user)
                // Call firebase-sync to restore their row from profile_data
                console.log('📝 Calling firebase-sync to restore/create user...');
                const syncRes = await axios.post(`${API_URL}/auth/firebase-sync`, {
                    email:       fbUser.email,
                    fullName:    fbUser.displayName || fbUser.email?.split('@')[0],
                    firebaseUid: fbUser.uid,
                    avatar:      fbUser.photoURL || null,
                });
                // Always follow up with /me to get the full profile
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
                // Skip if login()/register() already handled sync, or delete is in progress
                if (syncInProgress.current || deleteInProgress.current) {
                    console.log('⏭️  Skipping onAuthStateChanged sync — already handled');
                    setLoading(false);
                    return;
                }

                try {
                    console.log('👤 Syncing profile from backend...');
                    const backendUser = await syncBackendUser(fbUser);
                    console.log('✅ Backend sync successful:', { userId: backendUser?.id });
                    setUser(backendUser);
                } catch (err) {
                    console.error('❌ Backend sync failed:', err.message);
                    setUser(null);
                }
            } else {
                console.log('🚪 User signed out');
                delete axios.defaults.headers.common['Authorization'];
                setUser(null);
            }

            setLoading(false);
        });

        // Refresh token every 55 minutes (Firebase tokens expire after 1 hour)
        const tokenInterval = setInterval(async () => {
            if (auth.currentUser) {
                await setAxiosToken(auth.currentUser);
            }
        }, 55 * 60 * 1000);

        return () => { unsubscribe(); clearInterval(tokenInterval); };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── login (email/password) ────────────────────────────────────────────────
    const login = async (email, password) => {
        setAuthError(null);
        try {
            syncInProgress.current = true;
            const credential  = await signInWithEmailAndPassword(auth, email, password);
            const backendUser = await syncBackendUser(credential.user);
            setUser(backendUser);
            return { success: true };
        } catch (err) {
            const message = friendlyError(err);
            console.error('❌ Login failed:', err.code || err.message);
            setAuthError(message);
            return { success: false, error: message };
        } finally {
            syncInProgress.current = false;
        }
    };

    // ── register (email/password) ─────────────────────────────────────────────
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
            const message = friendlyError(err);
            console.error('❌ Registration failed:', err.code || err.message);
            setAuthError(message);
            return { success: false, error: message };
        } finally {
            syncInProgress.current = false;
        }
    };

    // ── loginWithGoogle ───────────────────────────────────────────────────────
    // Only allows users who already have a backend account.
    // Unregistered Google users are redirected to /register.
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
                if (meErr.response?.status === 404) {
                    // Not registered — sign out and redirect to register
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
            const message = friendlyError(err);
            console.error('❌ Google login failed:', err.code || err.message);
            setAuthError(message);
            return { success: false, error: message };
        } finally {
            syncInProgress.current = false;
        }
    };

    // ── registerWithGoogle ────────────────────────────────────────────────────
    // Used on the Register page — always creates a backend row.
    const registerWithGoogle = async (accountType = 'personal', companyName = null, extraCompanyFields = null) => {
        setAuthError(null);
        try {
            syncInProgress.current = true;
            const result = await signInWithPopup(auth, googleProvider);
            const fbUser = result.user;

            await setAxiosToken(fbUser);

            // If already registered, just log in
            try {
                const res         = await axios.get(`${API_URL}/auth/me`);
                const backendUser = normaliseUser(res.data.user);
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
            setUser(backendUser);
            return { success: true };
        } catch (err) {
            if (err.code === 'auth/popup-closed-by-user') return { success: false, error: null };
            const message = friendlyError(err);
            console.error('❌ Google register failed:', err.code || err.message);
            setAuthError(message);
            return { success: false, error: message };
        } finally {
            syncInProgress.current = false;
        }
    };

    // ── logout ────────────────────────────────────────────────────────────────
    const logout = async () => {
        try {
            await signOut(auth);
            return { success: true };
        } catch (err) {
            return { success: false, error: friendlyError(err) };
        }
    };

    // ── deleteAccount ─────────────────────────────────────────────────────────
    const deleteAccount = async ({ device = 'Unknown device', currentPassword = null } = {}) => {
        const fbUser = auth.currentUser;
        if (!fbUser) return { success: false, error: 'You are not signed in.' };

        try {
            deleteInProgress.current = true;

            // Re-authenticate if password provided (email/password users)
            if (currentPassword && fbUser.email) {
                try {
                    const credential = EmailAuthProvider.credential(fbUser.email, currentPassword);
                    await reauthenticateWithCredential(fbUser, credential);
                } catch (reAuthErr) {
                    deleteInProgress.current = false;
                    return { success: false, error: friendlyError(reAuthErr) };
                }
            }

            // 1. Delete backend row
            try {
                await axios.delete(`${API_URL}/users/me`, { data: { device } });
            } catch (backendErr) {
                if (backendErr.response?.status !== 404) {
                    deleteInProgress.current = false;
                    return { success: false, error: backendErr.response?.data?.error || 'Failed to delete account data. Please try again.' };
                }
            }

            // 2. Delete Firebase Auth account
            try {
                await fbUser.delete();
            } catch (firebaseErr) {
                if (firebaseErr.code === 'auth/requires-recent-login') {
                    deleteInProgress.current = false;
                    return { success: false, error: 'Please sign out and sign back in, then try deleting your account again.', requiresReauth: true };
                }
                console.error('Firebase delete failed (backend already deleted):', firebaseErr.message);
            }

            // 3. Sign out
            await signOut(auth).catch(() => {});
            delete axios.defaults.headers.common['Authorization'];
            setUser(null);
            setFirebaseUser(null);

            return { success: true };
        } catch (err) {
            return { success: false, error: friendlyError(err) };
        } finally {
            setTimeout(() => { deleteInProgress.current = false; }, 2000);
        }
    };

    // ── Other helpers ─────────────────────────────────────────────────────────
    const resetPassword = async (email) => {
        try {
            await sendPasswordResetEmail(auth, email);
            return { success: true };
        } catch (err) {
            return { success: false, error: friendlyError(err) };
        }
    };

    const changePassword = async (currentPassword, newPassword) => {
        const fbUser = auth.currentUser;
        if (!fbUser) return { success: false, error: 'You are not signed in.' };
        try {
            const credential = EmailAuthProvider.credential(fbUser.email, currentPassword);
            await reauthenticateWithCredential(fbUser, credential);
            await updatePassword(fbUser, newPassword);
            return { success: true };
        } catch (err) {
            return { success: false, error: friendlyError(err) };
        }
    };

    const resendVerificationEmail = async () => {
        const fbUser = auth.currentUser;
        if (!fbUser) return { success: false, error: 'You are not signed in.' };
        try {
            await sendEmailVerification(fbUser);
            return { success: true };
        } catch (err) {
            return { success: false, error: friendlyError(err) };
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