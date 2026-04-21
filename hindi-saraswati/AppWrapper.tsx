import React, { useState, useEffect } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import ModeSelect, { AppMode } from './components/ModeSelect';
import App from './App';
import AppQuick from './AppQuick';

type Stage = 'checking'|'need-auth'|'select-mode'|'app';
const Y = '#F5B800'; const B = '#0A0A0A';

function AuthScreen({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [mode, setMode] = useState<'login'|'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const errors: Record<string,string> = {
    'auth/user-not-found':'No account found.','auth/wrong-password':'Incorrect password.',
    'auth/invalid-credential':'Incorrect email or password.','auth/email-already-in-use':'Account already exists.',
    'auth/weak-password':'Password must be at least 6 characters.','auth/invalid-email':'Invalid email.',
    'auth/too-many-requests':'Too many attempts. Try later.',
  };
  const handleSubmit = async () => {
    setError(''); setInfo('');
    if (!email||!password){setError('Please enter email and password.');return;}
    setLoading(true);
    try {
      if (mode==='login'){await signInWithEmailAndPassword(auth,email,password);onAuthenticated();}
      else{const c=await createUserWithEmailAndPassword(auth,email,password);await sendEmailVerification(c.user);setInfo('Verification email sent! Please verify then sign in.');setMode('login');}
    } catch(e:any){setError(errors[e.code]||e.message);}
    finally{setLoading(false);}
  };
  const handleGoogle = async () => {
    setError('');setLoading(true);
    try{await signInWithPopup(auth,new GoogleAuthProvider());onAuthenticated();}
    catch(e:any){setError(errors[e.code]||e.message);}
    finally{setLoading(false);}
  };
  const inp: React.CSSProperties = {width:'100%',padding:'0.75rem 1rem',background:'#161616',border:'1px solid #2a2a2a',borderRadius:10,color:'#e7e5e4',fontSize:'0.9rem',outline:'none',boxSizing:'border-box'};
  return (
    <div style={{minHeight:'100vh',background:B,display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem',fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
      {appMode==='quicksolve'?<AppQuick onSwitchMode={()=>setStage('select-mode')}/>:<App onSwitchMode={()=>setStage('select-mode')}/>}
    </>
  );
}
