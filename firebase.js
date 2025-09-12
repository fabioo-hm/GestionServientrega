// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  deleteDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAgc2LKUM5YOdi-yghM-oNX5P1rO3Fyt1M",
  authDomain: "gestion-paquetes-d27da.firebaseapp.com",
  projectId: "gestion-paquetes-d27da",
  storageBucket: "gestion-paquetes-d27da.appspot.com",
  messagingSenderId: "874859059548",
  appId: "1:874859059548:web:7be50c95de6d19c0e84999",
  measurementId: "G-MV0NTDC5D3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// 🔹 Exponer globalmente
window.firestore = { db, collection, addDoc, getDocs, updateDoc, doc, query, where, deleteDoc, getDoc };
window.firebaseAuth = auth;
window.listenAuthChanges = (callback) => onAuthStateChanged(auth, callback);
