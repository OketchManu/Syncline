// src/firebase.js
import { initializeApp } from 'firebase/app';
import {
    getAuth,
    GoogleAuthProvider,
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
} from 'firebase/auth';

const firebaseConfig = {
    apiKey:            'AIzaSyAIfA-71L9uJpKcGu_hZm4eyokmQT4FEVk',
    authDomain:        'syncline-8010e.firebaseapp.com',
    projectId:         'syncline-8010e',
    storageBucket:     'syncline-8010e.firebasestorage.app',
    messagingSenderId: '539430512871',
    appId:             '1:539430512871:web:0c26ece85f0ecca9d11a42',
    measurementId:     'G-YTVSGG7REG',
};

const app          = initializeApp(firebaseConfig);
export const auth  = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Optional: always prompt account selection even if already signed in
googleProvider.setCustomParameters({ prompt: 'select_account' });

export {
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
};

export default app;