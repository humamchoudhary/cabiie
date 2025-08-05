// config/firebase.ts
import { initializeApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
} from "firebase/auth";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";
import { getDatabase } from "firebase/database";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
const firebaseConfig = {
  apiKey: "AIzaSyBXOqYdd6KMt4fOCvXQMK1h-kjao-lodLA",

  authDomain: "indrive-clone-e0ec9.firebaseapp.com",

  databaseURL: "https://indrive-clone-e0ec9-default-rtdb.asia-southeast1.firebasedatabase.app",

  projectId: "indrive-clone-e0ec9",

  storageBucket: "indrive-clone-e0ec9.firebasestorage.app",

  messagingSenderId: "194509781434",

  appId: "1:194509781434:web:c4de75cda29f9f69ac4583",

  measurementId: "G-ZLVHNW9YSC"
};

const app = initializeApp(firebaseConfig);
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});

export { auth };
export const database = getDatabase(app);
export const firestore = getFirestore(app);
export const storage = getStorage(app);
