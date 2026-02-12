import { ITextSource } from "@/core/ports/engine";

export class DomTextSource implements ITextSource {
  constructor(private rootElement: HTMLElement) {}

  getTextById(id: string): string | null {
    // Busca apenas dentro do elemento raiz do livro para evitar conflitos
    const element = this.rootElement.querySelector(`[id="${id}"]`);
    
    if (!element) return null;

    // innerText é inteligente: 
    // - Ignora tags <style> e <script>
    // - Respeita display:none
    // - Formata quebras de linha visualmente
    return (element as HTMLElement).innerText; 
  }
}