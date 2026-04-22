// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDdNFhrBcsLd9lc3Nj0kS6keD3ah7mnX20",
  authDomain: "chat-room-885ce.firebaseapp.com",
  databaseURL: "https://chat-room-885ce-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "chat-room-885ce",
  storageBucket: "chat-room-885ce.firebasestorage.app",
  messagingSenderId: "152768965450",
  appId: "1:152768965450:web:793a633892adba57b2efb3",
  measurementId: "G-XZL959JQG0"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const storage = getStorage(app);
