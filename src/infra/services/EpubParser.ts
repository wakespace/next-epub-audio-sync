import JSZip from "jszip";
import { ActiveChapter, SyncPair } from "@/core/domain/models";

export class EpubParser {
  static async loadChapterByIndex(file: File, spineIndex: number): Promise<ActiveChapter | null> {
    console.log(`[Parser] Carregando capítulo índice: ${spineIndex}`);
    const zip = await JSZip.loadAsync(file);
    
    // 1. Achar OPF
    const opfPath = Object.keys(zip.files).find(f => f.endsWith(".opf"));
    if (!opfPath) throw new Error("OPF not found");
    
    const opfContent = await zip.file(opfPath)!.async("string");
    const parser = new DOMParser();
    const opfDoc = parser.parseFromString(opfContent, "application/xml");

    // 2. Ler o SPINE
    const spineItems = Array.from(opfDoc.querySelectorAll("spine > itemref"));
    if (spineIndex >= spineItems.length) return null; // Fim do livro

    const idRef = spineItems[spineIndex].getAttribute("idref");
    if (!idRef) throw new Error("Itemref sem idref");

    // 3. Achar o ITEM no Manifesto
    const item = opfDoc.querySelector(`manifest > item[id="${idRef}"]`);
    if (!item) throw new Error(`Item ${idRef} not found in manifest`);

    const href = item.getAttribute("href");
    const mediaOverlayId = item.getAttribute("media-overlay");

    // 4. Carregar HTML (Sempre existe)
    const htmlPath = this.resolvePath(zip, href!);
    if (!htmlPath) throw new Error("Arquivo HTML não encontrado no ZIP");
    
    const htmlContent = await zip.file(htmlPath)!.async("string");
    
    // 5. Lógica Condicional de Áudio
    let timeline: SyncPair[] = [];
    let audioBlobUrl: string | null = null;

    if (mediaOverlayId) {
      // Tem áudio! Vamos carregar o SMIL
      const smilItem = opfDoc.querySelector(`manifest > item[id="${mediaOverlayId}"]`);
      if (smilItem) {
        const smilHref = smilItem.getAttribute("href");
        const smilPath = this.resolvePath(zip, smilHref!);
        
        if (smilPath) {
          const smilContent = await zip.file(smilPath)!.async("string");
          const result = await this.parseSmilAndExtractAudio(smilContent, zip);
          timeline = result.timeline;
          audioBlobUrl = result.audioBlobUrl;
        }
      }
    } else {
      console.log("[Parser] Capítulo sem áudio (Text-Only). Carregando apenas texto.");
    }

    // 6. Sanitizar HTML
    const htmlDoc = parser.parseFromString(htmlContent, "application/xhtml+xml");
    const cleanHtml = htmlDoc.body.innerHTML;

    return {
      id: idRef,
      title: `Chapter ${spineIndex + 1}`, // Melhoria futura: pegar título do TOC
      content: cleanHtml,
      timeline,
      audioBlobUrl
    };
  }

  private static resolvePath(zip: JSZip, href: string): string | undefined {
    const filename = href.split('/').pop(); 
    return Object.keys(zip.files).find(f => f.endsWith(filename!));
  }

  private static async parseSmilAndExtractAudio(smilContent: string, zip: JSZip) {
    const doc = new DOMParser().parseFromString(smilContent, "application/xml");
    const pairs: SyncPair[] = [];
    const pars = doc.querySelectorAll("par");

    const audioEl = doc.querySelector("audio");
    let audioBlobUrl: string | null = null;

    if (audioEl) {
      const src = audioEl.getAttribute("src");
      if (src) {
        const audioPath = this.resolvePath(zip, src);
        if (audioPath) {
          const blob = await zip.file(audioPath)!.async("blob");
          audioBlobUrl = URL.createObjectURL(blob);
        }
      }
    }

    pars.forEach(par => {
      const text = par.querySelector("text");
      const audio = par.querySelector("audio");

      if (text && audio) {
        const src = text.getAttribute("src") || "";
        const elementId = src.includes("#") ? src.split("#").pop()! : src; 
        
        const start = this.parseSmilTime(audio.getAttribute("clipBegin"));
        const end = this.parseSmilTime(audio.getAttribute("clipEnd"));

        if (elementId && !isNaN(start) && !isNaN(end)) {
          pairs.push({
            elementId,
            audioSrc: audio.getAttribute("src")!,
            start,
            end
          });
        }
      }
    });

    return { timeline: pairs, audioBlobUrl };
  }

  private static parseSmilTime(timeStr: string | null): number {
    if (!timeStr) return 0;
    const t = timeStr.trim();
    if (!t.includes(":")) return parseFloat(t.replace("s", ""));
    const parts = t.split(":");
    const seconds = parseFloat(parts.pop() || "0");
    const minutes = parseFloat(parts.pop() || "0");
    const hours = parseFloat(parts.pop() || "0");
    return (hours * 3600) + (minutes * 60) + seconds;
  }
}