// Web version of geminiServiceQuick - uses proxy
import { MODELS, SYSTEM_INSTRUCTION_QUICK as SYSTEM_INSTRUCTION } from "../constants";
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
  if (taskType === 'math') return "Upto 30 seconds";
  return "~3-5 seconds";
};

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
      generation_config: { max_output_tokens: 10000 },
    });

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const groundingChunks = data.candidates?.[0]?.groundingMetadata?.groundingChunks;
    return { text, groundingChunks };
  } catch (error) {
    console.error("Gemini Quick Error:", error);
    throw error;
  }
};
