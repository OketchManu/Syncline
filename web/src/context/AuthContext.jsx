// web/src/context/AuthContext.jsx
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
        orgId:      raw.orgId      ?? raw.org_id      ?? null,
        org_id:     raw.org_id     ?? raw.orgId       ?? null,
        companyId:  raw.companyId  ?? raw.company_id  ?? null,
        company_id: raw.company_id ?? raw.companyId   ?? null,
    };
};

const setAxiosToken = async (firebaseUser) => {
    if (!firebaseUser) {
        delete axios.defaults.headers.common['Authorization'];
        return null;
    }
    const token = await firebaseUser.getIdToken();
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    return token;
};

export const AuthProvider = ({ children }) => {
    const [user,         setUser]         = useState(null);
    const [firebaseUser, setFirebaseUser] = useState(null);
    const [loading,      setLoading]      = useState(true);
    const [authError,    setAuthError]    = useState(null);

    const syncBackendUser = useCallback(async (fbUser, registrationPayload = null) => {
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
            return normaliseUser(res.data.user);
        } catch (err) {
            if (err.response?.status === 404) {
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

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
            setFirebaseUser(fbUser);
            if (fbUser) {
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

        const tokenInterval = setInterval(async () => {
            if (auth.currentUser) await setAxiosToken(auth.currentUser);
        }, 55 * 60 * 1000);

        return () => { unsubscribe(); clearInterval(tokenInterval); };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

    const register = async (email, password, fullName, accountType = 'personal', companyName = null, extraCompanyFields = null) => {
        setAuthError(null);
        try {
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
        }
    };

    const loginWithGoogle = async (accountType = 'personal', companyName = null) => {
        setAuthError(null);
        try {
            const result    = await signInWithPopup(auth, googleProvider);
            const fbUser    = result.user;
            const isNewUser = result._tokenResponse?.isNewUser ?? false;
            let backendUser;
            if (isNewUser) {
                backendUser = await syncBackendUser(fbUser, {
                    fullName:    fbUser.displayName || fbUser.email.split('@')[0],
                    avatar:      fbUser.photoURL    || null,
                    accountType: accountType === 'company' ? 'company' : 'personal',
                    companyName,
                    googleLogin: true,
                });
            } else {
                backendUser = await syncBackendUser(fbUser);
            }
            setUser(backendUser);
            return { success: true };
        } catch (err) {
            if (err.code === 'auth/popup-closed-by-user') return { success: false, error: null };
            const message = firebaseErrorMessage(err.code) || err.message;
            setAuthError(message);
            return { success: false, error: message };
        }
    };

    const logout = async () => {
        await signOut(auth);
        delete axios.defaults.headers.common['Authorization'];
        setUser(null);
    };

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
            login, register, loginWithGoogle, logout,
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