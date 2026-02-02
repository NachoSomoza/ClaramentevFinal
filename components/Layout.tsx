
import React, { useState } from 'react';
import { Home, ArrowLeft, ShieldCheck } from 'lucide-react';
import { AppMode } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  mode: AppMode;
  onNavigateHome: () => void;
  onBack: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, mode, onNavigateHome, onBack }) => {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white/70 backdrop-blur-md border-b border-blue-100 py-4 px-6 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div 
          className="flex items-center gap-3 cursor-pointer group"
          onClick={onNavigateHome}
        >
          <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center text-white shadow-md group-hover:rotate-6 transition-all">
            <span className="font-black text-2xl">C</span>
          </div>
          <div className="flex flex-col -space-y-1">
            <h1 className="text-2xl font-black tracking-tighter text-slate-800 group-hover:text-blue-600 transition-colors">Claramente</h1>
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">v5.4 Soft Sky</span>
          </div>
        </div>

        <nav className="flex items-center gap-3">
          {mode !== 'UPLOAD' && mode !== 'SELECTION' && (
            <button 
              onClick={onBack}
              className="flex items-center gap-2 px-4 py-2 text-blue-600 bg-white border border-blue-100 hover:border-blue-300 rounded-xl font-bold transition-all active:scale-95 shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Volver</span>
            </button>
          )}
          <button 
            onClick={onNavigateHome}
            className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 rounded-xl transition-all active:scale-95 shadow-sm"
            title="Inicio"
          >
            <Home className="w-6 h-6" />
          </button>
        </nav>
      </header>

      <main className="flex-1 w-full p-4 sm:p-8">
        {children}
      </main>

      <footer className="py-10 text-center flex flex-col items-center gap-4">
        <div className="inline-flex flex-col items-center gap-2">
          <p className="text-slate-400 font-bold text-[10px] tracking-[0.2em] uppercase">
            Compañero de Lectura Adaptativo
          </p>
          <div className="px-4 py-1 bg-white border border-slate-100 rounded-full text-slate-400 text-[9px] font-bold shadow-sm">
            TECNOLOGÍA GEMINI AI v3.0 | BUILD 2024.5.4
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-blue-400">
           <span className="text-slate-300">●</span>
           <button 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} 
            className="hover:text-blue-600 transition-colors"
           >
            Aviso Legal y Privacidad
           </button>
           <span className="text-slate-300">●</span>
        </div>
      </footer>
    </div>
  );
};
