export type SaveResult = { ok: true; id: string; version: number } | { ok: false; error: string };
export type SaveState = { status: "saved" | "dirty" | "saving" | "error"; error?: string };

// Serialize writes and track edits made while a request is in flight.
export class ArticleAutosave {
  private edits = 0;
  private savedEdits = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private running?: Promise<SaveResult>;
  private stopped = false;
  private conflict = false;
  constructor(
    private version: number | undefined,
    private readonly capture: () => FormData,
    private readonly write: (data: FormData) => Promise<SaveResult>,
    private readonly notify: (state: SaveState, result?: SaveResult) => void,
    private automatic: boolean,
  ) {}
  get hasUnsavedChanges() { return this.edits !== this.savedEdits || !!this.running; }
  get isSaving() { return !!this.running; }
  changed() {
    if (this.stopped) return;
    this.edits++;
    if (!this.running && !this.conflict) this.notify({ status: "dirty" });
    this.schedule();
  }
  private schedule() {
    clearTimeout(this.timer);
    if (this.automatic && !this.stopped && !this.conflict)
      this.timer = setTimeout(() => { void this.save(); }, 1200);
  }
  async save(): Promise<SaveResult> {
    clearTimeout(this.timer);
    if (this.running) return this.running;
    if (this.conflict) return { ok: false, error: "stale_version" };
    const data = this.capture();
    if (this.version) data.set("expectedVersion", String(this.version));
    const snapshot = this.edits;
    this.notify({ status: "saving" });
    this.running = this.write(data).catch((): SaveResult => ({ ok: false, error: "action_failed" }));
    const result = await this.running;
    this.running = undefined;
    if (result.ok) {
      this.version = result.version;
      this.savedEdits = snapshot;
      // Every content write returns the article to draft. Subsequent edits can
      // be autosaved, including edits made during the initial manual save.
      this.automatic = true;
    } else if (result.error === "stale_version") this.conflict = true;
    if (!this.stopped) {
      this.notify({ status: result.ok ? (this.edits === snapshot ? "saved" : "dirty") : "error", ...(!result.ok ? { error: result.error } : {}) }, result);
      if (result.ok && this.edits !== snapshot) this.schedule();
    }
    return result;
  }
  dispose() { this.stopped = true; clearTimeout(this.timer); }
}
