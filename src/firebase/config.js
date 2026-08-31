import { initializeApp } from "firebase/app"
import { getDatabase } from "firebase/database"
import { getAuth } from "firebase/auth"

const firebaseConfig = {
  apiKey: "AIzaSyC-m5mjg2aSDgTE2qyY6VVWtQyYSjjYERw",
  authDomain: "oud2-to-staf.firebaseapp.com",
  databaseURL:
    "https://oud2-to-staf-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "oud2-to-staf",
  storageBucket: "oud2-to-staf.firebasestorage.app",
  messagingSenderId: "184886010410",
  appId: "1:184886010410:web:fff963026f4b9f2645d953",
  measurementId: "G-6K5PH0YHPJ"
}

const app =
  initializeApp(
    firebaseConfig
  )

export const database =
  getDatabase(app)

export const auth =
  getAuth(app)