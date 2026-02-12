"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import { AudioSyncEngine } from "@/core/engine/AudioSyncEngine";
import { DomTextSource } from "@/infra/adapters/DomTextSource";
import { EpubParser } from "@/infra/services/EpubParser";
import { ActiveChapter } from "@/core/domain/models";

export default function Player() {
  const engine = useMemo(() => new AudioSyncEngine(), []);
  
  const [chapter, setChapter] = useState<ActiveChapter | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Carregar Capítulo Específico
  const loadChapter = async (file: File, index: number) => {
    try {
      setIsPlaying(false);
      const loadedChapter = await EpubParser.loadChapterByIndex(file, index);
      
      if (loadedChapter) {
        engine.loadChapter(loadedChapter);
        setChapter(loadedChapter);
        setCurrentChapterIndex(index);
      } else {
        alert("Fim do livro!");
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao carregar capítulo (veja console). Tente o próximo.");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setCurrentFile(file);
      // Carrega o primeiro capítulo (índice 0)
      loadChapter(file, 0);
    }
  };

  const nextChapter = () => {
    if (currentFile) loadChapter(currentFile, currentChapterIndex + 1);
  };

  const prevChapter = () => {
    if (currentFile && currentChapterIndex > 0) loadChapter(currentFile, currentChapterIndex - 1);
  };

  // Loop de Sync
// Loop de Sync (Versão Blindada com Estilo Inline)
  useEffect(() => {
    if (!isPlaying || !chapter) return;
    let animationFrameId: number;

    const syncLoop = () => {
      if (audioRef.current && contentRef.current) {
        const currentTime = audioRef.current.currentTime;
        
        // 1. Quem deve estar aceso?
        const activeId = engine.getActiveElementId(currentTime);

        // 2. Limpeza (Remove highlight anterior de QUALQUER elemento que tenha)
        // O seletor * pega todos os filhos, garantindo que achamos o anterior
        const prevs = contentRef.current.querySelectorAll("[data-highlight='true']");
        prevs.forEach(el => {
            (el as HTMLElement).style.backgroundColor = ""; // Remove cor inline
            el.removeAttribute("data-highlight"); // Remove marcador
        });

        // 3. Aplicação (Highlight)
        if (activeId) {
          // Busca segura pelo ID
          const el = contentRef.current.querySelector(`[id="${activeId}"]`);
          
          if (el) {
            // FORÇA BRUTA: Aplica amarelo diretamente no estilo do elemento
            (el as HTMLElement).style.backgroundColor = "#fef08a"; // Amarelo marca-texto
            (el as HTMLElement).style.transition = "background-color 0.3s";
            el.setAttribute("data-highlight", "true"); // Marca para facilitar limpeza
            
            // Auto-scroll suave
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          } else {
             // DIAGNÓSTICO CRÍTICO:
             // Se cair aqui, o ID existe no SMIL mas SUMIU do HTML renderizado
             if (Math.random() < 0.01) { // Log esporádico para não travar
                console.warn(`[DOM Error] O Engine pediu ID "${activeId}", mas ele não existe no HTML da tela!`);
             }
          }
        }
      }
      animationFrameId = requestAnimationFrame(syncLoop);
    };

    animationFrameId = requestAnimationFrame(syncLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, chapter, engine]);

  const handleClip = () => {
    if (!audioRef.current || !contentRef.current) return;
    const textSource = new DomTextSource(contentRef.current);
    const highlight = engine.createClip(audioRef.current.currentTime, textSource);
    
    // Download Log
    console.log("Clip Gerado:", highlight);
    
    const blob = new Blob([highlight.markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clip-${Date.now()}.md`;
    a.click();
  };

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto bg-white shadow-xl">
      <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
        <h1 className="font-bold text-lg">Verba Reader</h1>
        <input type="file" onChange={handleFileUpload} accept=".epub" />
      </div>
      
      <div className="flex-1 overflow-y-auto p-8 relative">
        <div 
          ref={contentRef}
          className="prose prose-lg max-w-none text-gray-800"
          dangerouslySetInnerHTML={{ __html: chapter?.content || "" }}
        />
        <div className="h-40"></div>
      </div>

{chapter && (
        <div className="border-t bg-white p-4 flex flex-col gap-4 shadow-lg">
          {/* Controles de Navegação */}
          <div className="flex justify-between text-sm text-gray-500 font-bold uppercase">
             <button onClick={prevChapter} disabled={currentChapterIndex === 0} className="hover:text-blue-600 disabled:opacity-30">
               &lt; Previous
             </button>
             <span>{chapter.title}</span>
             <button onClick={nextChapter} className="hover:text-blue-600">
               Next &gt;
             </button>
          </div>

          {/* SÓ MOSTRA O PLAYER SE TIVER URL DE ÁUDIO */}
          {chapter.audioBlobUrl ? (
            <>
              <div className="flex items-center gap-4 justify-center">
                <audio 
                  ref={audioRef} 
                  controls 
                  className="w-full"
                  src={chapter.audioBlobUrl} 
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={nextChapter}
                />
              </div>
              
              <div className="flex justify-center">
                <button 
                  onClick={handleClip}
                  className="bg-yellow-400 text-black px-8 py-3 rounded-full font-bold shadow hover:bg-yellow-500"
                >
                  CLIP CONTEXT (30s)
                </button>
              </div>
            </>
          ) : (
            <div className="text-center p-4 bg-gray-100 rounded text-gray-500 italic">
              Este capítulo não possui áudio. Avance para o próximo.
            </div>
          )}
        </div>
      )}
    </div>
  );
}