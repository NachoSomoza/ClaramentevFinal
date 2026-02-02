
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { 
  Video, 
  Loader2, 
  Sparkles, 
  Volume2, 
  Play, 
  Pause, 
  AlertCircle, 
  Key,
  ExternalLink
} from 'lucide-react';
// Updated imports to match geminiService exports
import { generateVideoPrompt, generateSpeech, decode, decodeAudioData } from '../services/geminiService';

interface VideoNarradoProps {
  text: string;
}

export const VideoNarrado: React.FC<VideoNarradoProps> = ({ text }) => {
  const [status, setStatus] = useState<'IDLE' | 'CHECKING_KEY' | 'PROMPTING' | 'GENERATING' | 'READY' | 'ERROR'>('IDLE');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [generationPhase, setGenerationPhase] = useState<string>("Iniciando...");
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const startProcess = async () => {
    setStatus('CHECKING_KEY');
    setGenerationPhase("Verificando permisos mágicos...");
    try {
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      if (!hasKey) {
        await (window as any).aistudio.openSelectKey();
        // Rules say proceed assuming selection was successful
      }
      generateMagic();
    } catch (err) {
      console.error(err);
      setStatus('ERROR');
      setErrorMessage("No se pudo conectar con el sistema de video.");
    }
  };

  const generateMagic = async () => {
    setStatus('PROMPTING');
    setGenerationPhase("Escribiendo el guion de tu película...");
    try {
      const prompt = await generateVideoPrompt(text);
      setStatus('GENERATING');
      setGenerationPhase("El robot director está filmando las escenas...");

      // Fresh AI instance for updated key as per guidelines
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // Parallel Audio
      const audioTask = generateSpeech(text.substring(0, 800));

      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: '16:9'
        }
      });

      while (!operation.done) {
        const phases = ["Ajustando luces...", "Cargando efectos...", "Dibujando el cielo...", "Casi listo..."];
        setGenerationPhase(phases[Math.floor(Math.random() * phases.length)]);
        await new Promise(resolve => setTimeout(resolve, 8000));
        operation = await ai.operations.getVideosOperation({ operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (!downloadLink) throw new Error("No video returned");

      const videoRes = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
      if (videoRes.status === 404) {
         // Special handling for key mismatch as per guidelines
         await (window as any).aistudio.openSelectKey();
         throw new Error("Clave no encontrada. Por favor, selecciona una clave de un proyecto con facturación.");
      }
      
      const vUrl = URL.createObjectURL(await videoRes.blob());
      const base64Audio = await audioTask;
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      // Updated to use 'decode' instead of 'decodeBase64'
      const aBuffer = await decodeAudioData(decode(base64Audio), audioContextRef.current);

      setVideoUrl(vUrl);
      setAudioBuffer(aBuffer);
      setStatus('READY');
    } catch (err: any) {
      console.error(err);
      setStatus('ERROR');
      setErrorMessage(err.message || "¡Ups! Algo salió mal creando el video.");
    }
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      videoRef.current?.pause();
      audioSourceRef.current?.stop();
      setIsPlaying(false);
    } else {
      if (audioContextRef.current && audioBuffer) {
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => { setIsPlaying(false); videoRef.current?.pause(); };
        audioSourceRef.current = source;
        source.start();
        videoRef.current?.play();
        setIsPlaying(true);
      }
    }
  };

  if (status === 'IDLE') {
    return (
      <div className="max-w-3xl mx-auto py-20 text-center">
        <div className="w-32 h-32 bg-orange-100 rounded-[3rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
          <Video className="w-16 h-16 text-orange-600" />
        </div>
        <h2 className="text-4xl font-extrabold text-gray-800 mb-6">¿Vemos una película?</h2>
        <p className="text-lg text-gray-600 mb-10 max-w-lg mx-auto">
          Claramente puede crear un video mágico sobre tu historia. Recuerda que necesitas una cuenta de Google con facturación activa.
        </p>
        <button 
          onClick={startProcess}
          className="px-12 py-6 bg-orange-500 hover:bg-orange-600 text-white rounded-full text-2xl font-bold shadow-2xl transition-all transform hover:scale-105"
        >
          ¡Crear mi video!
        </button>
      </div>
    );
  }

  if (status === 'READY' && videoUrl) {
    return (
      <div className="max-w-4xl mx-auto py-10">
        <h2 className="text-3xl font-extrabold text-center mb-10">🎬 Tu Historia de Cine</h2>
        <div className="relative group rounded-[3rem] overflow-hidden shadow-2xl bg-black aspect-video flex items-center justify-center border-8 border-white">
          <video ref={videoRef} src={videoUrl} loop className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
            <button onClick={handleTogglePlay} className="w-24 h-24 bg-white/90 text-orange-600 rounded-full flex items-center justify-center shadow-2xl transform transition-all hover:scale-110">
              {isPlaying ? <Pause className="w-10 h-10 fill-current" /> : <Play className="w-10 h-10 fill-current ml-2" />}
            </button>
          </div>
        </div>
        <button onClick={() => setStatus('IDLE')} className="mt-12 mx-auto block px-10 py-4 border-2 border-gray-200 text-gray-600 font-bold rounded-full hover:bg-gray-50">Crear otro video</button>
      </div>
    );
  }

  if (status === 'ERROR') {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <AlertCircle className="w-20 h-20 text-red-500 mx-auto mb-6" />
        <h3 className="text-2xl font-bold mb-4">Error de Video</h3>
        <p className="text-gray-600 mb-8">{errorMessage}</p>
        <div className="flex justify-center gap-4">
          <button onClick={() => setStatus('IDLE')} className="px-8 py-3 bg-gray-100 rounded-full font-bold">Volver</button>
          <button onClick={startProcess} className="px-8 py-3 bg-orange-500 text-white rounded-full font-bold">Reintentar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-20 text-center">
      <div className="relative mb-12 flex justify-center">
        <div className="w-40 h-40 border-8 border-orange-100 border-t-orange-500 rounded-full animate-spin" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"><Sparkles className="w-12 h-12 text-orange-500 animate-pulse" /></div>
      </div>
      <h3 className="text-3xl font-extrabold text-gray-800 mb-6">{generationPhase}</h3>
      <p className="text-gray-400 italic">"Estamos usando mucha potencia para crear esto. Tardará unos segundos."</p>
    </div>
  );
};
