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
        const token = await firebaseUser.getIdToken(true); // Force refresh
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

    const syncBackendUser = useCallback(async (fbUser, registrationPayload = null) => {
        console.log('📡 syncBackendUser called with:', { 
            fbUid: fbUser?.uid, 
            hasRegistrationPayload: !!registrationPayload 
        });

        // ✅ CRITICAL: Set token BEFORE making any API requests
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

        try {
            console.log('🔍 Fetching user from /api/auth/me...');
            const res = await axios.get(`${API_URL}/auth/me`);
            console.log('✅ /api/auth/me success:', { userId: res.data.user?.id, email: res.data.user?.email });
            return normaliseUser(res.data.user);
        } catch (err) {
            console.error('❌ /api/auth/me failed:', { 
                status: err.response?.status, 
                error: err.response?.data?.error,
                message: err.message 
            });

           if (err.response?.status === 404) {
    console.log('📝 User not found, creating via firebase-sync...');
    const res = await axios.post(`${API_URL}/auth/firebase-sync`, {
        email:       fbUser.email,
        fullName:    fbUser.displayName || fbUser.email.split('@')[0],
        firebaseUid: fbUser.uid,
        avatar:      fbUser.photoURL || null,
    });
    console.log('✅ firebase-sync response:', { userId: res.data.user?.id });
    // Fetch full profile from /me so we get name, avatar_url etc.
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

    useEffect(() => {
        console.log('🔌 Setting up Firebase auth listener...');
        const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
            console.log('🔄 Auth state changed:', { uid: fbUser?.uid, email: fbUser?.email });
            
            setFirebaseUser(fbUser);
            if (fbUser) {
                if (!user) {
                    try {
                        console.log('👤 No user in state, syncing with backend...');
                        const backendUser = await syncBackendUser(fbUser);
                        console.log('✅ Backend sync successful:', { userId: backendUser?.id });
                        setUser(backendUser);
                    } catch (err) {
                        console.error('❌ AuthContext: failed to sync user with backend:', err);
                        console.error('   Stack:', err.stack);
                        setUser(null);
                    }
                }
            } else {
                console.log('🚪 User logged out');
                delete axios.defaults.headers.common['Authorization'];
                setUser(null);
            }
            setLoading(false);
        });

        const tokenInterval = setInterval(async () => {
            if (auth.currentUser) {
                console.log('🔄 Refreshing Firebase ID token...');
                await setAxiosToken(auth.currentUser);
            }
        }, 55 * 60 * 1000); // Every 55 minutes

        return () => { 
            console.log('🧹 Cleaning up auth listener');
            unsubscribe(); 
            clearInterval(tokenInterval); 
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const login = async (email, password) => {
        setAuthError(null);
        try {
            console.log('🔐 Logging in with email:', email);
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
        }
    };

    const register = async (email, password, fullName, accountType = 'personal', companyName = null, extraCompanyFields = null) => {
        setAuthError(null);
        try {
            console.log('📝 Registering new user:', { email, accountType });
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
        }
    };

    const loginWithGoogle = async (accountType = 'personal', companyName = null) => {
        setAuthError(null);
        try {
            console.log('🔐 Logging in with Google:', { accountType });
            const result    = await signInWithPopup(auth, googleProvider);
            const fbUser    = result.user;
            const isNewUser = result._tokenResponse?.isNewUser ?? false;
            let backendUser;
            if (isNewUser) {
                console.log('📝 New Google user, creating account...');
                backendUser = await syncBackendUser(fbUser, {
                    fullName:    fbUser.displayName || fbUser.email.split('@')[0],
                    avatar:      fbUser.photoURL    || null,
                    accountType: accountType === 'company' ? 'company' : 'personal',
                    companyName,
                    googleLogin: true,
                });
            } else {
                console.log('👤 Existing Google user, syncing...');
                backendUser = await syncBackendUser(fbUser);
            }
            console.log('✅ Google login successful:', { userId: backendUser?.id });
            setUser(backendUser);
            return { success: true };
        } catch (err) {
            if (err.code === 'auth/popup-closed-by-user') return { success: false, error: null };
            const message = firebaseErrorMessage(err.code) || err.message;
            console.error('❌ Google login failed:', message);
            setAuthError(message);
            return { success: false, error: message };
        }
    };

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
        'auth/weak-password':          'Password must be at least 6 characters.',
        'auth/email-already-in-use':   'Email is already registered.',
        'auth/invalid-email':          'Invalid email address.',
        'auth/popup-closed-by-user':   'Sign-in popup was closed.',
        'auth/account-exists-with-different-credential': 'An account already exists with this email.',
    };
    return map[code] || null;
};