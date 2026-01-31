
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ComicScene } from "../types";

const KID_SAFETY_PROMPT = `
REGLA CRÍTICA DE SEGURIDAD: Eres un asistente para niños pequeños (6-10 años).
1. Si el texto contiene: violencia explícita, contenido sexual, lenguaje adulto, drogas o temas de terror intenso, DEBES detenerte.
2. Tu respuesta DEBE ser siempre: "¡Ups! Este contenido no es apto para niños. Mi magia solo funciona con historias bonitas y seguras."
3. No menciones que eres una IA, actúa como un compañero mágico.
`;

export const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

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
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decodificación optimizada.
 * Se asegura de que el contexto de audio esté listo y maneja el buffer de forma más eficiente.
 */
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
        { text: `${KID_SAFETY_PROMPT}\nExtrae el texto. Si es inapropiado para niños, aplica la regla de seguridad.` }
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
  try {
    return JSON.parse(response.text || "[]");
  } catch {
    return ["Esta historia es genial, ¡leamos los detalles!"];
  }
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
  try {
    return JSON.parse(response.text || "[]");
  } catch { return []; }
}

export async function chatWithDocument(text: string, userMessage: string) {
  const ai = getAI();
  const chat = ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: `${KID_SAFETY_PROMPT}\nResponde amigablemente sobre este texto infantil: "${text.substring(0, 2000)}"`,
    }
  });
  const result = await chat.sendMessage({ message: userMessage });
  return result.text || "¡Ups! Me distraje un poquito.";
}

export async function generateComicScenes(text: string): Promise<ComicScene[]> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `${KID_SAFETY_PROMPT}\nCrea 4 escenas para un cómic infantil. Solo JSON array de objetos {description, keywords}:\n\n${text}`,
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
  } catch { return []; }
}

export async function generateSceneImage(scene: ComicScene): Promise<string> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [{ text: `Digital art for children, Pixar style, friendly, bright colors, NO violence, NO adult content: ${scene.description}.` }]
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
  return response.text || "A beautiful magical forest for children.";
}
