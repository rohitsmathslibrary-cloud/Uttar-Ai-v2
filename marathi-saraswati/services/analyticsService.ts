import { db } from '../firebase';
import { auth } from '../firebase';
import {
  collection, addDoc, serverTimestamp, doc,
  getDoc, setDoc, updateDoc, increment
} from 'firebase/firestore';

const CURRICULUM = "IB-Science";

export async function trackStudentPrompt(
  prompt: string,
  sessionId: string,
  isMCQResponse: boolean
): Promise<void> {
  const user = auth.currentUser;
  if (!user || isMCQResponse) return;

  try {
    await addDoc(collection(db, 'prompts'), {
      uid: user.uid,
      prompt: prompt.trim(),
      sessionId,
      curriculum: CURRICULUM,
      timestamp: serverTimestamp(),
    });

    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      await updateDoc(userRef, {
        totalPrompts: increment(1),
        lastActive: serverTimestamp(),
        curriculum: CURRICULUM,
      });
    }
  } catch (e) {
    console.warn('Analytics error:', e);
  }
}

export async function trackSessionStart(sessionId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await addDoc(collection(db, 'sessions'), {
      uid: user.uid,
      sessionId,
      curriculum: CURRICULUM,
      startedAt: serverTimestamp(),
    });
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, {
      totalSessions: increment(1),
      lastActive: serverTimestamp(),
      curriculum: CURRICULUM,
    });
  } catch (e) {
    console.warn('Session tracking error:', e);
  }
}

export function isMCQResponse(text: string, mcqOptions: string[]): boolean {
  if (!mcqOptions || mcqOptions.length === 0) return false;
  return mcqOptions.some(opt =>
    opt.trim().toLowerCase() === text.trim().toLowerCase()
  );
}
