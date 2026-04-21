// Web version of geminiService - uses proxy instead of direct API calls
import { MODELS, SYSTEM_INSTRUCTION } from "../constants";
import { callGeminiProxy } from "./geminiWebProxy";

// Proxy - routes all Gemini calls through Firebase Cloud Function
const PROXY_URL = 'https://geminiproxy-ljtntzc7pq-el.a.run.app';
async function callProxy(model: string, body: object, referer: string): Promise<any> {
  const response = await fetch(`${PROXY_URL}?model=${encodeURIComponent(model)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Referer': referer },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Proxy error: ${response.status}`);
  return response.json();
}

export const getEstimatedWaitTime = (taskType: 'math' | 'fast', prompt: string = ""): string => {
  if (taskType === 'math') return "~1-3 mins";
  return "~3-5 seconds";
};

// Audio Context Singleton
let audioContext: AudioContext | null = null;
export const initAudioContext = (): AudioContext => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  }
  if (audioContext.state === 'suspended') audioContext.resume();
  return audioContext;
};
export const getAudioContext = (): AudioContext | null => audioContext;

export const generateMathResponse = async (
  history: { role: string; parts: { text: string }[] }[],
  currentPrompt: string,
  imagePart?: { inlineData: { mimeType: string; data: string } }
) => {
  try {
    const sanitizedHistory = history.map(h => ({
      role: h.role === 'model' ? 'model' : 'user',
      parts: h.parts.filter(p => p.text && p.text.trim().length > 0).length > 0
        ? h.parts.filter(p => p.text && p.text.trim().length > 0)
        : [{ text: '...' }]
    }));
    const currentParts: any[] = [];
    if (currentPrompt && currentPrompt.trim()) currentParts.push({ text: currentPrompt });
    if (imagePart) currentParts.push(imagePart);
    if (currentParts.length === 0) currentParts.push({ text: "Analyze this." });
    const contents = [...sanitizedHistory, { role: 'user', parts: currentParts }];
    const data = await callGeminiProxy(MODELS.FLASH, {
      system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents,
      generation_config: { max_output_tokens: 10000, thinking_config: { thinking_budget: 4000 } },
    });
    const text = data.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text || '';
    const groundingChunks = data.candidates?.[0]?.groundingMetadata?.groundingChunks;
    return { text, groundingChunks };
  } catch (error) {
    console.error("Gemini Math Error:", error);
    throw error;
  }
};

const cleanTextForSpeech = (text: string): string => {
  if (!text) return "";
  let t = text;
  t = t.replace(/<<[\s\S]*?>>/g, "");
  t = t.replace(/[*_~`#]/g, " ");
  t = t.replace(/\[.*?\]/g, "");
  t = t.replace(/\n+/g, ". ");
  t = t.replace(/---/g, " ");
  t = t.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '');
  t = t.replace(/\$?\$([^$]+)\$? \$/g, (_, m) => {
    m = m.replace(/\\frac\s*{([^}]*)}\s*{([^}]*)}/g, "$1 over $2");
    m = m.replace(/\\sqrt\s*{([^}]*)}/g, "square root of $1");
    m = m.replace(/\^2/g, " squared").replace(/\^3/g, " cubed");
    m = m.replace(/\^{([^}]*)}/g, " to the power of $1");
    m = m.replace(/_/g, " subscript ");
    m = m.replace(/\\cdot|\\times/g, " times ");
    m = m.replace(/\\div/g, " divided by ");
    m = m.replace(/\\pm/g, " plus or minus ");
    m = m.replace(/\\infty/g, " infinity ");
    m = m.replace(/\\pi/g, " pi ");
    m = m.replace(/\\theta/g, " theta ");
    m = m.replace(/\\int/g, " integral ");
    m = m.replace(/[=]/g, " equals ");
    m = m.replace(/\\/g, " ");
    return m;
  });
  t = t.replace(/"/g, "'");
  t = t.replace(/\s+/g, " ").trim();
  return t;
};

const decodeAudio = async (base64: string, ctx: AudioContext): Promise<AudioBuffer> => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  const dataInt16 = new Int16Array(bytes.buffer);
  const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
  return buffer;
};

export const getTTSAudioBuffer = async (text: string): Promise<AudioBuffer | null> => {
  const ctx = initAudioContext();
  if (!text || text.trim().length === 0) return null;
  const rawText = text.length > 2500 ? text.substring(0, 2500) + "..." : text;
  const spokenText = cleanTextForSpeech(rawText);
  if (!spokenText || spokenText.trim().length === 0) return null;

  const prompts = [
    `Speak with a highly energetic, excited, and warm Indian English accent. Be expressive and engaging: "${spokenText}"`,
    `Speak with an Indian English accent: "${spokenText}"`,
    spokenText
  ];

  for (const prompt of prompts) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const data = await callGeminiProxy(MODELS.TTS, {
          contents: [{ parts: [{ text: prompt }] }],
          generation_config: {
            response_modalities: ["AUDIO"],
            speech_config: { voice_config: { prebuilt_voice_config: { voice_name: "Kore" } } }
          }
        });
        const part = data.candidates?.[0]?.content?.parts?.[0];
        const audioData = part?.inline_data?.data || part?.inlineData?.data;
        if (audioData) return await decodeAudio(audioData, ctx);
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        console.warn(`TTS attempt failed:`, e);
        await new Promise(r => setTimeout(r, 500));
      }
    }
  }
  return null;
};