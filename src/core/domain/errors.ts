export class SmilParsingError extends Error {
  constructor(message: string, public file: string) {
    super(`[SMIL Parse Error] ${file}: ${message}`);
    this.name = "SmilParsingError";
  }
}

export class ChapterNotLoadedError extends Error {
  constructor() {
    super("Engine attempted to seek or clip without a loaded chapter.");
    this.name = "ChapterNotLoadedError";
  }
}