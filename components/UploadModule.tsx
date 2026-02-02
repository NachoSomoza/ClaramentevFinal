
import React, { useRef, useState } from 'react';
import { Upload, Loader2, AlertCircle, BookOpen, X, ShieldCheck, Lock } from 'lucide-react';
import { extractTextFromMedia } from '../services/geminiService';

interface UploadModuleProps {
  onTextExtracted: (text: string, fileName: string) => void;
}

export const UploadModule: React.FC<UploadModuleProps> = ({ onTextExtracted }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showLegal, setShowLegal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!acceptedTerms) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);
    setLoadingPhase("Abriendo archivo...");

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const result = event.target?.result as string;
          if (!result) throw new Error("No se pudo leer el archivo.");
          
          const base64Data = result.split(',')[1];
          const mimeType = file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
          
          setLoadingPhase("Extrayendo texto con IA...");
          const extractedText = await extractTextFromMedia(base64Data, mimeType);
          
          if (!extractedText || extractedText.trim().length < 5) {
            throw new Error("No pudimos extraer texto legible de este archivo. Por favor, intenta de nuevo o prueba con otro archivo.");
          }
          
          onTextExtracted(extractedText, file.name);
        } catch (innerErr: any) {
          console.error("Error detallado:", innerErr);
          if (innerErr.message?.includes("overloaded")) {
            setError("El sistema está un poco cansado (servidor sobrecargado). Por favor, intenta de nuevo en unos segundos.");
          } else if (innerErr.message?.includes("API key not valid")) {
            setError("Hay un problema con la clave de acceso. Por favor, asegúrate de estar conectado correctamente.");
          } else {
            setError(innerErr.message || "No pudimos procesar este documento.");
          }
          setIsUploading(false);
        }
      };
      reader.onerror = () => {
        setError("Error al leer el archivo desde el dispositivo.");
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError("Hubo un problema al iniciar la subida.");
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 animate-in fade-in duration-700">
      <div className="text-center mb-10">
        <h2 className="text-4xl font-black text-gray-800 mb-4 tracking-tight">¡Hola! Vamos a leer</h2>
        <p className="text-xl text-gray-500 font-medium">Sube un PDF o una foto de tu libro favorito.</p>
      </div>

      <div className={`mb-10 p-6 rounded-[2.5rem] border-2 transition-all duration-300 ${acceptedTerms ? 'bg-indigo-50 border-indigo-200' : 'bg-amber-50 border-amber-200 shadow-lg shadow-amber-500/5'}`}>
        <label className="flex items-start gap-5 cursor-pointer group">
          <div className="relative flex items-center mt-1 scale-125">
            <input 
              type="checkbox" 
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="peer h-6 w-6 cursor-pointer appearance-none rounded-md border-2 border-amber-400 transition-all checked:border-indigo-500 checked:bg-indigo-500"
            />
            <ShieldCheck className="absolute w-4 h-4 text-white left-1 opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold text-slate-800 leading-tight">
              He leído y acepto el <button onClick={(e) => { e.preventDefault(); setShowLegal(true); }} className="text-indigo-600 font-black underline decoration-2 underline-offset-4 hover:text-indigo-700">Aviso Legal y la Política de Privacidad</button>.
            </span>
            <span className="text-sm text-slate-500 mt-2 font-medium leading-snug">
              Entiendo que Claramente es una herramienta de apoyo pedagógico y no un tratamiento médico.
            </span>
          </div>
        </label>
      </div>

      <div 
        className={`relative border-4 border-dashed rounded-[3.5rem] p-16 text-center transition-all duration-500 ${
          !acceptedTerms ? 'opacity-40 grayscale cursor-not-allowed bg-slate-100 border-slate-200' :
          isUploading ? 'border-indigo-400 bg-indigo-50 shadow-inner' : 'border-indigo-200 hover:border-indigo-400 bg-white hover:bg-indigo-50/30 shadow-xl shadow-indigo-500/5'
        }`}
      >
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".pdf,image/*"
          className={`absolute inset-0 w-full h-full opacity-0 ${acceptedTerms ? 'cursor-pointer' : 'cursor-not-allowed'}`}
          disabled={isUploading || !acceptedTerms}
        />
        
        <div className="flex flex-col items-center">
          {isUploading ? (
            <>
              <div className="relative mb-8">
                <Loader2 className="w-24 h-24 text-indigo-500 animate-spin" />
                <BookOpen className="w-10 h-10 text-indigo-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>
              <p className="text-3xl font-black text-indigo-600 mb-3 tracking-tighter">{loadingPhase}</p>
              <p className="text-gray-400 font-medium italic">"Los robots están leyendo página por página..."</p>
            </>
          ) : (
            <>
              {!acceptedTerms && <Lock className="w-12 h-12 text-amber-400 mb-4 animate-bounce" />}
              <div className={`w-28 h-28 ${acceptedTerms ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-400'} rounded-[2.5rem] flex items-center justify-center mb-8 shadow-lg transition-transform hover:scale-105`}>
                <Upload className="w-14 h-14" />
              </div>
              <p className={`text-3xl font-black mb-3 ${acceptedTerms ? 'text-slate-800' : 'text-slate-400'}`}>
                {acceptedTerms ? '¡Toca para elegir!' : 'Acepta los términos primero'}
              </p>
              <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">PDF o Fotos de tu libro</p>
            </>
          )}
        </div>
      </div>

      {showLegal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-8">
          <div className="bg-white w-full max-w-3xl max-h-[85vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-indigo-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500 text-white rounded-xl"><ShieldCheck className="w-6 h-6" /></div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">Compromiso Claramente</h3>
              </div>
              <button onClick={() => setShowLegal(false)} className="p-2 hover:bg-white rounded-full transition-colors"><X className="w-6 h-6 text-slate-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 md:p-12 custom-scrollbar text-slate-700 space-y-8 font-medium leading-relaxed">
              <section>
                <h4 className="text-xl font-black text-indigo-600 mb-4">Aviso Legal, Política de Privacidad y Compromiso Ético</h4>
                <div className="space-y-6">
                  <div>
                    <h5 className="font-black text-slate-800">1. Naturaleza de la Herramienta</h5>
                    <p>Claramente es una plataforma tecnológica de apoyo diseñada para mejorar la accesibilidad a la lectura mediante Inteligencia Artificial.</p>
                    <p className="mt-2 font-bold">No es un dispositivo médico: El sistema no proporciona diagnósticos clínicos ni constituye un tratamiento médico.</p>
                  </div>
                  <div>
                    <h5 className="font-black text-slate-800">2. Uso de IA y Precisión</h5>
                    <p>Las funciones de resumen y generación visual son automatizadas. La IA puede generar imprecisiones.</p>
                  </div>
                  <div>
                    <h5 className="font-black text-slate-800">4. Privacidad (Ley 25.326)</h5>
                    <p>No Almacenamiento Permanente: Las fotos o PDFs se eliminan en un máximo de 48 horas.</p>
                  </div>
                </div>
              </section>

              <div className="bg-indigo-50 p-6 rounded-2xl border-2 border-indigo-100 flex flex-col items-center text-center gap-4">
                 <p className="font-black text-indigo-800">¿Deseas aceptar estos términos y empezar a leer?</p>
                 <button 
                  onClick={() => { setAcceptedTerms(true); setShowLegal(false); }}
                  className="px-10 py-4 bg-indigo-600 text-white font-black rounded-full shadow-lg hover:bg-indigo-700 transition-all active:scale-95"
                 >
                   He leído y acepto todo
                 </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-10 p-8 bg-red-50 border-4 border-red-100 rounded-[2.5rem] flex items-start gap-6 text-red-700 shadow-xl animate-in slide-in-from-bottom-4">
          <div className="bg-red-500 p-3 rounded-2xl text-white shadow-lg">
             <AlertCircle className="w-8 h-8 flex-shrink-0" />
          </div>
          <div>
            <p className="font-black text-2xl mb-1">¡Vaya! Algo pasó:</p>
            <p className="text-lg opacity-80 font-medium">{error}</p>
            <button 
              onClick={() => setError(null)} 
              className="mt-4 px-6 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl font-bold transition-colors"
            >
              Intentar otra vez
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
