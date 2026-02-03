import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { 
  Video, 
  Loader2, 
  Sparkles, 
  Play, 
  Pause, 
  AlertCircle
} from 'lucide-react';
import { generateVideoPrompt, generateSpeech, decode, decodeAudioData } from '../services/geminiService';
import { Language } from '../types';
import { TRANSLATIONS } from '../translations';

interface VideoNarradoProps {
  text: string;
  language: Language;
}

export const VideoNarrado: React.FC<VideoNarradoProps> = ({ text, language }) => {
  const [status, setStatus] = useState<'IDLE' | 'CHECKING_KEY' | 'PROMPTING' | 'GENERATING' | 'READY' | 'ERROR'>('IDLE');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [generationPhase, setGenerationPhase] = useState<string>("...");
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const t = TRANSLATIONS[language];

  const startProcess = async () => {
    setStatus('CHECKING_KEY');
    setGenerationPhase("...");
    try {
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      if (!hasKey) {
        await (window as any).aistudio.openSelectKey();
      }
      generateMagic();
    } catch (err) {
      setStatus('ERROR');
      setErrorMessage("API Error.");
    }
  };

  const generateMagic = async () => {
    setStatus('PROMPTING');
    setGenerationPhase("...");
    try {
      const prompt = await generateVideoPrompt(text, language);
      setStatus('GENERATING');
      setGenerationPhase(t.drawingComic);

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const audioTask = generateSpeech(text.substring(0, 500), language);

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
        await new Promise(resolve => setTimeout(resolve, 8000));
        operation = await ai.operations.getVideosOperation({ operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (!downloadLink) throw new Error("Video fail");

      const videoRes = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
      const vUrl = URL.createObjectURL(await videoRes.blob());
      const base64Audio = await audioTask;
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const aBuffer = await decodeAudioData(decode(base64Audio), audioContextRef.current);

      setVideoUrl(vUrl);
      setAudioBuffer(aBuffer);
      setStatus('READY');
    } catch (err: any) {
      setStatus('ERROR');
      setErrorMessage(err.message || "Error.");
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
        <Video className="w-16 h-16 text-orange-600 mx-auto mb-8" />
        <h2 className="text-4xl font-extrabold text-gray-800 mb-6">{t.video ? t.video.title : "Video"}</h2>
        <button 
          onClick={startProcess}
          className="px-12 py-6 bg-orange-500 text-white rounded-full text-2xl font-bold shadow-2xl transition-all active:scale-95"
        >
          {t.start}
        </button>
      </div>
    );
  }

  if (status === 'READY' && videoUrl) {
    return (
      <div className="max-w-4xl mx-auto py-10">
        <div className="relative rounded-[3rem] overflow-hidden shadow-2xl bg-black aspect-video flex items-center justify-center">
          <video ref={videoRef} src={videoUrl} loop className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
            <button onClick={handleTogglePlay} className="w-24 h-24 bg-white/90 text-orange-600 rounded-full flex items-center justify-center shadow-2xl">
              {isPlaying ? <Pause className="w-10 h-10 fill-current" /> : <Play className="w-10 h-10 fill-current ml-2" />}
            </button>
          </div>
        </div>
        <button onClick={() => setStatus('IDLE')} className="mt-12 mx-auto block px-10 py-4 border-2 border-gray-200 text-gray-600 font-bold rounded-full">{t.loadAnother}</button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-20 text-center">
      <div className="relative mb-12 flex justify-center">
        <div className="w-40 h-40 border-8 border-orange-100 border-t-orange-500 rounded-full animate-spin" />
        <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 text-orange-500 animate-pulse" />
      </div>
      <h3 className="text-3xl font-extrabold text-gray-800 mb-6">{generationPhase}</h3>
    </div>
  );
};