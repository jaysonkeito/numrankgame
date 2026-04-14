// src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FBUser,
} from 'firebase/auth';
import {
  doc, setDoc, getDoc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { ref, set, onDisconnect, onValue } from 'firebase/database';
import { auth, db, rtdb } from '../config/firebase';
import { Player, getRank, generatePlayerId, validateUsername } from '../types';

interface Ctx {
  user:         Player | null;
  firebaseUser: FBUser  | null;
  isLoggedIn:   boolean;
  loading:      boolean;
  login:        (email: string, password: string) => Promise<string | null>;
  register:     (username: string, email: string, password: string) => Promise<string | null>;
  logout:       () => Promise<void>;
  addPoints:    (pts: number) => Promise<void>;
}

const AuthContext = createContext<Ctx | null>(null);

// Separate flag: track whether we are in a "just registered" state
// so we do NOT auto-login after createUserWithEmailAndPassword
let justRegistered = false;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,         setUser]         = useState<Player | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FBUser  | null>(null);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser && !justRegistered) {
        // Normal login - load profile and set user
        setFirebaseUser(fbUser);
        await loadProfile(fbUser.uid);
        setupPresence(fbUser.uid);
      } else if (fbUser && justRegistered) {
        // Just registered - sign out immediately, force manual login
        justRegistered = false;
        await signOut(auth);
        setFirebaseUser(null);
        setUser(null);
      } else {
        setFirebaseUser(null);
        setUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const loadProfile = async (uid: string) => {
    try {
      const snap = await getDoc(doc(db, 'players', uid));
      if (snap.exists()) {
        const d = snap.data();
        setUser({
          uid,
          id:       d.playerId   ?? '',
          username: d.username   ?? '',
          email:    d.email      ?? '',
          pts:      d.pts        ?? 0,
          rank:     getRank(d.pts ?? 0).name,
          online:   true,
          location: d.location   ?? '',
        });
      }
    } catch (e) {
      console.error('[Auth] loadProfile:', e);
    }
  };

  const setupPresence = (uid: string) => {
    const presRef = ref(rtdb, `presence/${uid}`);
    const connRef = ref(rtdb, '.info/connected');
    onValue(connRef, (snap) => {
      if (snap.val() === true) {
        set(presRef, { online: true, lastSeen: Date.now() });
        onDisconnect(presRef).set({ online: false, lastSeen: Date.now() });
      }
    });
  };

  const login = async (email: string, password: string): Promise<string | null> => {
    if (!email.trim()) return 'Please enter your email.';
    if (!password)     return 'Please enter your password.';
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      return null;
    } catch (e: any) {
      const c = e?.code ?? '';
      if (['auth/user-not-found','auth/wrong-password','auth/invalid-credential'].includes(c))
        return 'Incorrect email or password.';
      if (c === 'auth/invalid-email')     return 'Enter a valid email address.';
      if (c === 'auth/too-many-requests') return 'Too many attempts. Try again later.';
      return 'Login failed. Please try again.';
    }
  };

  const register = async (
    username: string, email: string, password: string,
  ): Promise<string | null> => {
    const uErr = validateUsername(username);
    if (uErr)                return uErr;
    if (!email.includes('@')) return 'Enter a valid email address.';
    if (password.length < 8)  return 'Password must be at least 8 characters.';
    try {
      justRegistered = true; // prevent auto-login
      const cred     = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const uid      = cred.user.uid;
      const playerId = generatePlayerId();

      await setDoc(doc(db, 'players', uid), {
        uid, playerId,
        username:  username.trim(),
        email:     email.trim(),
        pts:       0,
        rank:      'Beginner',
        location:  '',
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'playerIds', playerId), { uid });
      return null;
    } catch (e: any) {
      justRegistered = false;
      const c = e?.code ?? '';
      if (c === 'auth/email-already-in-use') return 'This email is already registered.';
      if (c === 'auth/invalid-email')        return 'Enter a valid email address.';
      if (c === 'auth/weak-password')        return 'Password must be at least 8 characters.';
      return 'Registration failed. Please try again.';
    }
  };

  const logout = async () => {
    try {
      if (firebaseUser) {
        await set(ref(rtdb, `presence/${firebaseUser.uid}`), {
          online: false, lastSeen: Date.now(),
        }).catch(() => {});
      }
      await signOut(auth);
      setUser(null);
      setFirebaseUser(null);
    } catch (e) {
      console.error('[Auth] logout:', e);
    }
  };

  const addPoints = async (pts: number) => {
    if (!user || !firebaseUser || pts <= 0) return;
    const newPts  = user.pts + pts;
    const newRank = getRank(newPts).name;
    try {
      await updateDoc(doc(db, 'players', firebaseUser.uid), { pts: newPts, rank: newRank });
      setUser(prev => prev ? { ...prev, pts: newPts, rank: newRank } : prev);
    } catch (e) {
      console.error('[Auth] addPoints:', e);
    }
  };

  return (
    <AuthContext.Provider value={{
      user, firebaseUser,
      isLoggedIn: !!user && !loading,
      loading, login, register, logout, addPoints,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): Ctx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside <AuthProvider>');
  return ctx;
}
