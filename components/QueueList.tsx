import React from 'react';
import { QueueItem, ProcessingStatus } from '../types';
import { FileText, CheckCircle, AlertCircle, Loader, Clock, Download, PlayCircle } from 'lucide-react';

interface QueueListProps {
  queue: QueueItem[];
  onDownload: (item: QueueItem) => void;
}

export const QueueList: React.FC<QueueListProps> = ({ queue, onDownload }) => {
  if (queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 rounded-2xl border-2 border-dashed border-slate-800 bg-slate-900/20 text-slate-500">
        <FileText className="w-10 h-10 mb-3 opacity-50" />
        <p>La cola está vacía.</p>
        <p className="text-sm">Sube archivos para comenzar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {queue.map((item) => (
        <div
          key={item.id}
          className={`relative overflow-hidden rounded-xl border p-5 transition-all duration-300 group ${
            item.status === ProcessingStatus.PROCESSING
              ? 'bg-slate-800/90 border-cyan-500/50 shadow-lg shadow-cyan-900/20 ring-1 ring-cyan-500/20'
              : item.status === ProcessingStatus.COMPLETED
              ? 'bg-slate-900/40 border-emerald-500/30 hover:border-emerald-500/50'
              : item.status === ProcessingStatus.ERROR
              ? 'bg-red-950/10 border-red-500/30'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          {/* Progress Bar for Processing */}
          {item.status === ProcessingStatus.PROCESSING && (
             <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-800">
               <div 
                 className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-700 ease-out" 
                 style={{ width: `${((item.currentPart - 1 + 0.1) / item.totalParts) * 100}%` }}
               />
             </div>
          )}

          <div className="flex items-center justify-between gap-4">
            {/* Left Side: Icon & Info */}
            <div className="flex items-center gap-4 overflow-hidden">
              <div className={`p-3 rounded-xl shrink-0 transition-colors ${
                item.status === ProcessingStatus.COMPLETED ? 'bg-emerald-500/10 text-emerald-400' :
                item.status === ProcessingStatus.PROCESSING ? 'bg-cyan-500/10 text-cyan-400' :
                item.status === ProcessingStatus.ERROR ? 'bg-red-500/10 text-red-400' :
                item.status === ProcessingStatus.IDLE ? 'bg-amber-500/10 text-amber-400' :
                'bg-slate-800 text-slate-400'
              }`}>
                {item.status === ProcessingStatus.COMPLETED && <CheckCircle className="w-6 h-6" />}
                {item.status === ProcessingStatus.PROCESSING && <Loader className="w-6 h-6 animate-spin" />}
                {item.status === ProcessingStatus.ERROR && <AlertCircle className="w-6 h-6" />}
                {item.status === ProcessingStatus.IDLE && <Clock className="w-6 h-6" />}
                {item.status === ProcessingStatus.PENDING && <PlayCircle className="w-6 h-6" />}
              </div>
              
              <div className="min-w-0">
                <h4 className="font-medium text-slate-200 truncate text-lg leading-tight">
                  {item.fileName}
                </h4>
                
                <div className="flex items-center gap-2 mt-1.5">
                  {item.status === ProcessingStatus.PROCESSING && (
                     <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                       Escribiendo Parte {item.currentPart}/{item.totalParts}
                     </span>
                  )}
                  {item.status === ProcessingStatus.COMPLETED && (
                    <span className="text-xs font-medium text-emerald-400">
                      Finalizado con éxito
                    </span>
                  )}
                  {item.status === ProcessingStatus.PENDING && (
                    <span className="text-xs text-slate-500">
                      Esperando confirmación...
                    </span>
                  )}
                  {item.status === ProcessingStatus.IDLE && (
                    <span className="text-xs text-amber-400">
                      En cola para procesar
                    </span>
                  )}
                  {item.status === ProcessingStatus.ERROR && (
                    <span className="text-xs text-red-400">
                      Fallo: {item.errorMessage}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Right Side: Actions */}
            <div className="flex items-center shrink-0">
               {item.status === ProcessingStatus.COMPLETED ? (
                  <button
                    onClick={() => onDownload(item)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg shadow-lg shadow-emerald-900/20 transition-all hover:-translate-y-0.5 active:translate-y-0"
                  >
                    <Download className="w-4 h-4" />
                    Descargar
                  </button>
               ) : item.status === ProcessingStatus.PROCESSING ? (
                  <div className="flex flex-col items-end">
                    <span className="text-2xl font-bold text-cyan-500 font-mono">
                      {Math.round(((item.currentPart - 1) / item.totalParts) * 100)}%
                    </span>
                  </div>
               ) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};