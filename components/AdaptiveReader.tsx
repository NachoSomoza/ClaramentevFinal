
import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings, 
  Volume2, 
  ArrowRight,
  Check,
  AlignJustify,
  Type,
  VolumeX,
  FastForward,
  Play
} from 'lucide-react';
import { ReaderSettings } from '../types';
import { THEMES } from '../constants';
// Fixed imports to match new service exports
import { generateSpeech, decode, decodeAudioData } from '../services/geminiService';

interface AdaptiveReaderProps {
  text: string;
}

type Step = 'FONT' | 'SPACING' | 'READ';

export const AdaptiveReader: React.FC<AdaptiveReaderProps> = ({ text }) => {
  const [step, setStep] = useState<Step>('FONT');
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [settings, setSettings] = useState<ReaderSettings>({
    fontSize: 28,
    lineHeight: 1.8,
    letterSpacing: 1.5,
    fontFamily: 'standard',
    theme: 'light'
  });
  
  const [isReading, setIsReading] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextStartTimeRef = useRef<number>(0);
  const isAbortedRef = useRef(false);
  const playbackRateRef = useRef(1);

  useEffect(() => { playbackRateRef.current = playbackSpeed; }, [playbackSpeed]);
  useEffect(() => { return () => stopAudio(); }, []);

  const stopAudio = () => {
    isAbortedRef.current = true;
    activeSourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
    activeSourcesRef.current = [];
    setIsReading(false);
    setIsBuffering(false);
  };

  const handlePlayAudio = async () => {
    if (isReading) { stopAudio(); return; }
    
    setIsReading(true);
    isAbortedRef.current = false;
    setIsBuffering(true);
    
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') await ctx.resume();
    
    nextStartTimeRef.current = ctx.currentTime;

    const sentences = text.match(/[^.!?\n]+[.!?\n]*/g) || [text];
    const chunks = sentences.map(s => s.trim()).filter(s => s.length > 3);

    const audioBufferQueue: AudioBuffer[] = [];
    let fetchIndex = 0;
    let playIndex = 0;

    const fetchWorker = async () => {
      while (fetchIndex < chunks.length && !isAbortedRef.current) {
        if (audioBufferQueue.length < 3) {
          try {
            const chunk = chunks[fetchIndex++];
            const base64 = await generateSpeech(chunk);
            if (isAbortedRef.current) return;
            // Updated call to use 'decode' instead of 'decodeBase64'
            const buffer = await decodeAudioData(decode(base64), ctx);
            audioBufferQueue.push(buffer);
          } catch (e) { 
            console.error("Error obteniendo audio:", e);
          }
        } else {
          await new Promise(r => setTimeout(r, 400));
        }
      }
    };

    fetchWorker();

    while (playIndex < chunks.length && !isAbortedRef.current) {
      if (audioBufferQueue.length > 0) {
        setIsBuffering(false);
        const buffer = audioBufferQueue.shift()!;
        
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = playbackRateRef.current;
        source.connect(ctx.destination);
        
        const startTime = Math.max(nextStartTimeRef.current, ctx.currentTime);
        source.start(startTime);
        activeSourcesRef.current.push(source);
        
        const duration = buffer.duration / playbackRateRef.current;
        nextStartTimeRef.current = startTime + duration;
        playIndex++;

        // Pequeno overlap para evitar clics
        await new Promise(r => setTimeout(r, (duration * 1000) - 30));
      } else {
        setIsBuffering(true);
        await new Promise(r => setTimeout(r, 200));
      }
    }
    
    if (playIndex >= chunks.length && !isAbortedRef.current) {
      setIsReading(false);
    }
  };

  const currentTheme = THEMES[settings.theme];
  const getFontClass = (f: string) => f === 'dyslexic' ? 'font-dyslexic' : f === 'rounded' ? 'font-rounded' : 'font-sans';

  if (step === 'FONT') {
    return (
      <div className="max-w-4xl mx-auto py-10 text-center animate-in fade-in zoom-in-95">
        <h2 className="text-5xl font-black mb-12 text-gray-800 tracking-tight">¿Qué letra te gusta más?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {['standard', 'dyslexic', 'rounded'].map((f) => (
            <button
              key={f}
              onClick={() => setSettings({ ...settings, fontFamily: f as any })}
              className={`p-10 rounded-[3.5rem] border-4 transition-all shadow-xl hover:scale-105 ${settings.fontFamily === f ? 'border-blue-500 bg-blue-50' : 'border-gray-100 bg-white hover:border-blue-200'}`}
            >
              <h3 className={`text-4xl mb-3 ${getFontClass(f)}`}>{f === 'standard' ? 'Normal' : f === 'dyslexic' ? 'Especial' : 'Redonda'}</h3>
              <p className="text-gray-400 font-medium">Así se verá tu historia.</p>
            </button>
          ))}
        </div>
        <button onClick={() => setStep('SPACING')} className="mt-16 px-16 py-6 bg-blue-600 text-white rounded-full font-black text-2xl flex items-center gap-4 mx-auto shadow-2xl hover:scale-110 active:scale-95 transition-all">Siguiente <ArrowRight className="w-8 h-8" /></button>
      </div>
    );
  }

  if (step === 'SPACING') {
    return (
      <div className="max-w-4xl mx-auto py-10 text-center animate-in fade-in zoom-in-95">
        <h2 className="text-5xl font-black mb-12 text-gray-800 tracking-tight">Personaliza tu espacio</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-12">
          <div className="bg-white p-12 rounded-[4rem] border-2 border-gray-100 shadow-lg">
            <h3 className="text-3xl font-black mb-10 flex items-center gap-4 justify-center text-blue-600 uppercase tracking-tighter"><AlignJustify className="w-8 h-8" /> Líneas</h3>
            <div className="flex flex-col gap-6">
              {[1.5, 2.2, 3.0].map(v => (
                <button key={v} onClick={() => setSettings({...settings, lineHeight: v})} className={`py-6 rounded-3xl border-4 text-xl font-bold transition-all ${settings.lineHeight === v ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md' : 'border-gray-50 text-gray-500 hover:border-blue-100'}`}>
                  {v === 1.5 ? 'Juntitas' : v === 2.2 ? 'Normal' : 'Muy separadas'}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-white p-12 rounded-[4rem] border-2 border-gray-100 shadow-lg">
            <h3 className="text-3xl font-black mb-10 flex items-center gap-4 justify-center text-purple-600 uppercase tracking-tighter"><Type className="w-8 h-8" /> Letras</h3>
            <div className="flex flex-col gap-6">
              {[1, 3, 6].map(v => (
                <button key={v} onClick={() => setSettings({...settings, letterSpacing: v})} className={`py-6 rounded-3xl border-4 text-xl font-bold transition-all ${settings.letterSpacing === v ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-md' : 'border-gray-50 text-gray-500 hover:border-purple-100'}`}>
                   {v === 1 ? 'Cerca' : v === 3 ? 'Normal' : 'Lejos'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-center gap-8">
           <button onClick={() => setStep('FONT')} className="px-10 py-6 text-gray-400 font-black text-xl hover:text-gray-600 transition-colors">Volver</button>
           <button onClick={() => setStep('READ')} className="px-16 py-6 bg-green-600 text-white rounded-full font-black text-2xl flex items-center gap-4 shadow-2xl hover:scale-110 active:scale-95 transition-all">¡Vamos a leer! <Check className="w-8 h-8" /></button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-[calc(100vh-200px)] rounded-[4rem] overflow-hidden shadow-2xl transition-colors duration-500 ${currentTheme.bg} animate-in zoom-in-95`}>
      <div className={`p-8 flex flex-wrap items-center justify-between gap-8 ${currentTheme.card} border-b shadow-lg`}>
        <div className="flex items-center gap-6">
          <button 
            onClick={handlePlayAudio} 
            className={`w-20 h-20 rounded-full shadow-2xl flex items-center justify-center transition-all transform hover:scale-110 active:scale-90 ${isReading ? 'bg-red-500 text-white animate-pulse' : 'bg-blue-600 text-white'}`}
          >
            {isReading ? <VolumeX className="w-10 h-10" /> : <Play className="w-10 h-10 fill-current ml-1" />}
          </button>
          <div className="flex flex-col">
            <span className={`text-xl font-black uppercase tracking-widest ${currentTheme.text}`}>
              {isReading ? 'Escuchando Voz Fluida' : 'Modo Narrador'}
            </span>
            {isReading && (
              <div className="flex items-center gap-1 mt-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="w-1.5 h-6 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 max-w-xs flex flex-col gap-3 bg-gray-50/70 p-5 rounded-[2rem] border-2 border-gray-100">
          <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest text-gray-400">
            <div className="flex items-center gap-2"><FastForward className="w-4 h-4" /> Velocidad</div>
            <span className="text-blue-600 bg-white px-3 py-1 rounded-lg shadow-sm font-bold">{playbackSpeed.toFixed(1)}x</span>
          </div>
          <input 
            type="range" 
            min="0.5" 
            max="1.8" 
            step="0.1" 
            value={playbackSpeed} 
            onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
            className="w-full h-4 bg-blue-100 rounded-full appearance-none cursor-pointer accent-blue-600"
          />
        </div>

        <div className="flex gap-4">
          {Object.entries(THEMES).map(([k, t]) => (
            <button key={k} onClick={() => setSettings({...settings, theme: k as any})} className={`w-14 h-14 rounded-2xl border-2 transition-all flex items-center justify-center ${settings.theme === k ? 'border-blue-500 scale-110 shadow-xl ring-4 ring-blue-50' : 'opacity-40 hover:opacity-100'} ${t.bg}`}>
              {t.icon}
            </button>
          ))}
          <button onClick={() => setStep('FONT')} className="ml-6 p-5 bg-gray-100 hover:bg-gray-200 rounded-[2rem] transition-all"><Settings className="w-8 h-8 text-gray-600" /></button>
        </div>
      </div>

      <div className={`flex-1 p-16 sm:p-32 overflow-y-auto custom-scrollbar ${getFontClass(settings.fontFamily)}`} style={{ fontSize: settings.fontSize, lineHeight: settings.lineHeight, letterSpacing: settings.letterSpacing }}>
        <p className={`whitespace-pre-wrap transition-colors duration-500 ${currentTheme.text} font-medium`}>{text}</p>
      </div>
    </div>
  );
};
