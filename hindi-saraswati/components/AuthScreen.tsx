import React, { useState } from 'react';
import { auth, db } from '../firebase';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  updateProfile, GoogleAuthProvider, signInWithPopup,
  sendEmailVerification,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { FULL_LOGO } from '../assets';

const Y = '#F5B800', B = '#0A0A0A', W = '#FFFFFF';
const inp = { width:'100%', padding:'0.75rem 1rem', background:'#111', border:'1px solid #1e1e1e', borderRadius:10, color:W, fontSize:'0.9rem', outline:'none', boxSizing:'border-box' as const, fontFamily:"'Segoe UI', system-ui, sans-serif", marginBottom:'0.75rem' };
const errMap: Record<string,string> = {
  'auth/email-already-in-use': 'This email is already registered. Please sign in.',
  'auth/wrong-password': 'Incorrect password.',
  'auth/user-not-found': 'No account found with this email.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
  'auth/popup-blocked': 'Popup was blocked. Please allow popups for this site.',
};

interface Props { onAuthenticated: () => void; }

export default function AuthScreen({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<'login'|'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  async function saveUserToFirestore(uid: string, displayName: string, userEmail: string) {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        name: displayName,
        email: userEmail.toLowerCase(),
        phone: '',
        createdAt: serverTimestamp(),
        role: 'student',
        platform: 'web',
      });
    }
  }

  async function handleSubmit() {
    setError(''); setLoading(true);
    try {
      if (mode === 'register') {
        if (!name.trim()) { setError('Please enter your name.'); setLoading(false); return; }
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: name.trim() });
        await sendEmailVerification(cred.user);
        await saveUserToFirestore(cred.user.uid, name.trim(), email);
        setVerificationSent(true);
        setLoading(false);
        return;
      } else {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        if (!cred.user.emailVerified) {
          await sendEmailVerification(cred.user);
          setError('Please verify your email first. A new verification link has been sent.');
          await auth.signOut();
          setLoading(false);
          return;
        }
        await saveUserToFirestore(cred.user.uid, cred.user.displayName || email.split('@')[0], email);
      }
      onAuthenticated();
    } catch(e: any) {
      setError(errMap[e.code] || e.message);
    }
    setLoading(false);
  }

  async function handleGoogle() {
    setError(''); setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      await saveUserToFirestore(result.user.uid, result.user.displayName || '', result.user.email || '');
      onAuthenticated();
    } catch(e: any) {
      setError(errMap[e.code] || e.message);
    }
    setLoading(false);
  }

  if (verificationSent) {
    return (
      <div style={{ minHeight:'100vh', background:B, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Segoe UI', system-ui, sans-serif", padding:'1.5rem' }}>
        <div style={{ width:'100%', maxWidth:400, textAlign:'center' }}>
          <img src={FULL_LOGO} alt="Uttar Ai" style={{ width:200, objectFit:'contain', borderRadius:10, marginBottom:'2rem' }} />
          <div style={{ background:'#0f0f0f', border:'1px solid #1a1a1a', borderRadius:18, padding:'2rem' }}>
            <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>📧</div>
            <h2 style={{ color:W, fontSize:'1.25rem', fontWeight:700, marginBottom:'0.75rem' }}>Verify your email</h2>
            <p style={{ color:'#888', fontSize:'0.85rem', lineHeight:1.6, marginBottom:'1.5rem' }}>
              We've sent a verification link to <strong style={{ color:Y }}>{email}</strong>. Please check your inbox and click the link to activate your account.
            </p>
            <button onClick={() => { setVerificationSent(false); setMode('login'); }}
              style={{ width:'100%', padding:'0.85rem', background:Y, border:'none', borderRadius:10, color:B, fontWeight:700, fontSize:'0.95rem', cursor:'pointer' }}>
              Go to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight:'100vh', background:B, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Segoe UI', system-ui, sans-serif", padding:'1.5rem' }}>
      <div style={{ width:'100%', maxWidth:400 }}>
        <div style={{ textAlign:'center', marginBottom:'2rem' }}>
          <img src={FULL_LOGO} alt="Uttar Ai" style={{ width:200, objectFit:'contain', borderRadius:10 }} />
        </div>
        <div style={{ background:'#0f0f0f', border:'1px solid #1a1a1a', borderRadius:18, padding:'2rem' }}>
          <h2 style={{ color:W, fontSize:'1.25rem', fontWeight:700, marginBottom:'0.25rem', textAlign:'center' }}>
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h2>
          <p style={{ color:'#444', fontSize:'0.8rem', textAlign:'center', marginBottom:'1.5rem' }}>
            {mode === 'login' ? 'Sign in to continue learning' : 'Start your free learning journey'}
          </p>

          {mode === 'register' && (
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Your full name" style={inp} />
          )}
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address" type="email" style={inp} />
          <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" type="password"
            onKeyDown={e=>e.key==='Enter'&&handleSubmit()} style={inp} />

          {error && <div style={{ color:'#f87171', fontSize:'0.8rem', marginBottom:'0.75rem', textAlign:'center' }}>{error}</div>}

          <button onClick={handleSubmit} disabled={loading} style={{ width:'100%', padding:'0.85rem', background:loading?'#333':Y, border:'none', borderRadius:10, color:loading?'#666':B, fontWeight:700, fontSize:'0.95rem', cursor:loading?'not-allowed':'pointer', marginBottom:'0.75rem' }}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>

          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', margin:'0.5rem 0' }}>
            <div style={{ flex:1, height:1, background:'#1e1e1e' }} />
            <span style={{ color:'#333', fontSize:'0.75rem' }}>or</span>
            <div style={{ flex:1, height:1, background:'#1e1e1e' }} />
          </div>

          <button onClick={handleGoogle} disabled={loading} style={{ width:'100%', padding:'0.8rem', background:'#111', border:'1px solid #2A2A2A', borderRadius:10, color:W, fontWeight:600, fontSize:'0.88rem', cursor:loading?'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.6rem', marginTop:'0.75rem' }}>
            <span style={{ fontSize:'1.1rem' }}>G</span> Continue with Google
          </button>

          <div style={{ textAlign:'center', marginTop:'1.25rem' }}>
            <span style={{ color:'#444', fontSize:'0.82rem' }}>
              {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
            </span>
            <button onClick={() => { setMode(mode==='login'?'register':'login'); setError(''); }}
              style={{ background:'none', border:'none', color:Y, fontSize:'0.82rem', cursor:'pointer', fontWeight:600 }}>
              {mode === 'login' ? 'Register free' : 'Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
