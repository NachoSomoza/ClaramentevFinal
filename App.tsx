
import React, { useState } from 'react';
import { AppState, AppMode } from './types';
import { Layout } from './components/Layout';
import { UploadModule } from './components/UploadModule';
import { AdaptiveReader } from './components/AdaptiveReader';
import { ExplainMode } from './components/ExplainMode';
import { ComicMode } from './components/ComicMode';
import { VideoNarrado } from './components/VideoNarrado';
import { MODULE_CARDS } from './constants';
import { Sparkles, ArrowRight } from 'lucide-react';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    text: '',
    isProcessing: false,
    mode: 'UPLOAD'
  });

  const handleTextExtracted = (text: string, fileName: string) => {
    setState({ ...state, text, originalFileName: fileName, mode: 'SELECTION' });
  };

  const renderContent = () => {
    switch (state.mode) {
      case 'UPLOAD': 
        return <UploadModule onTextExtracted={handleTextExtracted} />;
      
      case 'SELECTION':
        return (
          <div className="max-w-5xl mx-auto py-8 px-4">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-100 text-blue-700 font-bold text-xs uppercase tracking-widest mb-4 shadow-sm">
                <Sparkles className="w-4 h-4" />
                <span>Texto Procesado</span>
              </div>
              <h2 className="text-5xl font-black text-slate-800 tracking-tight mb-3">¿Cómo quieres leer hoy?</h2>
              <p className="text-slate-500 text-lg max-w-xl mx-auto">Tu historia está lista. Elige una experiencia mágica abajo.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {MODULE_CARDS.map((card) => (
                <button
                  key={card.id}
                  onClick={() => !card.disabled && setState(prev => ({ ...prev, mode: card.id as AppMode }))}
                  className={`group relative p-8 text-left rounded-[2.5rem] border-2 transition-all duration-300 ${
                    card.disabled 
                      ? 'opacity-40 grayscale cursor-not-allowed border-slate-100 bg-slate-50/50' 
                      : `bg-white border-slate-100 hover:border-blue-400 hover:bg-white hover:-translate-y-1 shadow-md hover:shadow-xl`
                  }`}
                >
                  <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-6 group-hover:bg-blue-500 group-hover:text-white transition-all">
                    {React.cloneElement(card.icon as any, { className: "w-8 h-8" })}
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 mb-2 tracking-tight">{card.title}</h3>
                  <p className="text-slate-500 text-base mb-6 leading-relaxed font-medium">{card.description}</p>
                  
                  {!card.disabled && (
                    <div className="flex items-center gap-2 font-black text-blue-500 text-lg group-hover:gap-4 transition-all">
                      <span>Empezar</span>
                      <ArrowRight className="w-5 h-5" />
                    </div>
                  )}
                </button>
              ))}
            </div>
            
            <div className="mt-12 text-center">
              <button 
                onClick={() => setState({ ...state, mode: 'UPLOAD', text: '' })}
                className="px-8 py-3 border border-slate-200 text-slate-400 font-bold rounded-full hover:border-blue-400 hover:text-blue-500 transition-all uppercase text-[10px] tracking-[0.2em]"
              >
                Cargar otro archivo
              </button>
            </div>
          </div>
        );

      case 'READER': return <AdaptiveReader text={state.text} />;
      case 'EXPLAIN': return <ExplainMode text={state.text} />;
      case 'COMIC': return <ComicMode text={state.text} />;
      case 'VIDEO': return <VideoNarrado text={state.text} />;
      default: return <UploadModule onTextExtracted={handleTextExtracted} />;
    }
  };

  return (
    <Layout 
      mode={state.mode} 
      onNavigateHome={() => setState({ ...state, mode: 'UPLOAD', text: '' })}
      onBack={() => setState(prev => ({ ...prev, mode: state.mode === 'SELECTION' ? 'UPLOAD' : 'SELECTION' }))}
    >
      {renderContent()}
    </Layout>
  );
};

export default App;
