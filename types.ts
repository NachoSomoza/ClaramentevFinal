export type Language = 'es' | 'en' | 'pt' | 'de';

export type AppMode = 'UPLOAD' | 'SELECTION' | 'READER' | 'EXPLAIN' | 'COMIC' | 'VIDEO';

export interface AppState {
  text: string;
  originalFileName?: string;
  isProcessing: boolean;
  error?: string;
  mode: AppMode;
  language: Language;
}

export interface ReaderSettings {
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  fontFamily: 'standard' | 'dyslexic' | 'rounded';
  theme: 'light' | 'dark' | 'sepia' | 'contrast';
}

export interface ComicScene {
  description: string;
  imageUrl?: string;
  keywords: string[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}