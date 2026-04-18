import React, { useState, useEffect } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import AuthScreen from './components/AuthScreen';
import ModeSelect, { AppMode } from './components/ModeSelect';
import App from './App';
import AppQuick from './AppQuick';

type Stage = 'checking' | 'need-auth' | 'select-mode' | 'app';

export default function AppWrapper() {
  const [stage, setStage] = useState<Stage>('checking');
  const [mode, setMode] = useState<AppMode | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      unsub();
      setStage(user ? 'select-mode' : 'need-auth');
    });
  }, []);

  async function handleLogout() {
    await signOut(auth);
    setStage('need-auth');
    setMode(null);
  }

  if (stage === 'checking') {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0A0A0A', fontFamily:"'Segoe UI', system-ui, sans-serif" }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ width:40, height:40, border:'3px solid #F5B800', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 1rem' }} />
          <div style={{ color:'#444', fontSize:'0.85rem' }}>Loading...</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (stage === 'need-auth') return <AuthScreen onAuthenticated={() => setStage('select-mode')} />;
  
  if (stage === 'select-mode') return (
    <div style={{ position: 'relative' }}>
      <div style={{ position:'fixed', top:16, right:16, zIndex:9999 }}>
        <button
          onClick={handleLogout}
          style={{ background:'rgba(26,26,26,0.9)', border:'1px solid #3A3A3A', borderRadius:20, padding:'0.4rem 1.2rem', color:'#888', fontSize:'0.72rem', cursor:'pointer', fontFamily:"'Segoe UI', system-ui, sans-serif", letterSpacing:'0.03em', backdropFilter:'blur(8px)' }}
        >
          Sign Out
        </button>
      </div>
      <ModeSelect onSelect={(m) => { setMode(m); setStage('app'); }} />
    </div>
  );

  return (
    <>
      <div style={{ position:'fixed', top:0, left:0, right:0, height:64, display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, pointerEvents:'none' }}>
        <button
          onClick={() => setStage('select-mode')}
          style={{ pointerEvents:'auto', background:'rgba(26,26,26,0.9)', border:'1px solid #3A3A3A', borderRadius:20, padding:'0.4rem 1.2rem', color:'#888', fontSize:'0.72rem', cursor:'pointer', fontFamily:"'Segoe UI', system-ui, sans-serif", letterSpacing:'0.03em', backdropFilter:'blur(8px)' }}
        >
          ⇄ Switch Mode
        </button>
      </div>
      {mode === 'quicksolve' ? <AppQuick /> : <App />}
    </>
  );
}
