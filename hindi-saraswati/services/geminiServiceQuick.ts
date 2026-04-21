import { ThinkingLevel } from "@google/genai";
import { SYSTEM_INSTRUCTION_QUICK as SYSTEM_INSTRUCTION } from "../constants";
import { Models, Message } from "../types";

const MCQ_EXTRACT_REGEX = /QUESTION_START\s*([\s\S]*?)\s*OPTIONS_START\s*([\s\S]*?)\s*OPTIONS_END\s*QUESTION_END/i;
const MCQ_BLOCK_REGEX = /QUESTION_START[\s\S]*?QUESTION_END/gi;
const THOUGHT_BLOCK_REGEX = /^(thought|thinking):?\s*[\s\S]*?(\n\n|(?=\n[A-Z][a-z])|$)/i;
const THOUGHT_TAG_REGEX = /<(thought|thinking)>[\s\S]*?<\/\1>/gi;
const SYSTEM_PROMPT_LABELS_REGEX = /^(Role|Accent\/Tone|Language|Context|Vibe|IB Curriculum|IB Learner|Goal|Structure|STRICT LANGUAGE RULE):?.*$/gim;

const PROXY_URL = 'https://geminiproxy-ljtntzc7pq-el.a.run.app';
async function callProxy(model: string, body: object): Promise<any> {
  const response = await fetch(`${PROXY_URL}?model=${encodeURIComponent(model)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Referer': 'https://hindi-saraswati.uttarai.in/' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Proxy error: ${response.status}`);
  return response.json();
}

export class SaraswatiService {

  public static stripThought(text: string): string {
    return text.replace(THOUGHT_BLOCK_REGEX, '').replace(THOUGHT_TAG_REGEX, '').replace(SYSTEM_PROMPT_LABELS_REGEX, '').trim();
  }

  public static cleanTextForDisplay(rawText: string): string {
    let workingText = SaraswatiService.stripThought(rawText);
    const mcqMatch = workingText.match(MCQ_EXTRACT_REGEX);
    if (mcqMatch) {
        const fullBlock = mcqMatch[0];
        const question = mcqMatch[1].trim();
        const matchIndex = mcqMatch.index!;
        const preText = workingText.substring(0, matchIndex);
        const postText = workingText.substring(matchIndex + fullBlock.length);
        const escapedQuestion = question.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const duplicateRegex = new RegExp(`(${escapedQuestion})\\s*$`, 'i');
        let cleanedPreText = preText;
        if (preText.match(duplicateRegex)) cleanedPreText = preText.replace(duplicateRegex, '').trimEnd();
        workingText = cleanedPreText + postText;
    } else {
        workingText = workingText.replace(MCQ_BLOCK_REGEX, '');
    }
    const partialMcqIndex = workingText.indexOf('QUESTION_START');
    if (partialMcqIndex !== -1) workingText = workingText.substring(0, partialMcqIndex);
    return workingText.trim();
  }

  static async sendMessage(text: string, history: Message[], imageBase664?: string, onChunk?: (text: string) => void): Promise<{
    text: string; rawText: string; groundingMetadata?: any; mcq?: Message['mcq'];
  }> {
    let promptText = text.trim();
    if (!promptText && imageBase664) promptText = "Analyze this image and explain any science concept shown.";
    const contents: any[] = history.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.rawText || msg.text }]
    }));
    const currentParts: any[] = [];
    if (imageBase664) currentParts.push({ inlineData: { mimeType: 'image/jpeg', data: imageBase664 } });
    currentParts.push({ text: promptText });
    contents.push({ role: 'user', parts: currentParts });

    let combinedText = "";
    let mcqForDisplay: Message['mcq'] | undefined = undefined;
    let groundingMetadata: any = undefined;

    try {
      const proxyData = await callProxy(Models.FLASH, {
        system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents,
        tools: [{ google_search: {} }],
        generation_config: { max_output_tokens: 10000 }
      });
      combinedText = (proxyData.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('');
      groundingMetadata = proxyData.candidates?.[0]?.groundingMetadata;
      if (onChunk) onChunk(SaraswatiService.cleanTextForDisplay(combinedText));
    } catch (e: any) {
      throw e;
    }

    const mcqMatch = combinedText.match(MCQ_EXTRACT_REGEX);
    if (mcqMatch) {
        const questionText = mcqMatch[1].trim();
        const optionsText = mcqMatch[2].trim();
        const options = optionsText.split('\n').map(line => {
            const labelMatch = line.match(/^([A-D])\)\s*(.*)/);
            if (labelMatch) return { label: labelMatch[1], text: labelMatch[2].trim() };
            return { label: '', text: line.trim() };
        }).filter(option => option.label !== '');
        if (questionText && options.length === 4) {
            const matchEndIndex = mcqMatch.index! + mcqMatch[0].length;
            if (matchEndIndex < combinedText.length) combinedText = combinedText.substring(0, matchEndIndex);
            mcqForDisplay = { question: questionText, options };
            const textBeforeMcqRaw = combinedText.substring(0, mcqMatch.index!);
            const escapedQuestion = questionText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const duplicateRegex = new RegExp(`(${escapedQuestion})\\s*$`, 'i');
            let textBeforeMcqDeduped = textBeforeMcqRaw;
            if (textBeforeMcqRaw.match(duplicateRegex)) textBeforeMcqDeduped = textBeforeMcqRaw.replace(duplicateRegex, '').trimEnd();
            const cleanedForLengthCalc = SaraswatiService.cleanTextForDisplay(textBeforeMcqDeduped);
            mcqForDisplay.mcqActivationCharIndex = cleanedForLengthCalc.length;
        }
    }
    const finalResponseTextForDisplay = SaraswatiService.cleanTextForDisplay(combinedText);
    return { text: finalResponseTextForDisplay, rawText: combinedText, groundingMetadata, mcq: mcqForDisplay };
  }
}
