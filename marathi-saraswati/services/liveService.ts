import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { MODELS, SYSTEM_INSTRUCTION } from "../constants";

interface LiveCallbacks {
  onAudioData: (base64: string) => void;
  onTranscript: (text: string, type: 'user' | 'model') => void;
  onClose: () => void;
}

export class LiveManager {
  private client: GoogleGenAI;
  private session: any = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private nextStartTime: number = 0;
  private callbacks: LiveCallbacks;
  private outputNode: GainNode | null = null;
  private audioSources: Set<AudioBufferSourceNode> = new Set(); // Track all playing sources

  constructor(callbacks: LiveCallbacks) {
    this.client = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
    this.callbacks = callbacks;
  }

  async connect() {
    this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    this.outputNode = this.outputAudioContext.createGain();
    this.outputNode.connect(this.outputAudioContext.destination);

    // Ensure audio context is resumed before starting stream if it was suspended
    if (this.inputAudioContext.state === 'suspended') await this.inputAudioContext.resume();
    if (this.outputAudioContext.state === 'suspended') await this.outputAudioContext.resume();

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const sessionPromise = this.client.live.connect({
      model: MODELS.LIVE,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: SYSTEM_INSTRUCTION,
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
        },
      },
      callbacks: {
        onopen: () => {
          console.log("Live Session Opened");
          this.startAudioStreaming(sessionPromise);
        },
        onmessage: async (msg: LiveServerMessage) => {
          // Handle interruptions first
          if (msg.serverContent?.interrupted) {
            console.log("Live Session Interrupted. Clearing audio queue.");
            this.stopAllAudioSources();
            this.nextStartTime = 0; // Reset playback cursor
          }

          // Handle Audio Output
          const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (audioData) {
            this.playAudioChunk(audioData);
          }
          
          // Handle Transcription (if available, though usually needs explicit config)
           if (msg.serverContent?.modelTurn?.parts?.[0]?.text) {
              this.callbacks.onTranscript(msg.serverContent.modelTurn.parts[0].text, 'model');
           }
        },
        onclose: () => {
          console.log("Live Session Closed");
          this.stopAllAudioSources();
          this.callbacks.onClose();
        },
        onerror: (err) => {
          console.error("Live Session Error", err);
          this.stopAllAudioSources();
          this.callbacks.onClose();
        }
      }
    });
    
    // Wait for connection
    this.session = await sessionPromise;
  }

  private startAudioStreaming(sessionPromise: Promise<any>) {
    if (!this.inputAudioContext || !this.stream) return;

    this.source = this.inputAudioContext.createMediaStreamSource(this.stream);
    // Use the older ScriptProcessorNode as it's more widely supported for direct PCM streaming than AudioWorklet
    this.processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1); 

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBlob = this.createBlob(inputData);
      
      sessionPromise.then(session => {
          session.sendRealtimeInput({ media: pcmBlob });
      });
    };

    this.source.connect(this.processor);
    this.processor.connect(this.inputAudioContext.destination);
  }

  private createBlob(data: Float32Array) {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768;
    }
    
    // Base64 encoding for payload
    let binary = '';
    const bytes = new Uint8Array(int16.buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const b64 = btoa(binary);

    return {
      mimeType: 'audio/pcm;rate=16000',
      data: b64
    };
  }

  private async playAudioChunk(base64: string) {
    if (!this.outputAudioContext || !this.outputNode) return;

    // Decode base64
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // PCM to AudioBuffer
    const dataInt16 = new Int16Array(bytes.buffer);
    const buffer = this.outputAudioContext.createBuffer(1, dataInt16.length, 24000);
    const channelData = buffer.getChannelData(0);
    for(let i=0; i<dataInt16.length; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
    }

    const source = this.outputAudioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.outputNode);
    
    // Track source
    this.audioSources.add(source);
    source.onended = () => {
      this.audioSources.delete(source);
    };

    // Schedule
    this.nextStartTime = Math.max(this.outputAudioContext.currentTime, this.nextStartTime);
    source.start(this.nextStartTime);
    this.nextStartTime += buffer.duration;
  }

  private stopAllAudioSources() {
    for (const source of this.audioSources) {
      try {
        source.stop();
      } catch (e) {
        console.warn("Error stopping audio source:", e);
      }
    }
    this.audioSources.clear();
  }

  disconnect() {
    this.stopAllAudioSources();
    this.source?.disconnect();
    this.processor?.disconnect();
    this.stream?.getTracks().forEach(track => track.stop());
    
    try {
        this.inputAudioContext?.close();
        this.outputAudioContext?.close();
    } catch (e) {
        console.warn("Error closing audio contexts:", e);
    }

    this.inputAudioContext = null;
    this.outputAudioContext = null;
    this.processor = null;
    this.source = null;
    this.session = null;
    this.nextStartTime = 0;
  }
}