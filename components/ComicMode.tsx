
import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Palette, Volume2, Square, FastForward, PlayCircle } from 'lucide-react';
import { ComicScene } from '../types';
// Updated imports to match geminiService exports
import { generateComicScenes, generateSceneImage, generateSpeech, decode, decodeAudioData } from '../services/geminiService';

interface ComicModeProps {
  text: string;
}

const SPEEDS = [0.8, 1, 1.2];

export const ComicMode: React.FC<ComicModeProps> = ({ text }) => {
  const [scenes, setScenes] = useState<ComicScene[]>([]);
  const [loading, setLoading] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    const createComic = async () => {
      try {
        setLoading(true);
        const extracted = await generateComicScenes(text);
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
  }, [text]);

  const stopAudio = () => {
    if (currentSourceRef.current) { try { currentSourceRef.current.stop(); } catch(e) {} currentSourceRef.current = null; }
    setSpeakingIdx(null);
  };

  const handleSpeak = async (idx: number, sceneText: string) => {
    if (speakingIdx === idx) { stopAudio(); return; }
    stopAudio();
    setSpeakingIdx(idx);

    try {
      if (!audioContextRef.current) audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      // Replaced decodeBase64 with decode
      const b64 = await generateSpeech("Mira en este dibujo: " + sceneText);
      const buffer = await decodeAudioData(decode(b64), audioContextRef.current);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = playbackSpeed;
      source.connect(audioContextRef.current.destination);
      source.onended = () => setSpeakingIdx(null);
      currentSourceRef.current = source;
      source.start();
    } catch (err) { stopAudio(); }
  };

  if (loading && scenes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center animate-pulse">
        <div className="relative mb-10">
          <Loader2 className="w-24 h-24 text-purple-600 animate-spin" />
          <Palette className="w-10 h-10 text-purple-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <h3 className="text-4xl font-black text-gray-800 mb-4 tracking-tight">Dibujando tu magia...</h3>
        <p className="text-xl text-gray-400 font-medium italic">"Los pinceles están pintando cada escena de tu historia"</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-16 pb-32">
      <div className="flex flex-wrap items-center justify-between p-10 bg-white border-4 border-purple-100 rounded-[3.5rem] shadow-xl gap-8">
        <div className="flex items-center gap-6">
           <div className="w-20 h-20 bg-purple-100 text-purple-600 rounded-[2rem] flex items-center justify-center shadow-inner"><Palette className="w-10 h-10" /></div>
           <div>
             <h2 className="text-4xl font-black text-gray-800 tracking-tight">Tu Cómic Narrado</h2>
             <p className="text-purple-400 font-bold uppercase tracking-widest text-xs mt-1">Toca el botón para escuchar cada viñeta</p>
           </div>
        </div>
        <div className="flex items-center bg-gray-50 p-2 rounded-[2rem] gap-2 border-2 border-gray-100 shadow-inner">
          <FastForward className="w-5 h-5 text-gray-300 mx-3" />
          {SPEEDS.map(s => (
            <button 
              key={s} 
              onClick={() => setPlaybackSpeed(s)} 
              className={`px-6 py-3 text-lg font-black rounded-2xl transition-all ${playbackSpeed === s ? 'bg-purple-600 text-white shadow-xl' : 'text-gray-400 hover:text-purple-600'}`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-32">
        {scenes.map((scene, idx) => (
          <div key={idx} className="flex flex-col items-center group animate-in slide-in-from-bottom-10" style={{ animationDelay: `${idx * 0.2}s` }}>
            <div className="relative w-full max-w-3xl bg-white p-8 rounded-[4.5rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.15)] border-8 border-white overflow-hidden transition-all group-hover:scale-[1.03]">
              <div className="aspect-square w-full rounded-[3rem] overflow-hidden bg-gray-50 flex items-center justify-center shadow-inner border-2 border-gray-100">
                {scene.imageUrl ? (
                  <img src={scene.imageUrl} className="w-full h-full object-cover" alt="comic scene" />
                ) : (
                  <div className="text-center p-12">
                    <Loader2 className="animate-spin mx-auto mb-6 text-purple-300 w-16 h-16" />
                    <p className="text-sm font-black text-gray-300 tracking-[0.3em] uppercase animate-pulse">Pintando...</p>
                  </div>
                )}
              </div>
              <button 
                onClick={() => handleSpeak(idx, scene.description)} 
                className={`absolute bottom-12 right-12 w-24 h-24 rounded-[2rem] shadow-2xl transition-all flex items-center justify-center ${speakingIdx === idx ? 'bg-red-500 text-white scale-110' : 'bg-white text-purple-600 hover:scale-110 hover:shadow-purple-200 active:scale-90 border-2 border-purple-50'}`}
              >
                {speakingIdx === idx ? <Square className="fill-current w-10 h-10" /> : <PlayCircle className="w-12 h-12" />}
              </button>
            </div>
            <div className={`mt-12 max-w-2xl text-center p-10 rounded-[3rem] transition-all duration-500 ${speakingIdx === idx ? 'bg-purple-50 scale-105' : 'bg-transparent'}`}>
              <p className={`text-3xl font-black italic tracking-tight leading-snug transition-colors ${speakingIdx === idx ? 'text-purple-600' : 'text-gray-700'}`}>
                "{scene.description}"
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
