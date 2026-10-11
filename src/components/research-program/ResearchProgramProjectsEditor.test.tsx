// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ search: vi.fn(), save: vi.fn() }));
vi.mock("@/server/actions/research-program-projects.actions", () => ({ searchResearchProgramProjects: mocks.search, saveResearchProgramProjects: mocks.save }));
import { ResearchProgramProjectsEditor } from "./ResearchProgramProjectsEditor";
const graph = { version: 4, workIds: ["project"], participants: [{ workId: "project", applicationId: "application", scientistId: "scientist" }], applications: [{ id: "application", name: "Applicant <script>", status: "accepted" as const }] };
const project = { id: "project", title: "Selected project", status: "draft" as const, members: [{ id: "scientist", name: "Scientist" }] };
let container: HTMLDivElement, root: Root;
beforeEach(() => { vi.clearAllMocks(); (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
const value = () => JSON.parse(String(new FormData(container.querySelector("form")!).get("projects")));
async function click(label: string) { const button = [...container.querySelectorAll("button")].find(b => b.textContent === label); expect(button).toBeDefined(); await act(async () => button!.click()); }
async function select(index: number, value: string) { await act(async () => { const s = container.querySelectorAll("select")[index]; s.value = value; s.dispatchEvent(new Event("change", { bubbles: true })); }); }
describe("program project editor", () => {
  it("renders application names safely and removes dependent assignments with the project", async () => {
    await act(async () => root.render(<ResearchProgramProjectsEditor programId="program" graph={graph} options={[project]} />));
    expect(container.querySelector("script")).toBeNull(); expect(value()).toMatchObject({ expectedVersion: 4, participants: graph.participants });
    await click("Удалить проект"); expect(value()).toMatchObject({ workIds: [], participants: [] });
  });
  it("retains selected projects across search pages, uses fresh member options and catches network failure", async () => {
    await act(async () => root.render(<ResearchProgramProjectsEditor programId="program" graph={graph} options={[project]} />));
    mocks.search.mockResolvedValueOnce({ ok: true, options: [] }); await click("Найти проект");
    expect(container.textContent).toContain("Selected project"); expect(value().workIds).toEqual(["project"]);
    mocks.search.mockResolvedValueOnce({ ok: true, options: [{ ...project, title: "Updated project" }] }); await click("Найти проект");
    expect(container.textContent).toContain("Updated project");
    mocks.search.mockRejectedValueOnce(new Error("Network")); await click("Найти проект");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Повторите попытку"); expect(value().participants).toEqual(graph.participants);
  });
  it("assigns accepted applications to project members and prevents duplicates", async () => {
    await act(async () => root.render(<ResearchProgramProjectsEditor programId="program" graph={{ ...graph, participants: [] }} options={[project]} />));
    await select(0, "project"); await select(1, "application"); await select(2, "scientist"); await click("Назначить участника");
    expect(value().participants).toEqual(graph.participants);
    await select(1, "application"); await select(2, "scientist");
    expect([...container.querySelectorAll("button")].find(b => b.textContent === "Назначить участника")?.disabled).toBe(true);
    await click("Удалить назначение"); expect(value().participants).toEqual([]);
  });
  it("allows inaccessible legacy links to be removed", async () => {
    await act(async () => root.render(<ResearchProgramProjectsEditor programId="program" graph={graph} options={[]} />));
    expect(container.textContent).toContain("Проект недоступен");
    await click("Удалить проект"); expect(value().workIds).toEqual([]);
  });
});
