
import { Type } from "@google/genai";

export type UserMode = 'text' | 'live';

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
  maps?: {
    uri: string;
    title: string;
    placeAnswerSources?: {
        reviewSnippets?: {
            content: string;
        }[]
    }[]
  };
}

export interface GroundingMetadata {
  groundingChunks?: GroundingChunk[];
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string; // The text optimized for display (MCQ stripped)
  rawText?: string; // The full raw text from the model (including MCQ markdown, pre-audio cleaning)
  image?: string; // Base64 string for input images
  groundingMetadata?: GroundingMetadata;
  mcq?: { // New property for Multiple Choice Questions
    question: string;
    options: { label: string; text: string }[];
    selectedOption?: string; // To track user's choice
    correctAnswer?: string; // Optional, if model reveals
    mcqActivationCharIndex?: number; // New: character index in the *audio-playable* text where the MCQ should visually appear
  };
  timestamp: number;
  audio?: ArrayBuffer; // Raw PCM or Encoded Audio
  audioDuration?: number; // Duration in seconds
  
  // Interruption Handling
  interrupted?: boolean; // Was this message interrupted by the user?
  audioPlayedPercentage?: number; // How much of the audio was played before interruption (0-1)
}

export interface HistoryItem {
  id: string;
  title: string;
  date: string;
}

export interface LiveConnectionState {
  isConnected: boolean;
  isSpeaking: boolean;
  volume: number;
}

// Helper Enums
export enum Models {
  FLASH = 'gemini-3-flash-preview',
  FLASH_LITE = 'gemini-2.5-flash-lite',
  FLASH_2_5 = 'gemini-2.5-flash',
  PRO = 'gemini-3-flash-preview',
  PRO_IMAGE = 'gemini-3-pro-image-preview',
  FLASH_IMAGE = 'gemini-2.5-flash-image',
  TTS = 'gemini-2.5-flash-preview-tts',
  LIVE = 'gemini-2.5-flash-native-audio-preview-09-2025'
}

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    aistudio?: AIStudio;
    webkitAudioContext?: typeof AudioContext;
  }
}
