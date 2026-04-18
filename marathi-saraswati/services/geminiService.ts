import { Modality } from "@google/genai";
import { MODELS, SYSTEM_INSTRUCTION } from "../constants";

const PROXY_URL = 'https://geminiproxy-ljtntzc7pq-el.a.run.app';

const callProxy = async (model: string, body: object): Promise<any> => {
  const response = await fetch(`${PROXY_URL}?model=${encodeURIComponent(model)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Referer': 'https://ig-saraswati.uttarai.in/' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Proxy error: ${response.status}`);
  return response.json();
};

// Audio Context Singleton
let audioContext: AudioContext | null = null;

export const initAudioContext = (): AudioContext => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
};

export const getAudioContext = () => audioContext;

export const getEstimatedWaitTime = (taskType: 'math' | 'fast', prompt: string = ""): string => {
  if (taskType === 'math') return "~15-30 seconds";
  return "~3-5 seconds";
};

export const generateMathResponse = async (
  history: { role: string; parts: { text: string }[] }[],
  currentPrompt: string,
  imagePart?: { inlineData: { mimeType: string; data: string } }
) => {
  try {
    const sanitizedHistory = history.map(h => ({
      role: h.role,
      parts: h.parts.filter(p => p.text && p.text.trim().length > 0)
    })).filter(h => h.parts.length > 0);

    const currentParts: any[] = [];
    if (imagePart) currentParts.push(imagePart);
    if (currentPrompt && currentPrompt.trim().length > 0) currentParts.push({ text: currentPrompt });
    if (currentParts.length === 0) currentParts.push({ text: "Analyze this." });

    const contents = [...sanitizedHistory, { role: 'user', parts: currentParts }];

    const data = await callProxy(MODELS.FLASH, {
      system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents,
      tools: [{ google_search: {} }],
      generation_config: { max_output_tokens: 10000, thinking_config: { thinking_budget: 4000 } }
    });

    const parts = data.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p: any) => p.text || '').join('');
    const groundingChunks = data.candidates?.[0]?.groundingMetadata?.groundingChunks;
    return { text, groundingChunks };
  } catch (error) {
    console.error("Gemini Math Error:", error);
    throw error;
  }
};

export const generateFastResponse = async (prompt: string) => {
  try {
    const data = await callProxy(MODELS.FLASH_LITE, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      system_instruction: { parts: [{ text: "You are a helpful assistant. Keep it brief." }] },
      generation_config: { max_output_tokens: 500 }
    });
    const parts = data.candidates?.[0]?.content?.parts || [];
    return parts.map((p: any) => p.text || '').join('');
  } catch (error) {
    console.error("Fast Response Error:", error);
    return "Something went wrong.";
  }
};

export const transcribeAudio = async (base64Audio: string, mimeType: string) => {
  try {
    const data = await callProxy(MODELS.FLASH, {
      contents: [{ role: 'user', parts: [{ inlineData: { mimeType, data: base64Audio } }, { text: "Transcribe this audio exactly as spoken." }] }],
      generation_config: { max_output_tokens: 500 }
    });
    const parts = data.candidates?.[0]?.content?.parts || [];
    return parts.map((p: any) => p.text || '').join('');
  } catch (error) {
    console.error("Transcription Error:", error);
    return "";
  }
};

const cleanTextForSpeech = (text: string): string => {
  return text
    .replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '')
    .replace(/\$\$(.*?)\$\$/gs, '$1').replace(/\$(.*?)\$/g, '$1')
    .replace(/```[\s\S]*?```/g, '').replace(/`/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[🔵🟡🔴⚡🌟💡🎯✨🚀]/gu, '')
    .replace(/\n{3,}/g, '\n\n').trim();
};

const decodeAudio = async (base64: string, ctx: AudioContext): Promise<AudioBuffer> => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return ctx.decodeAudioData(bytes.buffer);
};

export const getTTSAudioBuffer = async (text: string): Promise<AudioBuffer | null> => {
  const ctx = initAudioContext();
  if (!text || text.trim().length === 0) return null;

  const maxLength = 2500;
  const rawText = text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
  const spokenText = cleanTextForSpeech(rawText);
  if (!spokenText || spokenText.trim().length === 0) return null;

  const attempts = [
    `Speak with a highly energetic, excited, and warm Indian English accent. Be expressive and engaging: "${spokenText}"`,
    `Speak with an Indian English accent: "${spokenText}"`,
    spokenText
  ];

  for (const prompt of attempts) {
    try {
      const data = await callProxy(MODELS.TTS, {
        contents: [{ parts: [{ text: prompt }] }],
        generation_config: {
          response_modalities: ['AUDIO'],
          speech_config: { voice_config: { prebuilt_voice_config: { voice_name: 'Kore' } } }
        }
      });
      const part = data.candidates?.[0]?.content?.parts?.[0];
      const audioData = part?.inlineData?.data || part?.inline_data?.data;
      if (audioData) return await decodeAudio(audioData, ctx);
    } catch (e) {
      console.warn("TTS attempt failed:", e);
    }
  }
  return null;
};
