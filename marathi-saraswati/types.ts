

export enum Role {
  USER = 'user',
  MODEL = 'model',
}

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  AUDIO = 'audio',
  ERROR = 'error',
}

export interface GroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
}

export interface Message {
  id: string;
  role: Role;
  type: MessageType;
  content: string;
  timestamp: number;
  imageData?: string; // base64
  isThinking?: boolean;
  audioDuration?: number; // duration in seconds for sync
  groundingChunks?: GroundingChunk[]; // For citations
  mcqOptions?: string[]; // Array of MCQ options for complex questions
}

export interface NotebookEntry {
  id: string;
  title: string;
  date: string;
  summary: string;
}

export interface VisualState {
  type: 'graph' | 'image';
  content: string;
  timestamp: number;
  title?: string;
}

export interface AppState {
  messages: Message[];
  isRecording: boolean;
  isThinking: boolean;
  isConnectedToLive: boolean;
  inputMode: 'text' | 'audio';
  notebook: NotebookEntry[];
  isAudioPlaying: boolean;
  isAudioPaused: boolean;
  currentlyPlayingMessageId: string | null;
  estimatedWaitTime?: string;
}