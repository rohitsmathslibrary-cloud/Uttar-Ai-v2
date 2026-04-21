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
      <div style={{width:'100%',maxWidth:400}}>
        <div style={{textAlign:'center',marginBottom:'2rem'}}>
          <div style={{width:64,height:64,borderRadius:'50%',background:'rgba(245,184,0,0.1)',border:'2px solid rgba(245,184,0,0.3)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 1rem',fontSize:'2rem',fontWeight:'bold',color:Y,fontFamily:'Arial'}}>स</div>
          <h1 style={{color:'#fff',fontSize:'1.6rem',fontWeight:700,margin:0}}>Saraswati</h1>
          <p style={{color:Y,fontSize:'0.7rem',fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',marginTop:'0.3rem'}}>CBSE Science · Hindi · UttarAI</p>
        </div>
        <div style={{background:'#111',border:'1px solid #1e1e1e',borderRadius:16,padding:'2rem'}}>
          <h2 style={{color:'#fff',fontSize:'1.1rem',fontWeight:600,marginBottom:'1.5rem'}}>{mode==='login'?'Sign In':'Create Account'}</h2>
          {error&&<div style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:8,padding:'0.75rem',color:'#f87171',fontSize:'0.82rem',marginBottom:'1rem'}}>{error}</div>}
          {info&&<div style={{background:'rgba(34,197,94,0.1)',border:'1px solid rgba(34,197,94,0.3)',borderRadius:8,padding:'0.75rem',color:'#4ade80',fontSize:'0.82rem',marginBottom:'1rem'}}>{info}</div>}
          <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
            <div><label style={{color:'#78716c',fontSize:'0.78rem',display:'block',marginBottom:'0.35rem'}}>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSubmit()} placeholder="you@example.com" style={inp}/></div>
            <div><label style={{color:'#78716c',fontSize:'0.78rem',display:'block',marginBottom:'0.35rem'}}>Password</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSubmit()} placeholder="••••••••" style={inp}/></div>
            <button onClick={handleSubmit} disabled={loading} style={{width:'100%',padding:'0.8rem',background:Y,border:'none',borderRadius:10,color:B,fontWeight:700,fontSize:'0.9rem',cursor:'pointer',marginTop:'0.5rem',opacity:loading?0.7:1}}>{loading?'Please wait...':mode==='login'?'Sign In':'Create Account'}</button>
            <div style={{display:'flex',alignItems:'center',gap:'0.75rem'}}><div style={{flex:1,height:1,background:'#1e1e1e'}}/><span style={{color:'#44403c',fontSize:'0.75rem'}}>or</span><div style={{flex:1,height:1,background:'#1e1e1e'}}/></div>
            <button onClick={handleGoogle} disabled={loading} style={{width:'100%',padding:'0.75rem',background:'#161616',border:'1px solid #2a2a2a',borderRadius:10,color:'#e7e5e4',fontSize:'0.85rem',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'0.5rem'}}>
              <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continue with Google
            </button>
          </div>
          <p style={{textAlign:'center',color:'#57534e',fontSize:'0.8rem',marginTop:'1.25rem'}}>
            {mode==='login'?"Don't have an account? ":"Already have an account? "}
            <button onClick={()=>{setMode(mode==='login'?'register':'login');setError('');setInfo('');}} style={{background:'none',border:'none',color:Y,fontSize:'0.82rem',cursor:'pointer',fontWeight:600}}>{mode==='login'?'Register free':'Sign in'}</button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AppWrapper() {
  const [stage, setStage] = useState<Stage>('checking');
  const [appMode, setAppMode] = useState<AppMode|null>(null);
  useEffect(()=>{const u=onAuthStateChanged(auth,user=>{u();setStage(user?'select-mode':'need-auth');});return u;},[]);
  const handleLogout = async()=>{await signOut(auth);setStage('need-auth');setAppMode(null);};
  if(stage==='checking') return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:B}}>
      <div style={{width:40,height:40,border:'3px solid #F5B800',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  if(stage==='need-auth') return <AuthScreen onAuthenticated={()=>setStage('select-mode')}/>;
  if(stage==='select-mode') return (
    <div style={{position:'relative'}}>
      <div style={{position:'fixed',top:16,right:16,zIndex:9999}}>
        <button onClick={handleLogout} style={{background:'rgba(26,26,26,0.9)',border:'1px solid #3A3A3A',borderRadius:20,padding:'0.4rem 1.2rem',color:'#888',fontSize:'0.72rem',cursor:'pointer',backdropFilter:'blur(8px)'}}>Sign Out</button>
      </div>
      <ModeSelect onSelect={m=>{setAppMode(m);setStage('app');}}/>
    </div>
  );
  return (
    <div>
      {appMode==='quicksolve'
        ? <AppQuick onSwitchMode={()=>setStage('select-mode')}/>
        : <App onSwitchMode={()=>setStage('select-mode')}/>
      }
    </div>
  );
}
