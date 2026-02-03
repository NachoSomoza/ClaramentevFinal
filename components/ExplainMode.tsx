import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Sparkles, 
  Loader2, 
  User, 
  Bot, 
  Volume2, 
  Mic, 
  MicOff, 
  VolumeX,
  Brain,
  PlayCircle
} from 'lucide-react';
import { Modality } from "@google/genai";
import { 
  generateSimpleSummary, 
  chatWithDocument, 
  generateSpeech, 
  decode, 
  decodeAudioData, 
  generateSuggestedQuestions,
  getAI,
  encode
} from '../services/geminiService';
import { ChatMessage, Language } from '../types';
import { TRANSLATIONS } from '../translations';

interface ExplainModeProps {
  text: string;
  language: Language;
}

export const ExplainMode: React.FC<ExplainModeProps> = ({ text, language }) => {
  const [summary, setSummary] = useState<string[]>([]);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isLoadingContent, setIsLoadingContent] = useState(true);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const liveSessionRef = useRef<any>(null);

  const t = TRANSLATIONS[language];

  useEffect(() => {
    const init = async () => {
      try {
        setIsLoadingContent(true);
        const [sum, qs] = await Promise.all([
          generateSimpleSummary(text, language),
          generateSuggestedQuestions(text, language)
        ]);
        setSummary(sum);
        setSuggestedQuestions(qs);
        setMessages([{ role: 'model', text: t.tutorGreeting }]);
      } catch (err) { console.error(err); } finally { setIsLoadingContent(false); }
    };
    init();
    return () => {
      stopAudio();
      if (liveSessionRef.current) liveSessionRef.current.close();
    };
  }, [text, language]);

  const stopAudio = () => {
    activeSourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
    activeSourcesRef.current = [];
    setSpeakingIdx(null);
  };

  const handleSpeak = async (idx: number, messageText: string) => {
    if (speakingIdx === idx) { stopAudio(); return; }
    stopAudio();
    setSpeakingIdx(idx);
    try {
      if (!audioContextRef.current) audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') await ctx.resume();
      const b64 = await generateSpeech(messageText, language);
      const buffer = await decodeAudioData(decode(b64), ctx);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => setSpeakingIdx(null);
      activeSourcesRef.current.push(source);
      source.start();
    } catch (err) { stopAudio(); }
  };

  const handleSend = async (val?: string) => {
    const msgToSend = val || input;
    if (!msgToSend.trim() || isTyping) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: msgToSend }]);
    setIsTyping(true);
    try {
      const response = await chatWithDocument(text, msgToSend, language);
      setMessages(prev => [...prev, { role: 'model', text: response }]);
      handleSpeak(messages.length + 1, response);
    } catch (err) { 
      setMessages(prev => [...prev, { role: 'model', text: 'Oops! Error.' }]); 
    } finally { setIsTyping(false); }
  };

  const toggleListen = async () => {
    if (isListening) {
      if (liveSessionRef.current) liveSessionRef.current.close();
      liveSessionRef.current = null;
      setIsListening(false);
      return;
    }
    try {
      setIsListening(true);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ai = getAI();
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            const inputCtx = new AudioContext({ sampleRate: 16000 });
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              const pcmBlob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: (message) => {
            if (message.serverContent?.inputTranscription) setInput(message.serverContent.inputTranscription.text);
            if (message.serverContent?.turnComplete) handleSend();
          },
          onclose: () => setIsListening(false),
          onerror: () => setIsListening(false)
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          systemInstruction: `You are Claramente, a friendly tutor. Respond in ${language}. Document: ${text.substring(0, 500)}`
        }
      });
      liveSessionRef.current = await sessionPromise;
    } catch (err) { setIsListening(false); }
  };

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, isTyping]);

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-auto lg:h-[calc(100vh-160px)]">
      <div className="w-full lg:w-1/3 space-y-4 lg:overflow-y-auto custom-scrollbar lg:pr-2">
        <div className="bg-white border-2 border-indigo-50 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4 text-indigo-600 font-black uppercase text-sm tracking-widest">
            <Sparkles className="w-5 h-5" /> {t.magicSummary}
          </div>
          {isLoadingContent ? (
            <div className="flex justify-center p-6"><Loader2 className="animate-spin text-indigo-300 w-8 h-8" /></div>
          ) : (
            <div className="space-y-3">
              {summary.map((p, i) => (
                <div key={i} className="bg-indigo-50/30 p-4 rounded-2xl text-base font-medium text-slate-700 border border-indigo-50">
                  {p}
                </div>
              ))}
              <button onClick={() => handleSpeak(999, summary.join(". "))} className="w-full mt-2 p-3 bg-indigo-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 text-sm hover:bg-indigo-600 shadow-sm">
                <PlayCircle className="w-4 h-4" /> {t.listenSummary}
              </button>
            </div>
          )}
        </div>

        <div className="bg-white border-2 border-indigo-50 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4 text-indigo-600 font-black uppercase text-sm tracking-widest">
            <Brain className="w-5 h-5" /> {t.suggestions}
          </div>
          <div className="flex flex-col gap-2">
            {suggestedQuestions.map((q, i) => (
              <button key={i} onClick={() => handleSend(q)} className="bg-indigo-50 text-indigo-700 p-3 rounded-xl text-sm font-bold border border-indigo-100 hover:bg-indigo-100 text-left">
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white border-2 border-indigo-50 rounded-[2.5rem] shadow-sm overflow-hidden min-h-[500px]">
        <div ref={scrollRef} className="flex-1 p-6 overflow-y-auto space-y-6 custom-scrollbar bg-slate-50/20">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
              <div className={`flex gap-3 max-w-[90%] md:max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-600'}`}>
                  {msg.role === 'user' ? <User className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
                </div>
                <div className="relative group">
                  <div className={`p-4 md:p-5 rounded-2xl shadow-sm text-base md:text-lg font-medium leading-relaxed ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white border border-indigo-50 rounded-tl-none text-slate-800'}`}>
                    {msg.text}
                  </div>
                  {msg.role === 'model' && (
                    <button onClick={() => handleSpeak(idx, msg.text)} className={`absolute -right-10 top-0 p-2 rounded-full transition-all ${speakingIdx === idx ? 'bg-rose-500 text-white' : 'text-slate-300 hover:text-indigo-500'}`}>
                      {speakingIdx === idx ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex gap-2 p-3 items-center bg-white/70 w-fit rounded-full px-5 border border-indigo-50 text-xs font-bold text-slate-400">
              <Loader2 className="animate-spin w-4 h-4" /> {t.thinking}
            </div>
          )}
        </div>

        <div className="p-4 md:p-6 border-t border-indigo-50 bg-white">
          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <input 
                type="text" value={input} 
                onChange={(e) => setInput(e.target.value)} 
                onKeyPress={(e) => e.key === 'Enter' && handleSend()} 
                className={`w-full p-4 md:p-5 rounded-2xl bg-slate-50 border-2 outline-none transition-all text-base font-medium pr-14 ${isListening ? 'border-rose-300 bg-rose-50/30' : 'border-indigo-50 focus:border-indigo-200 focus:bg-white'}`} 
                placeholder={isListening ? t.listening : t.writeDoubt} 
              />
              <button onClick={toggleListen} className={`absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl flex items-center justify-center ${isListening ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-400 hover:text-indigo-500'}`}>
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
            </div>
            <button onClick={() => handleSend()} disabled={!input.trim() || isTyping} className="w-14 h-14 rounded-2xl shadow-md flex items-center justify-center bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-100">
              <Send className="w-7 h-7" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};