// src/config/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey:            "AIzaSyCVozGg6vDhbKc4cVMi7jHuDZlUscX7p3o",
  authDomain:        "numrank.firebaseapp.com",
  databaseURL:       "https://numrank-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "numrank",
  storageBucket:     "numrank.firebasestorage.app",
  messagingSenderId: "379575896271",
  appId:             "1:379575896271:web:39f5a587b3e71bda68cfba",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);
export const rtdb = getDatabase(app);

export default app;