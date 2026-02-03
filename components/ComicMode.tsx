import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Palette, Volume2, Square, FastForward, PlayCircle } from 'lucide-react';
import { ComicScene, Language } from '../types';
import { TRANSLATIONS } from '../translations';
import { generateComicScenes, generateSceneImage, generateSpeech, decode, decodeAudioData, getSharedAudioContext } from '../services/geminiService';

interface ComicModeProps { text: string; language: Language; }

const SPEEDS = [0.8, 1, 1.2];

export const ComicMode: React.FC<ComicModeProps> = ({ text, language }) => {
  const [scenes, setScenes] = useState<ComicScene[]>([]);
  const [loading, setLoading] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const t = TRANSLATIONS[language];

  useEffect(() => {
    const createComic = async () => {
      try {
        setLoading(true);
        const extracted = await generateComicScenes(text, language);
        setScenes(extracted);
        const updated = [...extracted];
        for (let i = 0; i < extracted.length; i++) {
          const img = await generateSceneImage(extracted[i]);
          updated[i] = { ...updated[i], imageUrl: img };
          setScenes([...updated]);
        }
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    createComic();
    return () => stopAudio();
  }, [text, language]);

  const stopAudio = () => {
    if (currentSourceRef.current) { try { currentSourceRef.current.stop(); } catch(e) {} currentSourceRef.current = null; }
    setSpeakingIdx(null);
  };

  const handleSpeak = async (idx: number, sceneText: string) => {
    if (speakingIdx === idx) { stopAudio(); return; }
    stopAudio();
    
    try {
      const ctx = getSharedAudioContext();
      if (ctx.state === 'suspended') await ctx.resume();
      
      setSpeakingIdx(idx);

      const b64 = await generateSpeech(sceneText, language);
      const buffer = await decodeAudioData(decode(b64), ctx);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = playbackSpeed;
      source.connect(ctx.destination);
      source.onended = () => setSpeakingIdx(null);
      currentSourceRef.current = source;
      source.start();
    } catch (err) { 
      stopAudio(); 
    }
  };

  if (loading && scenes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-pulse">
        <Loader2 className="w-20 h-20 text-purple-600 animate-spin mb-8" />
        <h3 className="text-3xl font-black text-gray-800 mb-2 tracking-tight">{t.drawingComic}</h3>
        <p className="text-lg text-gray-400 font-medium italic">{t.paintingScenes}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20 px-4">
      <div className="flex flex-col sm:flex-row items-center justify-between p-6 bg-white border-2 border-purple-100 rounded-3xl shadow-sm gap-4">
        <div className="flex items-center gap-4">
           <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center shadow-inner"><Palette className="w-6 h-6" /></div>
           <div>
             <h2 className="text-2xl font-black text-gray-800 tracking-tight">{t.comicTitle}</h2>
             <p className="text-purple-400 font-bold uppercase tracking-[0.1em] text-[10px]">{t.comicSubtitle}</p>
           </div>
        </div>
        <div className="flex items-center bg-gray-50 p-1.5 rounded-2xl gap-1 border border-gray-100">
          <FastForward className="w-4 h-4 text-gray-300 mx-2" />
          {SPEEDS.map(s => (
            <button key={s} onClick={() => setPlaybackSpeed(s)} className={`px-4 py-2 text-sm font-black rounded-xl transition-all ${playbackSpeed === s ? 'bg-purple-600 text-white shadow-md' : 'text-gray-400 hover:text-purple-600'}`}>
              {s}x
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {scenes.map((scene, idx) => (
          <div key={idx} className="flex flex-col items-center group animate-in slide-in-from-bottom-6">
            <div className="relative w-full bg-white p-4 rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden transition-all active:scale-95">
              <div className="aspect-square w-full rounded-[2rem] overflow-hidden bg-gray-50 flex items-center justify-center shadow-inner">
                {scene.imageUrl ? (
                  <img src={scene.imageUrl} className="w-full h-full object-cover" alt="comic scene" />
                ) : (
                  <Loader2 className="animate-spin text-purple-300 w-10 h-10" />
                )}
              </div>
              <button 
                onClick={() => handleSpeak(idx, scene.description)} 
                className={`absolute bottom-8 right-8 w-16 h-16 rounded-2xl shadow-xl transition-all flex items-center justify-center ${speakingIdx === idx ? 'bg-red-500 text-white scale-110' : 'bg-white/90 text-purple-600 border border-purple-100 backdrop-blur-md'}`}
              >
                {speakingIdx === idx ? <Square className="fill-current w-6 h-6" /> : <PlayCircle className="w-8 h-8" />}
              </button>
            </div>
            <div className={`mt-4 w-full text-center p-4 rounded-2xl transition-all ${speakingIdx === idx ? 'bg-purple-50' : ''}`}>
              <p className={`text-lg font-bold italic tracking-tight leading-snug ${speakingIdx === idx ? 'text-purple-600' : 'text-gray-700'}`}>
                "{scene.description}"
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};