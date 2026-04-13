import React, { useState, useEffect, useRef } from 'react';
import { FileUpload } from './components/FileUpload';
import { QueueList } from './components/QueueList';
import { QueueItem, ProcessingStatus } from './types';
import { generateStoryPart } from './services/geminiService';
import { generateDocx, downloadBlob } from './services/docxService';
import { TOTAL_PARTS, SYSTEM_INSTRUCTION } from './constants';
import { Bot, Zap, Play, Download, FileText, X } from 'lucide-react';

const App: React.FC = () => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const isProcessingRef = useRef(false);
  // Store the beginning of completed stories to avoid repetition in the session
  const previousStoriesContextRef = useRef<string[]>([]);

  // Handle File Upload
  const handleFilesSelected = async (files: File[]) => {
    const newItems: QueueItem[] = [];

    for (const file of files) {
      const text = await file.text();
      newItems.push({
        id: crypto.randomUUID(),
        fileName: file.name,
        themeContent: text,
        status: ProcessingStatus.PENDING, // Initial state: Pending user approval
        currentPart: 1,
        totalParts: TOTAL_PARTS,
        generatedParts: [],
      });
    }

    setQueue((prev) => [...prev, ...newItems]);
  };

  // Start Processing (Move PENDING -> IDLE)
  const handleStartProcessing = () => {
    setQueue((prev) =>
      prev.map((item) =>
        item.status === ProcessingStatus.PENDING
          ? { ...item, status: ProcessingStatus.IDLE }
          : item
      )
    );
  };

  // Manual Download
  const handleDownload = async (item: QueueItem) => {
    if (!item.generatedParts.length) return;
    
    try {
      const docBlob = await generateDocx(item.generatedParts);
      const docName = item.fileName.replace('.txt', '') + '_Historia.docx';
      downloadBlob(docBlob, docName);
    } catch (error) {
      console.error("Error generating DOCX:", error);
      alert("Error al generar el archivo DOCX.");
    }
  };

  // Process Queue Effect
  useEffect(() => {
    const processNextItem = async () => {
      if (isProcessingRef.current) return;

      // Find next IDLE item (Queued by user)
      const nextItemIndex = queue.findIndex((item) => item.status === ProcessingStatus.IDLE);
      if (nextItemIndex === -1) return;

      isProcessingRef.current = true;

      // Update status to Processing
      setQueue((prev) =>
        prev.map((item, idx) =>
          idx === nextItemIndex ? { ...item, status: ProcessingStatus.PROCESSING } : item
        )
      );

      const item = queue[nextItemIndex];
      const currentParts = [...item.generatedParts];
      
      try {
        // Loop through parts 1 to 5
        for (let part = 1; part <= TOTAL_PARTS; part++) {
          // Update progress in UI
          setQueue((prev) =>
            prev.map((qItem) =>
              qItem.id === item.id ? { ...qItem, currentPart: part } : qItem
            )
          );

          console.log(`Generating Part ${part} for ${item.fileName}...`);
          
          const generatedText = await generateStoryPart(
            item.themeContent,
            part,
            currentParts,
            previousStoriesContextRef.current // Pass the context of previous stories to avoid repetition
          );
          
          // If this is part 1, add it to the global context context to prevent future repetition
          if (part === 1) {
             const snippet = generatedText.substring(0, 500);
             previousStoriesContextRef.current.push(snippet);
          }
          
          currentParts.push(generatedText);

          // Random delay to be nice to the API rate limits
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        // Mark complete (Manual download required now)
        setQueue((prev) =>
          prev.map((qItem) =>
            qItem.id === item.id
              ? {
                  ...qItem,
                  status: ProcessingStatus.COMPLETED,
                  generatedParts: currentParts,
                  currentPart: TOTAL_PARTS,
                }
              : qItem
          )
        );
      } catch (err: any) {
        console.error("Processing error:", err);
        
        // --- ERROR HANDLING LOGIC ---
        let finalErrorMessage = "Error desconocido.";
        const rawError = err.message || JSON.stringify(err);

        if (rawError.includes("429") || rawError.includes("RESOURCE_EXHAUSTED") || rawError.includes("quota")) {
          finalErrorMessage = "⚠️ Límite de Cuota Alcanzado. La API gratuita pausó temporalmente. Espera unos minutos.";
        } else if (rawError.includes("503") || rawError.includes("overloaded")) {
          finalErrorMessage = "⚠️ Servidores de Google sobrecargados. Intenta de nuevo.";
        } else if (rawError.includes("SAFETY")) {
          finalErrorMessage = "⚠️ Bloqueo de Seguridad (Safety Filter). El tema puede haber violado las reglas.";
        } else {
          // If it's a huge JSON blob but not one of the above, simplify it
          if (rawError.includes("{") && rawError.length > 50) {
             finalErrorMessage = "Error técnico en la API (Verifica la consola).";
          } else {
             finalErrorMessage = rawError.substring(0, 120); // Truncate long messages
          }
        }
        
        setQueue((prev) =>
          prev.map((qItem) =>
            qItem.id === item.id
              ? {
                  ...qItem,
                  status: ProcessingStatus.ERROR,
                  errorMessage: finalErrorMessage,
                }
              : qItem
          )
        );
      } finally {
        isProcessingRef.current = false;
      }
    };

    processNextItem();
  }, [queue]); 

  const pendingCount = queue.filter(i => i.status === ProcessingStatus.PENDING).length;
  const isProcessing = queue.some(i => i.status === ProcessingStatus.PROCESSING);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-cyan-500/30 font-sans relative">
      <div className="max-w-5xl mx-auto px-6 py-12">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 border-b border-slate-800 pb-8">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-3.5 rounded-2xl shadow-lg shadow-cyan-500/20 ring-1 ring-white/10">
              <Bot className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400 tracking-tight">
                StoryForge AI <span className="text-sm font-normal text-cyan-400 ml-2">(ES)</span>
              </h1>
              <p className="text-slate-400 text-sm flex items-center gap-1.5 mt-1">
                Procesador por Lotes v2.1 <span className="text-slate-600">|</span> Powered by Gemini 3 Pro 
                <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <button
              onClick={() => setIsPromptOpen(true)}
              className="flex items-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl transition-all hover:text-white border border-slate-700 hover:border-slate-600"
            >
              <FileText className="w-5 h-5" />
              <span>Ver Prompt</span>
            </button>

            {pendingCount > 0 && (
              <button
                onClick={handleStartProcessing}
                disabled={isProcessing}
                className="group flex items-center gap-3 px-6 py-3 bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-cyan-900/20 hover:shadow-cyan-500/30 hover:-translate-y-0.5"
              >
                {isProcessing ? (
                  <Zap className="w-5 h-5 animate-pulse" />
                ) : (
                  <Play className="w-5 h-5 fill-current" />
                )}
                <span>
                  {isProcessing ? 'Procesando Cola...' : `Iniciar Escritura (${pendingCount})`}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column: Upload */}
          <div className="lg:col-span-1 space-y-6">
            <div className="sticky top-8">
              <h2 className="text-lg font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <span className="bg-slate-800 w-6 h-6 rounded-full flex items-center justify-center text-xs text-slate-400 border border-slate-700">1</span>
                Carga de Temas
              </h2>
              <FileUpload onFilesSelected={handleFilesSelected} />
              
              <div className="mt-6 p-4 rounded-xl bg-slate-900/50 border border-slate-800 text-sm text-slate-400 space-y-2">
                <p className="font-medium text-slate-300">Instrucciones:</p>
                <ul className="list-disc list-inside space-y-1 marker:text-cyan-500">
                  <li>Sube archivos <code>.txt</code></li>
                  <li>Haz clic en "Iniciar Escritura" arriba</li>
                  <li>Espera la generación (aprox. 3 min/historia)</li>
                  <li>Descarga el DOCX finalizado</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Right Column: Queue */}
          <div className="lg:col-span-2">
             <h2 className="text-lg font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <span className="bg-slate-800 w-6 h-6 rounded-full flex items-center justify-center text-xs text-slate-400 border border-slate-700">2</span>
                Cola de Procesamiento
              </h2>
             <QueueList queue={queue} onDownload={handleDownload} />
          </div>
        </div>
      </div>

      {/* Prompt Modal Overlay */}
      {isPromptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                 <FileText className="w-6 h-6 text-cyan-500" />
                 <h3 className="text-xl font-bold text-white">Prompt del Sistema (Configuración Actual)</h3>
              </div>
              <button 
                onClick={() => setIsPromptOpen(false)} 
                className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar">
              <pre className="font-mono text-sm text-slate-300 leading-relaxed whitespace-pre-wrap bg-slate-950/50 p-6 rounded-xl border border-slate-800/50">
                {SYSTEM_INSTRUCTION}
              </pre>
            </div>
            <div className="p-4 border-t border-slate-800 bg-slate-900/50 rounded-b-2xl flex justify-end shrink-0">
               <button 
                onClick={() => setIsPromptOpen(false)}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors"
               >
                 Cerrar
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;