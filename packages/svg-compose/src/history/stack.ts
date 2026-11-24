/**
 * Snapshot command stack over the live document.
 *
 * The DOM is the source of truth, so an undo entry is just the serialized
 * document before a mutation: lossless by construction, and cheap enough for
 * icon-sized documents.
 */
export class HistoryStack {
  private past: string[] = [];
  private future: string[] = [];

  constructor(
    private readonly read: () => string,
    private readonly write: (snapshot: string) => void,
    private readonly limit = 80,
  ) {}

  /** Call *before* mutating the document. */
  checkpoint(): void {
    this.past.push(this.read());
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  undo(): boolean {
    const snapshot = this.past.pop();
    if (snapshot === undefined) return false;
    this.future.push(this.read());
    this.write(snapshot);
    return true;
  }

  redo(): boolean {
    const snapshot = this.future.pop();
    if (snapshot === undefined) return false;
    this.past.push(this.read());
    this.write(snapshot);
    return true;
  }

  clear(): void {
    this.past = [];
    this.future = [];
  }
}
