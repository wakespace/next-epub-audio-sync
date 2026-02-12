import { IAudioSyncEngine, IClipEngine, ITextSource } from "../ports/engine";
import { ActiveChapter, SyncPair, AudioHighlight } from "../domain/models";
import { ChapterNotLoadedError } from "../domain/errors";

export class AudioSyncEngine implements IAudioSyncEngine, IClipEngine {
  private currentChapter: ActiveChapter | null = null;

  // Carrega e Sanitiza (Ordenação + Validação)
  public loadChapter(chapter: ActiveChapter): void {
    // Clona e Ordena por START para garantir Busca Binária
    const sortedTimeline = [...chapter.timeline].sort((a, b) => a.start - b.start);

    // Validação básica de sobreposições (Apenas Log por enquanto)
    this.validateNoOverlaps(sortedTimeline);

    this.currentChapter = {
      ...chapter,
      timeline: sortedTimeline,
    };
  }

  // Busca Binária O(log n) para High Frequency updates (60fps)
  public getActiveElementId(currentTime: number): string | null {
    const pair = this.getSyncPairAt(currentTime);
    return pair ? pair.elementId : null;
  }

  public getSyncPairAt(currentTime: number): SyncPair | null {
    if (!this.currentChapter) return null;

    const timeline = this.currentChapter.timeline;
    let left = 0;
    let right = timeline.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const pair = timeline[mid];

      // Verifica se o tempo está DENTRO do intervalo do par
      if (currentTime >= pair.start && currentTime <= pair.end) {
        return pair;
      }

      if (currentTime < pair.start) {
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }

    return null;
  }

 // Feature: Clip Context (15s back + 15s forward = 30s Total)
  public createClip(currentTime: number, textSource: ITextSource): AudioHighlight {
    if (!this.currentChapter) throw new ChapterNotLoadedError();

    // AJUSTE: Buffer reduzido para 15 segundos
    const rangeStart = Math.max(0, currentTime - 15);
    const rangeEnd = currentTime + 15;

    // OTIMIZAÇÃO: Usa Busca Binária para achar onde começar a ler
    const startIndex = this.findFirstIndexWhereEndGreaterOrEqual(rangeStart);

    const relevantPairs: SyncPair[] = [];
    
    if (startIndex !== -1) {
      for (let i = startIndex; i < this.currentChapter.timeline.length; i++) {
        const pair = this.currentChapter.timeline[i];
        
        if (pair.start > rangeEnd) break;

        relevantPairs.push(pair);
      }
    }

    const textSegments = relevantPairs
      .map((p) => textSource.getTextById(p.elementId))
      .filter((t): t is string => t !== null && t.trim().length > 0);

    // AJUSTE: Lógica do label visual também muda de 30 para 15
    const contextLabel = currentTime < 15
      ? `Chapter start - ${this.formatTime(rangeEnd)}`
      : `${this.formatTime(rangeStart)} - ${this.formatTime(rangeEnd)}`;

    const markdown = [
      `# Clip from ${this.currentChapter.title}`,
      `**Timestamp:** ${this.formatTime(currentTime)}`,
      `**Context:** ${contextLabel}`,
      `---`,
      ...textSegments.map(t => `> ${t}\n`),
      `---`
    ].join("\n");

    return {
      chapterTitle: this.currentChapter.title,
      timestamp: currentTime,
      rangeStart,
      rangeEnd,
      textSegments,
      markdown,
      createdAt: new Date(),
    };
  }

  // Algoritmo: Leftmost Binary Search
  // Encontra o PRIMEIRO índice onde pair.end >= targetTime
  private findFirstIndexWhereEndGreaterOrEqual(targetTime: number): number {
    if (!this.currentChapter) return -1;
    
    const timeline = this.currentChapter.timeline;
    let left = 0;
    let right = timeline.length - 1;
    let result = -1;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      
      if (timeline[mid].end >= targetTime) {
        result = mid;     // Candidato válido
        right = mid - 1;  // Tenta achar um anterior (mais à esquerda)
      } else {
        left = mid + 1;
      }
    }
    
    return result;
  }

  private validateNoOverlaps(timeline: SyncPair[]): void {
    for (let i = 0; i < timeline.length - 1; i++) {
      // Se o atual termina DEPOIS do próximo começar... temos sobreposição.
      if (timeline[i].end > timeline[i + 1].start) {
        console.warn(
          `[AudioSyncEngine] Overlap detected: ${timeline[i].elementId} ends at ${timeline[i].end}s ` +
          `but ${timeline[i + 1].elementId} starts at ${timeline[i + 1].start}s`
        );
      }
    }
  }

  private formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}