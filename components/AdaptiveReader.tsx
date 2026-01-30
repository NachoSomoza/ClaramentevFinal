
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
import { generateSpeech, decode, decodeAudioData } from '../services/geminiService';

interface AdaptiveReaderProps {
  text: string;
}

type Step = 'FONT' | 'SPACING' | 'READ';

export const AdaptiveReader: React.FC<AdaptiveReaderProps> = ({ text }) => {
  const [step, setStep] = useState<Step>('FONT');
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [settings, setSettings] = useState<ReaderSettings>({
    fontSize: 24,
    lineHeight: 1.6,
    letterSpacing: 1.2,
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
        if (audioBufferQueue.length < 2) {
          try {
            const chunk = chunks[fetchIndex++];
            const base64 = await generateSpeech(chunk);
            if (isAbortedRef.current) return;
            const buffer = await decodeAudioData(decode(base64), ctx);
            audioBufferQueue.push(buffer);
          } catch (e) { console.error(e); }
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
        await new Promise(r => setTimeout(r, (duration * 1000) - 50));
      } else {
        setIsBuffering(true);
        await new Promise(r => setTimeout(r, 200));
      }
    }
    if (playIndex >= chunks.length && !isAbortedRef.current) setIsReading(false);
  };

  const currentTheme = THEMES[settings.theme];
  const getFontClass = (f: string) => f === 'dyslexic' ? 'font-dyslexic' : f === 'rounded' ? 'font-rounded' : 'font-sans';

  // Pantallas de configuración responsivas
  if (step === 'FONT') {
    return (
      <div className="max-w-4xl mx-auto py-6 md:py-12 text-center px-4 animate-in fade-in zoom-in-95">
        <h2 className="text-3xl md:text-5xl font-black mb-8 md:mb-12 text-slate-800 tracking-tight">¿Qué letra prefieres?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-8">
          {['standard', 'dyslexic', 'rounded'].map((f) => (
            <button
              key={f}
              onClick={() => setSettings({ ...settings, fontFamily: f as any })}
              className={`p-6 md:p-10 rounded-3xl md:rounded-[3rem] border-4 transition-all shadow-sm hover:shadow-md ${settings.fontFamily === f ? 'border-blue-500 bg-blue-50' : 'border-white bg-white hover:border-blue-200'}`}
            >
              <h3 className={`text-2xl md:text-4xl mb-2 ${getFontClass(f)}`}>{f === 'standard' ? 'Normal' : f === 'dyslexic' ? 'Especial' : 'Redonda'}</h3>
              <p className="text-slate-400 text-sm md:text-base font-medium">Lectura fácil</p>
            </button>
          ))}
        </div>
        <button onClick={() => setStep('SPACING')} className="mt-12 px-10 py-5 bg-blue-600 text-white rounded-full font-black text-xl flex items-center gap-3 mx-auto shadow-lg hover:scale-105 active:scale-95 transition-all">Siguiente <ArrowRight className="w-6 h-6" /></button>
      </div>
    );
  }

  if (step === 'SPACING') {
    return (
      <div className="max-w-4xl mx-auto py-6 md:py-12 text-center px-4 animate-in fade-in zoom-in-95">
        <h2 className="text-3xl md:text-5xl font-black mb-8 md:mb-12 text-slate-800 tracking-tight">Personaliza tu espacio</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 mb-12">
          <div className="bg-white p-8 md:p-12 rounded-[2.5rem] md:rounded-[4rem] border-2 border-slate-50 shadow-sm">
            <h3 className="text-2xl md:text-3xl font-black mb-8 flex items-center gap-3 justify-center text-blue-600 uppercase tracking-tighter"><AlignJustify className="w-6 h-6" /> Líneas</h3>
            <div className="flex flex-col gap-4">
              {[1.4, 2.0, 2.8].map(v => (
                <button key={v} onClick={() => setSettings({...settings, lineHeight: v})} className={`py-4 md:py-6 rounded-2xl md:rounded-3xl border-4 text-lg font-bold transition-all ${settings.lineHeight === v ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-50 text-slate-500 hover:border-blue-100 bg-white'}`}>
                  {v === 1.4 ? 'Juntitas' : v === 2.0 ? 'Normal' : 'Muy separadas'}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-white p-8 md:p-12 rounded-[2.5rem] md:rounded-[4rem] border-2 border-slate-50 shadow-sm">
            <h3 className="text-2xl md:text-3xl font-black mb-8 flex items-center gap-3 justify-center text-teal-600 uppercase tracking-tighter"><Type className="w-6 h-6" /> Letras</h3>
            <div className="flex flex-col gap-4">
              {[0, 2, 5].map(v => (
                <button key={v} onClick={() => setSettings({...settings, letterSpacing: v})} className={`py-4 md:py-6 rounded-2xl md:rounded-3xl border-4 text-lg font-bold transition-all ${settings.letterSpacing === v ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-50 text-slate-500 hover:border-teal-100 bg-white'}`}>
                   {v === 0 ? 'Cerca' : v === 2 ? 'Normal' : 'Lejos'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row justify-center gap-4 sm:gap-8">
           <button onClick={() => setStep('FONT')} className="px-8 py-4 text-slate-400 font-black text-lg">Volver</button>
           <button onClick={() => setStep('READ')} className="px-12 py-5 bg-teal-600 text-white rounded-full font-black text-xl flex items-center gap-3 shadow-lg hover:scale-105 active:scale-95 transition-all">¡A leer! <Check className="w-6 h-6" /></button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col min-h-[70vh] rounded-[2rem] md:rounded-[3.5rem] overflow-hidden shadow-xl border border-slate-100 transition-colors duration-500 ${currentTheme.bg} animate-in zoom-in-95`}>
      {/* Barra de herramientas compacta y responsiva */}
      <div className={`p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-8 ${currentTheme.card} border-b`}>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <button 
            onClick={handlePlayAudio} 
            className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl shadow-md flex items-center justify-center transition-all ${isReading ? 'bg-red-500 text-white animate-pulse' : 'bg-blue-600 text-white hover:scale-105'}`}
          >
            {isReading ? <VolumeX className="w-7 h-7" /> : <Play className="w-7 h-7 fill-current ml-1" />}
          </button>
          <div className="flex flex-col">
            <span className={`text-sm md:text-base font-black uppercase tracking-wider ${currentTheme.text}`}>
              {isReading ? 'Escuchando...' : 'Modo Narrador'}
            </span>
            {isReading && <div className="text-[10px] text-blue-400 font-bold">Voz Fluida Activa</div>}
          </div>
        </div>

        <div className="flex items-center gap-4 w-full md:w-1/3 bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
          <FastForward className="w-4 h-4 text-slate-300" />
          <input 
            type="range" min="0.5" max="1.8" step="0.1" value={playbackSpeed} 
            onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
            className="flex-1 h-2 bg-blue-100 rounded-full appearance-none cursor-pointer accent-blue-600"
          />
          <span className="text-xs font-black text-blue-600 w-8">{playbackSpeed.toFixed(1)}x</span>
        </div>

        <div className="flex gap-2 w-full md:w-auto justify-end">
          {Object.entries(THEMES).map(([k, t]) => (
            <button key={k} onClick={() => setSettings({...settings, theme: k as any})} className={`w-10 h-10 rounded-xl border-2 transition-all flex items-center justify-center ${settings.theme === k ? 'border-blue-500 bg-blue-50' : 'border-transparent opacity-60 hover:opacity-100'} ${t.bg}`}>
              {React.cloneElement(t.icon as any, { className: "w-4 h-4" })}
            </button>
          ))}
          <button onClick={() => setStep('FONT')} className="ml-2 p-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"><Settings className="w-5 h-5 text-slate-600" /></button>
        </div>
      </div>

      <div 
        className={`flex-1 p-6 md:p-16 lg:p-24 overflow-y-auto custom-scrollbar ${getFontClass(settings.fontFamily)}`} 
        style={{ fontSize: settings.fontSize, lineHeight: settings.lineHeight, letterSpacing: settings.letterSpacing }}
      >
        <div className="max-w-4xl mx-auto">
          <p className={`whitespace-pre-wrap transition-colors duration-500 ${currentTheme.text} font-medium`}>{text}</p>
        </div>
      </div>
    </div>
  );
};
