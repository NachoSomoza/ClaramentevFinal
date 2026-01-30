import React, { useRef, useState } from 'react';
import { Upload, File, Loader2, AlertCircle, Image as ImageIcon, BookOpen } from 'lucide-react';
import { extractTextFromMedia } from '../services/geminiService';

interface UploadModuleProps {
  onTextExtracted: (text: string, fileName: string) => void;
}

export const UploadModule: React.FC<UploadModuleProps> = ({ onTextExtracted }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
          
          onTextExtracted(extractedText, file.name);
        } catch (innerErr: any) {
          console.error("Error detallado:", innerErr);
          setError(innerErr.message || "No pudimos procesar este documento.");
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
        <p className="text-xl text-gray-500">Sube un PDF o una foto de tu libro favorito.</p>
      </div>

      <div 
        className={`relative border-4 border-dashed rounded-[3.5rem] p-16 text-center transition-all duration-500 ${
          isUploading ? 'border-blue-400 bg-blue-50 shadow-inner' : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50/30'
        }`}
      >
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".pdf,image/*"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isUploading}
        />
        
        <div className="flex flex-col items-center">
          {isUploading ? (
            <>
              <div className="relative mb-8">
                <Loader2 className="w-24 h-24 text-blue-500 animate-spin" />
                <BookOpen className="w-10 h-10 text-blue-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>
              <p className="text-3xl font-black text-blue-600 mb-3">{loadingPhase}</p>
              <p className="text-gray-400 font-medium italic">"Los robots están leyendo página por página..."</p>
            </>
          ) : (
            <>
              <div className="w-28 h-28 bg-blue-100 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-sm transition-transform hover:rotate-6">
                <Upload className="w-14 h-14 text-blue-600" />
              </div>
              <p className="text-3xl font-black text-gray-800 mb-3">Toca para elegir</p>
              <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">PDF o Fotos</p>
            </>
          )}
        </div>
      </div>

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

      <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { icon: <File className="text-blue-500 w-10 h-10" />, label: "Libros PDF" },
          { icon: <ImageIcon className="text-purple-500 w-10 h-10" />, label: "Fotos de Textos" },
          { icon: <BookOpen className="text-orange-500 w-10 h-10" />, label: "Cuentos" }
        ].map((item, idx) => (
          <div key={idx} className="flex flex-col items-center p-8 bg-white rounded-[2.5rem] shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-2 transition-all duration-300">
            <div className="mb-4">{item.icon}</div>
            <span className="font-black text-gray-700 uppercase tracking-tighter">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};