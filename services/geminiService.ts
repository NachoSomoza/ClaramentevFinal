
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ComicScene } from "../types";

/**
 * // Use a function to get a fresh instance as per guidelines for key selection
 * Inicialización segura del cliente Gemini.
 * La API KEY se obtiene del entorno de ejecución automáticamente.
 */
export const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * // Manual implementation of decode as per instructions
 */
export function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * // Manual implementation of encode as per instructions
 */
export function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * // Audio decoding following coding guidelines for raw PCM streams
 */
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
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

/**
 * EXTRAER TEXTO (OCR Inteligente)
 */
export async function extractTextFromMedia(base64Data: string, mimeType: string): Promise<string> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { data: base64Data, mimeType: mimeType } },
        { text: "Extrae todo el texto de esta imagen de forma literal. Si es un cuento, mantén los diálogos y párrafos. Responde solo con el texto." }
      ]
    }
  });
  return response.text || "";
}

/**
 * GENERAR RESUMEN SIMPLE
 */
export async function generateSimpleSummary(text: string): Promise<string[]> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Resume este texto en 3 puntos clave muy fáciles de entender para un niño. Responde solo con el JSON de un array de strings:\n\n${text}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });
  try {
    return JSON.parse(response.text || "[]");
  } catch {
    return [];
  }
}

/**
 * GENERAR PREGUNTAS SUGERIDAS
 */
export async function generateSuggestedQuestions(text: string): Promise<string[]> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Genera 3 preguntas simples que un niño podría tener sobre este texto. Responde solo con un array JSON de strings:\n\n${text}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });
  try {
    return JSON.parse(response.text || "[]");
  } catch {
    return [];
  }
}

/**
 * CHAT CON DOCUMENTO
 */
export async function chatWithDocument(text: string, userMessage: string) {
  const ai = getAI();
  const chat = ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: `Eres Claramente, un tutor amigable. Responde dudas sobre este texto de forma sencilla y divertida: "${text.substring(0, 3000)}"`,
    }
  });
  const result = await chat.sendMessage({ message: userMessage });
  return result.text || "¡Perdona! Me distraje un segundo. ¿Me repites?";
}

/**
 * GENERAR CÓMIC (Escenas e Imágenes)
 */
export async function generateComicScenes(text: string): Promise<ComicScene[]> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Divide esta historia en 4 escenas visuales para un cómic. Describe cada una brevemente.\n\nTexto: ${text}`,
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
  try {
    return JSON.parse(response.text || "[]");
  } catch {
    return [];
  }
}

/**
 * // Renamed to match ComicMode usage
 */
export async function generateSceneImage(scene: ComicScene): Promise<string> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [{ text: `Ilustración infantil mágica, estilo Pixar, colores vibrantes, amigable: ${scene.description}. Keywords: ${scene.keywords?.join(", ")}` }]
    },
    config: { imageConfig: { aspectRatio: "1:1" } }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return "";
}

/**
 * GENERAR AUDIO (TTS)
 */
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

/**
 * // Generate a detailed prompt for Video generation
 */
export async function generateVideoPrompt(text: string): Promise<string> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Crea un prompt visual detallado para generar un video de 16:9 basado en esta historia para niños: ${text.substring(0, 1000)}. Enfócate en el estilo visual mágico y amigable. Responde solo con el prompt en inglés.`,
  });
  return response.text || "A magical story scene for children, colorful animation style.";
}
