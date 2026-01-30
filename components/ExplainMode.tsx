
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
  FastForward,
  Brain,
  MessageCircle,
  PlayCircle
} from 'lucide-react';
import { Modality } from "@google/genai";
// Fixed imports and replaced decodeBase64 with decode
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
import { ChatMessage } from '../types';

interface ExplainModeProps {
  text: string;
}

export const ExplainMode: React.FC<ExplainModeProps> = ({ text }) => {
  const [summary, setSummary] = useState<string[]>([]);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isLoadingContent, setIsLoadingContent] = useState(true);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isListening, setIsListening] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const liveSessionRef = useRef<any>(null);

  useEffect(() => {
    const init = async () => {
      try {
        setIsLoadingContent(true);
        const [sum, qs] = await Promise.all([
          generateSimpleSummary(text),
          generateSuggestedQuestions(text)
        ]);
        setSummary(sum);
        setSuggestedQuestions(qs);
        setMessages([{ role: 'model', text: '¡Hola! Soy Claramente. He leído tu historia y estoy listo para charlar. ¡Dime qué quieres saber o toca el micrófono para hablarme!' }]);
      } catch (err) { console.error(err); } finally { setIsLoadingContent(false); }
    };
    init();
    return () => {
      stopAudio();
      if (liveSessionRef.current) liveSessionRef.current.close();
    };
  }, [text]);

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
      
      const b64 = await generateSpeech(messageText);
      // Updated call to use 'decode' instead of 'decodeBase64'
      const buffer = await decodeAudioData(decode(b64), ctx);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = playbackSpeed;
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
      // Fixed call to chatWithDocument to match 2-argument signature
      const response = await chatWithDocument(text, msgToSend);
      setMessages(prev => [...prev, { role: 'model', text: response }]);
      // Narrar automaticamente la respuesta
      handleSpeak(messages.length + 1, response);
    } catch (err) { 
      setMessages(prev => [...prev, { role: 'model', text: '¡Ups! Mi magia se detuvo un momento. ¿Podrías repetirlo?' }]); 
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
              const pcmBlob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
            };
            
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: (message) => {
            // Manejamos la transcripcion para feedback visual
            if (message.serverContent?.inputTranscription) {
              const textStr = message.serverContent.inputTranscription.text;
              setInput(prev => (prev + " " + textStr).trim());
            }
            // Al completar el turno, enviamos el mensaje al chat
            if (message.serverContent?.turnComplete) {
              handleSend();
            }
          },
          onclose: () => setIsListening(false),
          onerror: () => setIsListening(false)
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          systemInstruction: "Eres Claramente, un tutor que conversa por voz con niños. El niño te está hablando. Escucha su duda sobre este texto: " + text.substring(0, 1000)
        }
      });
      liveSessionRef.current = await sessionPromise;
    } catch (err) {
      console.error(err);
      setIsListening(false);
    }
  };

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, isTyping]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-180px)]">
      <div className="lg:col-span-1 space-y-6 overflow-y-auto custom-scrollbar pr-4 pb-6">
        <div className="bg-white border-4 border-yellow-100 rounded-[3rem] p-8 shadow-xl">
          <div className="flex items-center gap-3 mb-6 text-yellow-600 font-black uppercase text-2xl italic tracking-tight">
            <Sparkles className="w-8 h-8" /> Resumen Mágico
          </div>
          {isLoadingContent ? (
            <div className="flex justify-center p-10"><Loader2 className="animate-spin text-yellow-400 w-12 h-12" /></div>
          ) : (
            <div className="space-y-4">
              {summary.map((p, i) => (
                <div key={i} className="bg-yellow-50 p-6 rounded-[2rem] text-lg border-2 border-yellow-100 font-bold text-yellow-900 leading-relaxed shadow-sm">
                  {p}
                </div>
              ))}
              <button 
                onClick={() => handleSpeak(999, summary.join(". "))}
                className="w-full mt-4 p-4 bg-yellow-400 text-yellow-900 rounded-2xl font-black flex items-center justify-center gap-3 hover:scale-105 transition-all shadow-lg"
              >
                <PlayCircle className="w-6 h-6" /> Escuchar resumen
              </button>
            </div>
          )}
        </div>

        <div className="bg-white border-4 border-purple-100 rounded-[3rem] p-8 shadow-xl">
          <div className="flex items-center gap-3 mb-6 text-purple-600 font-black uppercase text-2xl italic tracking-tight">
            <Brain className="w-8 h-8" /> Pregúntame esto
          </div>
          <div className="flex flex-col gap-4">
            {suggestedQuestions.map((q, i) => (
              <button 
                key={i} 
                onClick={() => handleSend(q)}
                className="bg-purple-50 text-purple-700 p-5 rounded-[1.5rem] text-sm font-black border-2 border-purple-100 hover:bg-purple-100 hover:scale-105 transition-all text-left shadow-sm flex items-center gap-4"
              >
                <MessageCircle className="w-6 h-6 shrink-0 opacity-40" />
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="lg:col-span-2 flex flex-col bg-white border-4 border-gray-100 rounded-[4rem] shadow-2xl overflow-hidden">
        <div ref={scrollRef} className="flex-1 p-10 overflow-y-auto space-y-8 custom-scrollbar bg-gray-50/50">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-4`}>
              <div className={`flex gap-5 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-14 h-14 rounded-[1.5rem] flex items-center justify-center shrink-0 shadow-xl ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-green-100 text-green-600'}`}>
                  {msg.role === 'user' ? <User className="w-8 h-8" /> : <Bot className="w-8 h-8" />}
                </div>
                <div className="relative group">
                  <div className={`p-8 rounded-[2.5rem] shadow-xl text-xl font-bold leading-relaxed ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border-2 border-white rounded-tl-none text-gray-800'}`}>
                    {msg.text}
                  </div>
                  {msg.role === 'model' && (
                    <button 
                      onClick={() => handleSpeak(idx, msg.text)} 
                      className={`absolute -right-16 top-0 p-5 rounded-full transition-all shadow-2xl ${speakingIdx === idx ? 'bg-red-500 text-white scale-110' : 'bg-white text-gray-400 border-2 border-gray-50 hover:text-green-500 hover:scale-110'}`}
                    >
                      {speakingIdx === idx ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex gap-4 p-5 items-center bg-white/70 w-fit rounded-full px-8 border-2 border-white shadow-sm">
              <Loader2 className="animate-spin text-blue-400 w-6 h-6" />
              <span className="text-sm font-black text-gray-400 uppercase tracking-widest italic animate-pulse">Claramente está pensando...</span>
            </div>
          )}
        </div>

        <div className="p-10 border-t-4 border-gray-50 bg-white">
          <div className="flex gap-6 items-center">
            <div className="relative flex-1">
              <input 
                type="text" 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                onKeyPress={(e) => e.key === 'Enter' && handleSend()} 
                className={`w-full p-8 rounded-[2.5rem] bg-gray-50 border-4 outline-none transition-all text-xl font-bold pr-20 ${isListening ? 'border-red-400 bg-red-50/50 shadow-inner' : 'border-gray-100 focus:border-blue-300 focus:bg-white'}`} 
                placeholder={isListening ? "Te escucho... ¡Háblame!" : "¿Qué quieres saber?"} 
              />
              <button 
                onClick={toggleListen}
                className={`absolute right-4 top-1/2 -translate-y-1/2 w-16 h-16 rounded-[1.5rem] transition-all flex items-center justify-center shadow-xl ${isListening ? 'bg-red-500 text-white animate-bounce' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'}`}
                title="Charla Mágica por Voz"
              >
                {isListening ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
              </button>
            </div>
            <button 
              onClick={() => handleSend()} 
              disabled={!input.trim() || isTyping}
              className={`w-20 h-20 rounded-[2.5rem] shadow-2xl transition-all active:scale-90 flex items-center justify-center ${!input.trim() || isTyping ? 'bg-gray-100 text-gray-300' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            >
              <Send className="w-10 h-10" />
            </button>
          </div>
          {isListening && (
            <div className="flex justify-center mt-6">
              <div className="flex gap-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="w-2 h-10 bg-red-400 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
