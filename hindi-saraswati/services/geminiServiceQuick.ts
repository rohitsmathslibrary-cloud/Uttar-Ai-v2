

import { GoogleGenAI, Type, Modality } from "@google/genai";
import { MODELS, SYSTEM_INSTRUCTION } from "../constants";

// Initialize API client
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

export const getEstimatedWaitTime = (taskType: 'math' | 'fast', prompt: string = ""): string => {
  if (taskType === 'math') {
      return "Upto 30 seconds";
  }
  switch (taskType) {
    case 'fast':
      return "~3-5 seconds";
    default:
      return "Upto 30 seconds";
  }
};

export const generateMathResponse = async (
  history: { role: string; parts: { text: string }[] }[],
  currentPrompt: string,
  imagePart?: { inlineData: { mimeType: string; data: string } }
) => {
  try {
    const modelId = MODELS.FLASH;
    
    // 1. Sanitize History: Ensure no empty parts
    const sanitizedHistory = history.map(h => ({
      role: h.role,
      parts: h.parts.filter(p => p.text && p.text.trim().length > 0)
    })).filter(h => h.parts.length > 0);

    // 2. Construct Current Parts: Filter empty text
    const currentParts: any[] = [];
    if (imagePart) {
      currentParts.push(imagePart);
    }
    if (currentPrompt && currentPrompt.trim().length > 0) {
      currentParts.push({ text: currentPrompt });
    }
    
    // Safety Fallback: If both image and text are missing (unlikely but possible via UI), send a placeholder
    if (currentParts.length === 0) {
       currentParts.push({ text: "Analyze this." }); 
    }

    const contents = [
      ...sanitizedHistory,
      {
        role: 'user',
        parts: currentParts
      }
    ];

    const response = await ai.models.generateContent({
      model: modelId,
      contents: contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ googleSearch: {} }], 
        maxOutputTokens: 20000, 
        thinkingConfig: { thinkingBudget: 4000 }, 
      }
    });

    return {
      text: response.text,
      groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks
    };
  } catch (error) {
    console.error("Gemini Math Error:", error);
    throw error;
  }
};

export const generateFastResponse = async (prompt: string) => {
  try {
    const response = await ai.models.generateContent({
      model: MODELS.FLASH_LITE,
      contents: prompt,
      config: {
        systemInstruction: "You are a helpful assistant. Keep it brief.",
      }
    });
    return response.text;
  } catch (error) {
    console.error("Fast Response Error:", error);
    return "Something went wrong.";
  }
};

// Transcribe audio blob to text using Gemini Flash
export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY! });
  
  // Convert blob to base64
  const reader = new FileReader();
  const base64Promise = new Promise<string>((resolve) => {
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
  });
  reader.readAsDataURL(audioBlob);
  const base64Data = await base64Promise;

  const response = await ai.models.generateContent({
    model: MODELS.FLASH,
    contents: {
      parts: [
        { inlineData: { data: base64Data, mimeType: 'audio/wav' } },
        { text: "Transcribe this audio exactly. If it's empty or just noise, return an empty string." }
      ]
    }
  });

  return response.text || "";
}