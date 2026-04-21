import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
const firebaseConfig = {
  apiKey: "AIzaSyD60_KPXm5_30yDAd_8ECBiu6z_Fw3tOOg",
  authDomain: "lakshmi-ai.firebaseapp.com",
  projectId: "lakshmi-ai",
  storageBucket: "lakshmi-ai.firebasestorage.app",
  messagingSenderId: "1006192258539",
  appId: "1:1006192258539:web:f49c12a015232bb2103dae",
};
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
