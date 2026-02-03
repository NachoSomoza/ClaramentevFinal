import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ComicScene, Language } from "../types";

const getSafetyPrompt = (lang: Language) => {
  const messages = {
    es: "¡Ups! Este contenido no es apto para niños. Mi magia solo funciona con historias bonitas y seguras.",
    en: "Oops! This content is not suitable for children. My magic only works with nice and safe stories.",
    pt: "Ops! Este conteúdo não é adequado para crianças. Minha magia só funciona com histórias bonitas e seguras.",
    de: "Ups! Dieser Inhalt ist nicht für Kinder geeignet. Meine Magie funktioniert nur mit schönen und sicheren Geschichten."
  };
  
  return `
REGLA CRÍTICA DE SEGURIDAD: Eres un asistente para niños pequeños (6-10 años).
1. Si el texto contiene: violencia explícita, contenido sexual, lenguaje adulto, temas de terror intenso, DEBES detenerte.
2. Tu respuesta DEBE ser siempre: "${messages[lang]}"
3. Actúa como un compañero mágico.
4. MUY IMPORTANTE: Responde SIEMPRE en el idioma: ${lang === 'es' ? 'Español' : lang === 'en' ? 'English' : lang === 'pt' ? 'Português' : 'Deutsch'}.
`;
};

export const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

let globalAudioContext: AudioContext | null = null;

export const getSharedAudioContext = () => {
  if (!globalAudioContext) {
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    globalAudioContext = new AudioContextClass({ sampleRate: 24000 });
  }
  return globalAudioContext;
};

export const unlockAudioForiOS = async () => {
  const ctx = getSharedAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  const buffer = ctx.createBuffer(1, 1, 22050);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(0);
  return ctx;
};

export function decode(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  const dataInt16 = new Int16Array(arrayBuffer);
  const frameCount = dataInt16.length / numChannels;
  
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export async function extractTextFromMedia(base64Data: string, mimeType: string, lang: Language): Promise<string> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { data: base64Data, mimeType: mimeType } },
        { text: `TASK: Literal transcription. 
        Language: ${lang}.
        Extract all text word-for-word. Keep structure. No summarizing.` }
      ]
    }
  });
  return response.text || "";
}

export async function generateSimpleSummary(text: string, lang: Language): Promise<string[]> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `${getSafetyPrompt(lang)}\nSummarize in 3 bullet points for kids in language ${lang}. Only JSON array:\n\n${text}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });
  try { return JSON.parse(response.text || "[]"); } catch { return ["..."]; }
}

export async function generateSuggestedQuestions(text: string, lang: Language): Promise<string[]> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `${getSafetyPrompt(lang)}\n3 short questions for kids about this text in language ${lang}. Only JSON array:\n\n${text}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });
  try { return JSON.parse(response.text || "[]"); } catch { return []; }
}

export async function chatWithDocument(text: string, userMessage: string, lang: Language) {
  const ai = getAI();
  const chat = ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: `${getSafetyPrompt(lang)}\nFriendly response about: "${text.substring(0, 1500)}"`,
    }
  });
  const result = await chat.sendMessage({ message: userMessage });
  return result.text || "!";
}

export async function generateComicScenes(text: string, lang: Language): Promise<ComicScene[]> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `${getSafetyPrompt(lang)}\nCreate 4 comic scenes for kids about this text. Descriptions in language ${lang}. Only JSON array of objects {description, keywords}:\n\n${text}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            keywords: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["description", "keywords"]
        }
      }
    }
  });
  try { return JSON.parse(response.text || "[]"); } catch { return []; }
}

export async function generateSceneImage(scene: ComicScene): Promise<string> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [{ text: `Children story illustration, Pixar style, friendly, colorful: ${scene.description}.` }]
    },
    config: { imageConfig: { aspectRatio: "1:1" } }
  });
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  }
  return "";
}

export async function generateSpeech(text: string, lang: Language): Promise<string> {
  const ai = getAI();
  // Using generic voice 'Kore' as it's multilingual-friendly or defaults reasonably
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
      }
    }
  });
  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
}

export async function generateVideoPrompt(text: string, lang: Language): Promise<string> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `${getSafetyPrompt(lang)}\nGenerate an English video generation prompt based on this text: ${text.substring(0, 500)}`,
  });
  return response.text || "Magical forest animation.";
}