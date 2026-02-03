import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings, 
  ArrowRight,
  Check,
  AlignJustify,
  Type,
  VolumeX,
  FastForward,
  Play,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { ReaderSettings, Language } from '../types';
import { THEMES } from '../constants';
import { TRANSLATIONS } from '../translations';
import { generateSpeech, decode, decodeAudioData, getSharedAudioContext, unlockAudioForiOS } from '../services/geminiService';

interface AdaptiveReaderProps { text: string; language: Language; }

type Step = 'FONT' | 'SPACING' | 'READ';

export const AdaptiveReader: React.FC<AdaptiveReaderProps> = ({ text, language }) => {
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
  
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextStartTimeRef = useRef<number>(0);
  const isAbortedRef = useRef(false);
  const playbackRateRef = useRef(1);
  const audioBufferQueueRef = useRef<AudioBuffer[]>([]);
  const prefetchIndexRef = useRef(0);
  const chunksRef = useRef<string[]>([]);

  const t = TRANSLATIONS[language];

  useEffect(() => { playbackRateRef.current = playbackSpeed; }, [playbackSpeed]);
  
  useEffect(() => {
    if (text) {
      chunksRef.current = text.match(/[^.!?\n]+[.!?\n]*/g)?.map(s => s.trim()).filter(s => s.length > 2) || [text];
    }
    return () => stopAudio();
  }, [text]);

  const stopAudio = () => {
    isAbortedRef.current = true;
    activeSourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
    activeSourcesRef.current = [];
    setIsReading(false);
    setIsBuffering(false);
  };

  const handleFinalStep = () => {
    unlockAudioForiOS().catch(err => console.error("Fallo al desbloquear audio:", err));
    setStep('READ');
    window.scrollTo(0, 0);
  };

  const handlePlayAudio = async () => {
    if (!text || text.trim().length === 0) return;
    if (isReading) { stopAudio(); return; }
    
    try {
      const ctx = getSharedAudioContext();
      if (ctx.state === 'suspended') await ctx.resume();

      setIsReading(true);
      isAbortedRef.current = false;
      setIsBuffering(audioBufferQueueRef.current.length === 0);
      
      nextStartTimeRef.current = ctx.currentTime;
      let playIndex = 0;

      const fetchWorker = async () => {
        while (prefetchIndexRef.current < chunksRef.current.length && !isAbortedRef.current) {
          if (audioBufferQueueRef.current.length < 3) {
            try {
              const chunk = chunksRef.current[prefetchIndexRef.current++];
              const base64 = await generateSpeech(chunk, language);
              if (isAbortedRef.current) return;
              const buffer = await decodeAudioData(decode(base64), ctx);
              audioBufferQueueRef.current.push(buffer);
              if (isReading) setIsBuffering(false);
            } catch (e) { console.error(e); }
          } else {
            await new Promise(r => setTimeout(r, 200));
          }
        }
      };

      fetchWorker();

      while (playIndex < chunksRef.current.length && !isAbortedRef.current) {
        if (audioBufferQueueRef.current.length > 0) {
          setIsBuffering(false);
          const buffer = audioBufferQueueRef.current.shift()!;
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
          await new Promise(r => setTimeout(r, 100));
        }
      }
      
      if (playIndex >= chunksRef.current.length && !isAbortedRef.current) {
        setIsReading(false);
        prefetchIndexRef.current = 0;
      }
    } catch (err) {
      setIsReading(false);
    }
  };

  const currentTheme = THEMES[settings.theme] || THEMES.light;
  const getFontClass = (f: string) => f === 'dyslexic' ? 'font-dyslexic' : f === 'rounded' ? 'font-rounded' : 'font-sans';

  if (step === 'FONT') {
    return (
      <div className="max-w-4xl mx-auto py-6 md:py-12 text-center px-4">
        <h2 className="text-3xl md:text-5xl font-black mb-8 text-slate-800 tracking-tight">{t.fontStepTitle}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-8">
          {['standard', 'dyslexic', 'rounded'].map((f) => (
            <button key={f} onClick={() => setSettings({ ...settings, fontFamily: f as any })}
              className={`p-6 md:p-10 rounded-3xl border-4 transition-all shadow-sm ${settings.fontFamily === f ? 'border-indigo-500 bg-indigo-50' : 'border-white bg-white hover:border-indigo-200'}`}>
              <h3 className={`text-2xl md:text-4xl mb-2 ${getFontClass(f)} text-slate-900`}>{f === 'standard' ? 'Normal' : f === 'dyslexic' ? 'Dyslexic' : 'Rounded'}</h3>
            </button>
          ))}
        </div>
        <button onClick={() => { setStep('SPACING'); window.scrollTo(0,0); }} className="mt-12 px-10 py-5 bg-indigo-600 text-white rounded-full font-black text-xl flex items-center gap-3 mx-auto shadow-lg active:scale-95 transition-all shadow-indigo-200">{t.next} <ArrowRight className="w-6 h-6" /></button>
      </div>
    );
  }

  if (step === 'SPACING') {
    return (
      <div className="max-w-4xl mx-auto py-6 md:py-12 text-center px-4">
        <h2 className="text-3xl md:text-5xl font-black mb-8 text-slate-800 tracking-tight">{t.spacingStepTitle}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 mb-12">
          <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-50 shadow-sm">
            <h3 className="text-2xl font-black mb-8 flex items-center gap-3 justify-center text-indigo-600 uppercase tracking-tighter"><AlignJustify className="w-6 h-6" /> {t.lines}</h3>
            <div className="flex flex-col gap-4">
              {[1.4, 2.0, 2.8].map(v => (
                <button key={v} onClick={() => setSettings({...settings, lineHeight: v})} className={`py-4 md:py-6 rounded-2xl border-4 text-lg font-bold transition-all ${settings.lineHeight === v ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-50 text-slate-500 hover:border-indigo-100 bg-white'}`}>
                  {v === 1.4 ? 'Small' : v === 2.0 ? 'Normal' : 'Large'}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-50 shadow-sm">
            <h3 className="text-2xl font-black mb-8 flex items-center gap-3 justify-center text-indigo-500 uppercase tracking-tighter"><Type className="w-6 h-6" /> {t.letters}</h3>
            <div className="flex flex-col gap-4">
              {[0, 2, 5].map(v => (
                <button key={v} onClick={() => setSettings({...settings, letterSpacing: v})} className={`py-4 md:py-6 rounded-2xl border-4 text-lg font-bold transition-all ${settings.letterSpacing === v ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-50 text-slate-500 hover:border-indigo-100 bg-white'}`}>
                   {v === 0 ? 'Small' : v === 2 ? 'Normal' : 'Large'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <button onClick={handleFinalStep} className="px-12 py-5 bg-indigo-600 text-white rounded-full font-black text-xl flex items-center gap-3 shadow-lg active:scale-95 transition-all shadow-indigo-200">
          {t.letsRead} <Check className="w-6 h-6" />
        </button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col min-h-[70vh] rounded-[2rem] md:rounded-[3.5rem] overflow-hidden shadow-2xl border border-indigo-100 transition-colors duration-500 ${currentTheme.bg}`}>
      <div className={`p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-8 ${currentTheme.card} border-b border-indigo-50`}>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <button 
            onClick={handlePlayAudio} 
            className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl shadow-md flex items-center justify-center transition-all ${isReading ? 'bg-rose-500 text-white' : 'bg-indigo-600 text-white active:scale-90 shadow-indigo-200'}`}
          >
            {isReading ? (
              isBuffering ? <Loader2 className="w-7 h-7 animate-spin" /> : <VolumeX className="w-7 h-7" />
            ) : (
              <Play className="w-7 h-7 fill-current ml-1" />
            )}
          </button>
          <div className="flex flex-col">
            <span className={`text-sm md:text-base font-black uppercase tracking-wider ${currentTheme.text}`}>
              {isReading ? t.listening : t.narratorMode}
            </span>
          </div>
        </div>

        <div className="flex gap-2 w-full md:w-auto justify-end">
          {Object.entries(THEMES).map(([k, t]) => (
            <button key={k} onClick={() => setSettings({...settings, theme: k as any})} className={`w-10 h-10 rounded-xl border-2 transition-all flex items-center justify-center ${settings.theme === k ? 'border-indigo-500 bg-indigo-50 shadow-inner' : 'border-transparent opacity-60 hover:opacity-100'} ${t.bg}`}>
              {React.cloneElement(t.icon as any, { className: "w-4 h-4" })}
            </button>
          ))}
          <button onClick={() => { setStep('FONT'); window.scrollTo(0,0); }} className="ml-2 p-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"><Settings className="w-5 h-5 text-slate-600" /></button>
        </div>
      </div>

      <div className={`flex-1 p-6 md:p-16 lg:p-24 overflow-y-auto custom-scrollbar ${getFontClass(settings.fontFamily)} bg-opacity-100`} style={{ fontSize: settings.fontSize, lineHeight: settings.lineHeight, letterSpacing: settings.letterSpacing, minHeight: '500px' }}>
        <div className="max-w-4xl mx-auto">
          {(!text || text.trim().length < 5) ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
              <AlertCircle className="w-16 h-16" />
              <p className="text-xl font-black uppercase tracking-widest">{t.noText}</p>
            </div>
          ) : (
            <p className={`whitespace-pre-wrap transition-colors duration-500 font-medium ${currentTheme.text} leading-relaxed block`}>
              {text}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};