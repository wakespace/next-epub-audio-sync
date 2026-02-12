/**
 * Unidade atômica de sincronização entre Áudio e Texto.
 * Representa um <par> do SMIL.
 */
export type SyncPair = {
  readonly elementId: string; // ID do elemento no XHTML (ex: "p001")
  readonly audioSrc: string;  // Caminho relativo do áudio (ex: "audio/track1.mp3")
  readonly start: number;     // Tempo de inicio em segundos (float)
  readonly end: number;       // Tempo de fim em segundos (float)
};

/**
 * O Capítulo "hidratado".
 * Contém o HTML para renderização e a Timeline sanitizada para lógica.
 */
export type ActiveChapter = {
  readonly id: string;           // ID do item no content.opf
  readonly title: string;        // Título legível
  readonly content: string;      // HTML String (sanitizado e processado)
  
  // A "Lei" do nosso sistema:
  // 1. Deve estar ordenado crescentemente por 'start'.
  // 2. Não deve ter sobreposições inválidas (sanitizado).
  // 3. Permite busca binária O(log n).
  readonly timeline: SyncPair[]; 

  // URL temporária para tocar o áudio extraído do ZIP na memória
  readonly audioBlobUrl: string | null;
};

/**
 * Representa um "Clip" extraído para exportação.
 */
export type AudioHighlight = {
  readonly chapterTitle: string;
  readonly timestamp: number;    // O momento exato do clique (ex: 125.5s)
  readonly rangeStart: number;   // timestamp - 30s
  readonly rangeEnd: number;     // timestamp + 30s
  readonly textSegments: string[]; // Texto extraído dos IDs encontrados
  readonly markdown: string;     // Texto formatado para Obsidian
  readonly createdAt: Date;
};