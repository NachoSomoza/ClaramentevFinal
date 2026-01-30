
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ComicScene } from "../types";

/**
 * Instrucción base de seguridad para asegurar que el contenido sea apto para niños.
 */
const KID_SAFETY_PROMPT = "REGLA CRÍTICA DE SEGURIDAD: Eres una aplicación para niños. Si detectas contenido adulto, violento, inapropiado o dañino en el texto proporcionado o en la consulta del usuario, DEBES negarte educadamente a procesarlo y responder: '¡Lo siento! Este contenido no es apto para niños y mi magia solo funciona con historias amigables.'";

/**
 * Inicialización segura del cliente Gemini.
 */
export const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Implementación manual de decode para base64.
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
 * Implementación manual de encode para base64.
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
 * Decodificación de audio PCM crudo para Web Audio API.
 * Se corrigió el acceso al buffer para asegurar compatibilidad en móviles (iOS/Android).
 */
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  // Aseguramos que el buffer esté alineado correctamente para Int16Array
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

/**
 * EXTRAER TEXTO (OCR Inteligente) con filtro de seguridad.
 */
export async function extractTextFromMedia(base64Data: string, mimeType: string): Promise<string> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { data: base64Data, mimeType: mimeType } },
        { text: `${KID_SAFETY_PROMPT}\nExtrae todo el texto de esta imagen de forma literal. Si detectas contenido para adultos, detente.` }
      ]
    }
  });
  return response.text || "";
}

/**
 * GENERAR RESUMEN SIMPLE con filtro de seguridad.
 */
export async function generateSimpleSummary(text: string): Promise<string[]> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `${KID_SAFETY_PROMPT}\nResume este texto en 3 puntos clave muy fáciles para un niño. Responde solo JSON array de strings:\n\n${text}`,
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
    return ["No pude resumir esta historia."];
  }
}

/**
 * GENERAR PREGUNTAS SUGERIDAS con filtro de seguridad.
 */
export async function generateSuggestedQuestions(text: string): Promise<string[]> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `${KID_SAFETY_PROMPT}\nGenera 3 preguntas simples para un niño sobre este texto. Responde solo array JSON de strings:\n\n${text}`,
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
 * CHAT CON DOCUMENTO con filtro de seguridad.
 */
export async function chatWithDocument(text: string, userMessage: string) {
  const ai = getAI();
  const chat = ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: `${KID_SAFETY_PROMPT}\nEres Claramente, un tutor amigable para niños. Responde dudas sobre este texto de forma sencilla y divertida: "${text.substring(0, 3000)}"`,
    }
  });
  const result = await chat.sendMessage({ message: userMessage });
  return result.text || "¡Perdona! Me distraje un segundo.";
}

/**
 * GENERAR CÓMIC con filtro de seguridad.
 */
export async function generateComicScenes(text: string): Promise<ComicScene[]> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `${KID_SAFETY_PROMPT}\nDivide esta historia infantil en 4 escenas visuales. Texto: ${text}`,
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
 * GENERAR IMAGEN DE ESCENA.
 */
export async function generateSceneImage(scene: ComicScene): Promise<string> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [{ text: `Ilustración infantil mágica, estilo Pixar, colores vibrantes, amigable, SIN contenido adulto ni violento: ${scene.description}.` }]
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
 * GENERAR AUDIO (TTS).
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
 * GENERAR PROMPT DE VIDEO con filtro de seguridad.
 */
export async function generateVideoPrompt(text: string): Promise<string> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `${KID_SAFETY_PROMPT}\nCrea un prompt visual detallado para un video de historia infantil: ${text.substring(0, 1000)}. Responde solo en inglés.`,
  });
  return response.text || "A happy children's story scene.";
}
