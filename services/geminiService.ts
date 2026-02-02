
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ComicScene } from "../types";

const KID_SAFETY_PROMPT = `
REGLA CRÍTICA DE SEGURIDAD: Eres un asistente para niños pequeños (6-10 años).
1. Si el texto contiene: violencia explícita, contenido sexual, lenguaje adulto, temas de terror intenso, DEBES detenerte.
2. Tu respuesta DEBE ser siempre: "¡Ups! Este contenido no es apto para niños. Mi magia solo funciona con historias bonitas y seguras."
3. Actúa como un compañero mágico.
`;

export const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// Instancia única de AudioContext
let globalAudioContext: AudioContext | null = null;

export const getSharedAudioContext = () => {
  if (!globalAudioContext) {
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    globalAudioContext = new AudioContextClass({ sampleRate: 24000 });
  }
  return globalAudioContext;
};

/**
 * Función crítica para iPhone: Debe llamarse dentro de un evento de click síncrono.
 */
export const unlockAudioForiOS = async () => {
  const ctx = getSharedAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  // Generar un micro-silencio para confirmar la activación
  const buffer = ctx.createBuffer(1, 1, 22050);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(0);
  return ctx;
};

// base64 decoding helper for PCM audio data as required by Gemini Live API guidelines
export function decode(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// base64 encoding helper for PCM audio data as required by Gemini Live API guidelines
export function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Manual PCM audio decoding as required for streaming audio output from Gemini models
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

export async function extractTextFromMedia(base64Data: string, mimeType: string): Promise<string> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { data: base64Data, mimeType: mimeType } },
        { text: `TAREA: Transcripción LITERAL completa.
        Extrae TODO el texto contenido en este archivo adjunto palabra por palabra.
        
        REGLAS DE ORO:
        1. NO RESUMAS la historia.
        2. NO SIMPLIFIQUES el lenguaje ni las palabras difíciles.
        3. NO OMITAS párrafos ni diálogos.
        4. Necesito el texto EXACTO tal como aparece en el documento para una lectura adaptativa.
        5. MANTÉN la estructura original de los párrafos.
        
        Si el contenido es violento o no apto para niños según tus filtros de seguridad, detente. De lo contrario, dame el contenido INTEGRO del archivo.` }
      ]
    }
  });
  const result = response.text || "";
  if (result.includes("no es apto para niños")) throw new Error(result);
  return result;
}

export async function generateSimpleSummary(text: string): Promise<string[]> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `${KID_SAFETY_PROMPT}\nResume en 3 puntos para niños. Solo JSON array:\n\n${text}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });
  try { return JSON.parse(response.text || "[]"); } catch { return ["¡Leamos juntos!"]; }
}

export async function generateSuggestedQuestions(text: string): Promise<string[]> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `${KID_SAFETY_PROMPT}\n3 preguntas cortas para niños. Solo JSON array:\n\n${text}`,
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

export async function chatWithDocument(text: string, userMessage: string) {
  const ai = getAI();
  const chat = ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: `${KID_SAFETY_PROMPT}\nResponde amigablemente sobre: "${text.substring(0, 2000)}"`,
    }
  });
  const result = await chat.sendMessage({ message: userMessage });
  return result.text || "¡Ups!";
}

export async function generateComicScenes(text: string): Promise<ComicScene[]> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `${KID_SAFETY_PROMPT}\nCrea 4 escenas de cómic infantil. Solo JSON array de objetos {description, keywords}:\n\n${text}`,
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

export async function generateSpeech(text: string): Promise<string> {
  const ai = getAI();
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

export async function generateVideoPrompt(text: string): Promise<string> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `${KID_SAFETY_PROMPT}\nPrompt de video infantil (inglés). Solo texto:\n\n${text.substring(0, 500)}`,
  });
  return response.text || "A magical forest.";
}
