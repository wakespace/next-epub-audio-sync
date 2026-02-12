import { ActiveChapter, SyncPair, AudioHighlight } from "../domain/models";

/**
 * Abstração para ler texto.
 * Permite que o Core funcione sem saber o que é um "document" ou "HTMLElement".
 */
export interface ITextSource {
  getTextById(id: string): string | null;
}

/**
 * Contrato para o Motor de Sincronização.
 */
export interface IAudioSyncEngine {
  loadChapter(chapter: ActiveChapter): void;
  getActiveElementId(currentTime: number): string | null;
  getSyncPairAt(currentTime: number): SyncPair | null;
}

/**
 * Contrato para o Motor de Captura (O "Clip").
 */
export interface IClipEngine {
  createClip(
    currentTime: number, 
    textSource: ITextSource
  ): AudioHighlight;
}