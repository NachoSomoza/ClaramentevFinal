import React from 'react';
import { Home, ArrowLeft, Globe } from 'lucide-react';
import { AppMode, Language } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  mode: AppMode;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onNavigateHome: () => void;
  onBack: () => void;
}

const LANGUAGES = [
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' }
];

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  mode, 
  language, 
  onLanguageChange, 
  onNavigateHome, 
  onBack 
}) => {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white/70 backdrop-blur-md border-b border-indigo-100 py-4 px-6 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div 
          className="flex items-center gap-3 cursor-pointer group"
          onClick={onNavigateHome}
        >
          <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white shadow-md group-hover:rotate-6 transition-all">
            <span className="font-black text-2xl">C</span>
          </div>
          <div className="hidden md:flex flex-col -space-y-1">
            <h1 className="text-2xl font-black tracking-tighter text-slate-800 group-hover:text-indigo-600 transition-colors">Claramente</h1>
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">v5.5 Multi-Lang</span>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => onLanguageChange(lang.code as Language)}
                className={`w-10 h-10 flex items-center justify-center rounded-lg text-lg transition-all ${
                  language === lang.code 
                    ? 'bg-white shadow-sm scale-110' 
                    : 'opacity-40 hover:opacity-100 grayscale hover:grayscale-0'
                }`}
                title={lang.label}
              >
                {lang.flag}
              </button>
            ))}
          </div>

          <nav className="flex items-center gap-2">
            {mode !== 'UPLOAD' && mode !== 'SELECTION' && (
              <button 
                onClick={onBack}
                className="flex items-center gap-2 px-3 py-2 text-indigo-600 bg-white border border-indigo-100 hover:border-indigo-300 rounded-xl font-bold transition-all active:scale-95 shadow-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Atrás</span>
              </button>
            )}
            <button 
              onClick={onNavigateHome}
              className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 rounded-xl transition-all active:scale-95 shadow-sm"
            >
              <Home className="w-6 h-6" />
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 w-full p-4 sm:p-8">
        {children}
      </main>

      <footer className="py-10 text-center flex flex-col items-center gap-4">
        <div className="inline-flex flex-col items-center gap-2">
          <p className="text-slate-400 font-bold text-[10px] tracking-[0.2em] uppercase">
            Compañero de Lectura Adaptativo
          </p>
          <div className="px-4 py-1 bg-white border border-indigo-50 rounded-full text-slate-400 text-[9px] font-bold shadow-sm">
            TECNOLOGÍA GEMINI AI v3.0 | MULTI-LANGUAGE 5.5
          </div>
        </div>
      </footer>
    </div>
  );
};