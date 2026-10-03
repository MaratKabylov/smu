import { afterEach, describe, expect, it, vi } from "vitest";
import { ArticleAutosave, type SaveResult } from "./autosave";

afterEach(() => vi.useRealTimers());

describe("article autosave", () => {
  it("debounces edits and saves the most recent form once", async () => {
    vi.useFakeTimers();
    let title = "First title";
    const capture = () => { const form = new FormData(); form.set("titleRu", title); return form; };
    const write = vi.fn().mockResolvedValue({ ok: true, id: "article", version: 2 });
    const save = new ArticleAutosave(1, capture, write, vi.fn(), true);
    save.changed(); await vi.advanceTimersByTimeAsync(800);
    title = "Latest title"; save.changed(); await vi.advanceTimersByTimeAsync(1199);
    expect(write).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(write).toHaveBeenCalledOnce();
    expect(write.mock.calls[0][0].get("titleRu")).toBe("Latest title");
    expect(write.mock.calls[0][0].get("expectedVersion")).toBe("1");
    expect(save.hasUnsavedChanges).toBe(false);
    save.dispose();
  });
  it("serializes writes and preserves edits made while the previous save is running", async () => {
    vi.useFakeTimers();
    let finish!: (result: SaveResult) => void;
    const notify = vi.fn();
    const write = vi.fn().mockImplementationOnce(() => new Promise<SaveResult>(resolve => { finish = resolve; }))
      .mockResolvedValueOnce({ ok: true, id: "article", version: 3 });
    const save = new ArticleAutosave(1, () => new FormData(), write, notify, true);
    save.changed(); const first = save.save();
    save.changed(); const concurrent = save.save();
    expect(write).toHaveBeenCalledOnce(); expect(save.isSaving).toBe(true);
    finish({ ok: true, id: "article", version: 2 }); await Promise.all([first, concurrent]);
    expect(save.hasUnsavedChanges).toBe(true);
    expect(notify).toHaveBeenLastCalledWith({ status: "dirty" }, { ok: true, id: "article", version: 2 });
    await vi.advanceTimersByTimeAsync(1200);
    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[1][0].get("expectedVersion")).toBe("2");
    expect(save.hasUnsavedChanges).toBe(false); save.dispose();
  });
  it("keeps failed changes dirty and retries with the same version", async () => {
    const write = vi.fn().mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValueOnce({ ok: true, id: "article", version: 2 });
    const save = new ArticleAutosave(1, () => new FormData(), write, vi.fn(), false);
    save.changed(); expect(await save.save()).toEqual({ ok: false, error: "action_failed" });
    expect(save.hasUnsavedChanges).toBe(true);
    await save.save(); expect(write.mock.calls[1][0].get("expectedVersion")).toBe("1");
    expect(save.hasUnsavedChanges).toBe(false); save.dispose();
  });
  it("stops retries after a version conflict and retains the local edits", async () => {
    vi.useFakeTimers();
    const write = vi.fn().mockResolvedValue({ ok: false, error: "stale_version" });
    const notify = vi.fn();
    const save = new ArticleAutosave(1, () => new FormData(), write, notify, true);
    save.changed(); await save.save(); save.changed();
    await vi.advanceTimersByTimeAsync(10000); await save.save();
    expect(write).toHaveBeenCalledOnce(); expect(save.hasUnsavedChanges).toBe(true);
    expect(notify).toHaveBeenLastCalledWith({ status: "error", error: "stale_version" }, { ok: false, error: "stale_version" });
    save.dispose();
  });
  it("cancels pending saves when the editor unmounts", async () => {
    vi.useFakeTimers(); const write = vi.fn();
    const save = new ArticleAutosave(1, () => new FormData(), write, vi.fn(), true);
    save.changed(); save.dispose(); await vi.advanceTimersByTimeAsync(2000);
    expect(write).not.toHaveBeenCalled();
  });
  it("starts autosaving only after the initial explicit save of a new or non-draft article", async () => {
    vi.useFakeTimers(); const write = vi.fn().mockResolvedValue({ ok: true, id: "article", version: 1 });
    const save = new ArticleAutosave(undefined, () => new FormData(), write, vi.fn(), false);
    save.changed(); await vi.advanceTimersByTimeAsync(2000); expect(write).not.toHaveBeenCalled();
    await save.save(); expect(write).toHaveBeenCalledOnce();
    save.changed(); await vi.advanceTimersByTimeAsync(1200); expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[1][0].get("expectedVersion")).toBe("1"); save.dispose();
  });
});
