import { Modality } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";
import { Models, Message } from "../types";

const ELEVEN_LABS_VOICE_ID = '';

const MCQ_EXTRACT_REGEX = /QUESTION_START\s*([\s\S]*?)\s*OPTIONS_START\s*([\s\S]*?)\s*OPTIONS_END\s*QUESTION_END/i;
const MCQ_BLOCK_REGEX = /QUESTION_START[\s\S]*?QUESTION_END/gi;
const THOUGHT_BLOCK_REGEX = /^(thought|thinking):?\s*[\s\S]*?(\n\n|(?=\n[A-Z][a-z])|$)/i;
const THOUGHT_TAG_REGEX = /<(thought|thinking)>[\s\S]*?<\/\1>/gi;
const SYSTEM_PROMPT_LABELS_REGEX = /^(Role|Accent\/Tone|Language|Context|Vibe|IB Curriculum|IB Learner|Goal|Structure|STRICT LANGUAGE RULE):?.*$/gim;

// Proxy helper
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
    return text
      .replace(THOUGHT_BLOCK_REGEX, '')
      .replace(THOUGHT_TAG_REGEX, '')
      .replace(SYSTEM_PROMPT_LABELS_REGEX, '')
      .trim();
  }

  public static cleanTextForAudio(rawText: string): string {
    let workingText = SaraswatiService.stripThought(rawText);
    let mcqQuestionExtracted: string | null = null;
    let preMcqTextForDuplicateCheck = '';
    const mcqMatch = workingText.match(MCQ_EXTRACT_REGEX);
    if (mcqMatch) {
        const fullMcqBlock = mcqMatch[0];
        mcqQuestionExtracted = mcqMatch[1].trim();
        preMcqTextForDuplicateCheck = workingText.substring(0, mcqMatch.index || 0);
        workingText = workingText.replace(fullMcqBlock, mcqQuestionExtracted);
    }
    let cleanedText = workingText
        .replace(/\$\$/g, '').replace(/\$/g, '')
        .replace(new RegExp('\\*\\*(.*?)\\*\\*', 'g'), '$1')
        .replace(new RegExp('\\*(.*?)\\*', 'g'), '$1')
        .replace(new RegExp('__(.*?)__', 'g'), '$1')
        .replace(new RegExp('_(.*?)_', 'g'), '$1')
        .replace(/##\s*/g, '').replace(/###\s*/g, '')
        .replace(/-\s*/g, '').replace(/\*\s*/g, '')
        .replace(/\d+\.\s*/g, '').replace(/---/g, '')
        .replace(/\\/g, ' ')
        .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1 over $2')
        .replace(/\\times/g, ' times ').replace(/\\cdot/g, ' times ')
        .replace(/=/g, ' equals ').replace(/\^2/g, ' squared')
        .replace(/\^3/g, ' cubed').replace(/\^/g, ' to the power of ')
        .replace(/\\rightarrow/g, ' gives ').replace(/\\Delta/g, ' change in ')
        .replace(/\\approx/g, ' approximately ').replace(/\\circ/g, ' degrees ')
        .replace(/_/g, ' sub ').replace(/\{/g, '').replace(/\}/g, '')
        .replace(/Bold Yellow:/gi, '').replace(/highlighted in yellow/gi, '')
        .replace(/([.,?!])(\S)/g, '$1 $2')
        .replace(/\s+/g, ' ').trim();
    if (mcqQuestionExtracted && preMcqTextForDuplicateCheck.trim()) {
        const cleanedPreMcqText = SaraswatiService.cleanTextForAudio(preMcqTextForDuplicateCheck);
        const escapedQuestion = mcqQuestionExtracted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const duplicateQuestionRegex = new RegExp(`(${escapedQuestion})\\s*$`, 'i');
        if (cleanedPreMcqText.match(duplicateQuestionRegex)) {
             const cleanedPreMcqTextWithoutDuplicate = cleanedPreMcqText.replace(duplicateQuestionRegex, '');
             cleanedText = cleanedText.replace(cleanedPreMcqText, cleanedPreMcqTextWithoutDuplicate);
        }
    }
    return cleanedText.trim();
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
        if (preText.match(duplicateRegex)) {
             cleanedPreText = preText.replace(duplicateRegex, '').trimEnd();
        }
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
    if (!promptText && imageBase664) {
        promptText = "Analyze this image. If it shows a scientific concept, explain it step-by-step as Saraswati. If not science-related, acknowledge it briefly and steer back to Science.";
    }
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
        generation_config: { max_output_tokens: 10000, thinking_config: { thinking_budget: 4000 } }
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

  static async textToSpeech(text: string): Promise<ArrayBuffer | null> {
    const cleanText = SaraswatiService.cleanTextForAudio(text);
    if (!cleanText || cleanText.trim() === '') return null;

    const maxRetries = 5;
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            const response = await callProxy(Models.TTS, {
                contents: [{ parts: [{ text: `Say this in a warm, motherly Indian Hinglish accent (Latin script): ${cleanText}` }] }],
                generation_config: {
                    response_modalities: ['AUDIO'],
                    speech_config: { voice_config: { prebuilt_voice_config: { voice_name: 'Kore' } } }
                }
            });
            const candidate = response.candidates?.[0];
            if (!candidate) throw new Error('No candidates');
            if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'BLOCKLIST') return null;
            const parts = candidate.content?.parts || [];
            for (const part of parts) {
                const base64Audio = part.inlineData?.data || part.inline_data?.data;
                if (base64Audio) {
                    let clean = base64Audio.replace(/\s/g, '');
                    while (clean.length % 4 !== 0) clean += '=';
                    const binary = atob(clean);
                    const bytes = new Uint8Array(binary.length);
                    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                    if (bytes.length > 4) {
                        const header = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
                        if (header === 'RIFF' || header === 'ID3' || (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0)) return bytes.buffer;
                    }
                    return this.addWavHeader(bytes, 24000, 1, 16);
                }
            }
            throw new Error('No audio data in response');
        } catch (e) {
            attempt++;
            if (attempt >= maxRetries) return null;
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
        }
    }
    return null;
  }

  private static addWavHeader(pcmData: Uint8Array, sampleRate: number, numChannels: number = 1, bitDepth: number = 16): ArrayBuffer {
    const header = new ArrayBuffer(44);
    const view = new DataView(header);
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + pcmData.length, true);
    this.writeString(view, 8, 'WAVE');
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
    view.setUint16(32, numChannels * (bitDepth / 8), true);
    view.setUint16(34, bitDepth, true);
    this.writeString(view, 36, 'data');
    view.setUint32(40, pcmData.length, true);
    const wavBuffer = new Uint8Array(header.byteLength + pcmData.byteLength);
    wavBuffer.set(new Uint8Array(header), 0);
    wavBuffer.set(pcmData, header.byteLength);
    return wavBuffer.buffer;
  }

  private static writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
  }
}
