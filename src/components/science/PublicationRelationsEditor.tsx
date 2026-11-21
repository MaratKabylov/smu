"use client";

import { startTransition, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Search, Trash2, UserPlus, Users, X, Link as LinkIcon, AlertCircle } from "lucide-react";
import { searchArticleRelations } from "@/server/actions/article-relations.actions";
import type { ArticleRelationOption } from "@/types/domain/article-relations";
import type { PublicationCoauthor } from "@/types/domain/publication";

export function PublicationRelationsEditor({
  coauthors: initialAuthors = [],
  workIds: initialWorkIds = [],
  scientists: initialScientists = [],
  works: initialWorks = [],
}: {
  coauthors?: PublicationCoauthor[];
  workIds?: string[];
  scientists?: ArticleRelationOption[];
  works?: ArticleRelationOption[];
}) {
  const [authors, setAuthors] = useState(initialAuthors);
  const [workIds, setWorkIds] = useState(initialWorkIds);
  const [scientists, setScientists] = useState(initialScientists);
  const [works, setWorks] = useState(initialWorks);
  const [scientistQuery, setScientistQuery] = useState("");
  const [workQuery, setWorkQuery] = useState("");
  const [scientistId, setScientistId] = useState("");
  const [workId, setWorkId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const search = (target: "scientist" | "work") => {
    setPending(true);
    setError("");
    startTransition(async () => {
      try {
        if (target === "scientist") {
          const result = await searchArticleRelations("scientist", scientistQuery);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setScientists((previous) => [
            ...result.options,
            ...previous.filter(
              (item) => authors.some((a) => a.scientistId === item.entityId) && !result.options.some((found) => found.entityId === item.entityId)
            ),
          ]);
        } else {
          const research = await searchArticleRelations("research", workQuery);
          const projects = await searchArticleRelations("project", workQuery);
          if (!research.ok || !projects.ok) {
            setError("Не удалось загрузить научные работы.");
            return;
          }
          const options = [...research.options, ...projects.options];
          setWorks((previous) => [
            ...options,
            ...previous.filter((item) => workIds.includes(item.entityId) && !options.some((found) => found.entityId === item.entityId)),
          ]);
        }
      } catch {
        setError("Не удалось выполнить поиск. Повторите попытку.");
      } finally {
        setPending(false);
      }
    });
  };

  const move = (index: number, offset: number) =>
    setAuthors((previous) => {
      const next = [...previous];
      [next[index], next[index + offset]] = [next[index + offset], next[index]];
      return next;
    });

  return (
    <div className="publication-relations-container">
      <input type="hidden" name="coauthors" value={JSON.stringify(authors)} />
      {error ? (
        <p role="alert" className="notice error-notice">
          {error}
        </p>
      ) : null}

      {/* COAUTHORS SECTION */}
      <div className="pub-relations-subgroup">
        <div className="pub-subgroup-header">
          <div className="pub-subgroup-title">
            <Users size={16} aria-hidden="true" />
            <span>Соавторы публикации ({authors.length})</span>
          </div>
          <span className="pub-subgroup-hint">Указываются в библиографическом порядке</span>
        </div>

        <div className="pub-search-row">
          <label className="pub-search-field">
            <span className="visually-hidden">Поиск соавтора RU / KK</span>
            <Search size={15} aria-hidden="true" />
            <input
              value={scientistQuery}
              maxLength={120}
              placeholder="Поиск соавтора RU / KK..."
              onChange={(e) => setScientistQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  search("scientist");
                }
              }}
            />
          </label>
          <button
            type="button"
            className="secondary-button"
            disabled={pending}
            onClick={() => search("scientist")}
          >
            Найти соавтора
          </button>
        </div>

        <div className="pub-add-author-bar">
          <label className="pub-select-label">
            <span className="visually-hidden">Профиль соавтора</span>
            <select
              value={scientistId}
              onChange={(e) => setScientistId(e.target.value)}
              className="pub-select-control"
            >
              <option value="">Выберите учёного из каталога</option>
              {scientists
                .filter((s) => !authors.some((a) => a.scientistId === s.entityId))
                .map((s) => (
                  <option key={s.entityId} value={s.entityId}>
                    {s.titleRu} / {s.titleKk}
                  </option>
                ))}
            </select>
          </label>
          <button
            type="button"
            className="secondary-button"
            disabled={!scientistId || authors.length >= 30}
            onClick={() => {
              setAuthors([...authors, { scientistId, name: "", affiliation: "" }]);
              setScientistId("");
            }}
          >
            <Plus size={14} aria-hidden="true" />
            Добавить соавтора
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={authors.length >= 30}
            onClick={() => setAuthors([...authors, { scientistId: null, name: "", affiliation: "" }])}
          >
            <UserPlus size={14} aria-hidden="true" />
            Добавить внешнего автора
          </button>
        </div>

        {authors.length > 0 ? (
          <ol className="relation-options pub-authors-list">
            {authors.map((author, index) => {
              const profile = author.scientistId
                ? scientists.find((s) => s.entityId === author.scientistId)
                : null;
              return (
                <li key={index} className="pub-author-card">
                  <span className="pub-author-order">#{index + 1}</span>
                  <div className="pub-author-info">
                    {author.scientistId ? (
                      <div className="pub-verified-author">
                        <span className="pub-author-badge">Учёный платформы</span>
                        <strong className="pub-author-name">
                          {profile?.titleRu ?? "Профиль недоступен — удалите или замените связь"}
                        </strong>
                      </div>
                    ) : (
                      <div className="form-two-columns pub-external-author-inputs">
                        <label>
                          <span className="wp-field-label">Имя внешнего автора *</span>
                          <input
                            required
                            minLength={2}
                            maxLength={240}
                            placeholder="ФИО автора"
                            value={author.name}
                            onChange={(e) =>
                              setAuthors(
                                authors.map((a, i) =>
                                  i === index ? { ...a, name: e.target.value } : a
                                )
                              )
                            }
                          />
                        </label>
                        <label>
                          <span className="wp-field-label">Организация внешнего автора</span>
                          <input
                            maxLength={240}
                            placeholder="Институт, университет, компания"
                            value={author.affiliation}
                            onChange={(e) =>
                              setAuthors(
                                authors.map((a, i) =>
                                  i === index ? { ...a, affiliation: e.target.value } : a
                                )
                              )
                            }
                          />
                        </label>
                      </div>
                    )}
                  </div>
                  <div className="preview-links pub-author-actions">
                    <button
                      type="button"
                      disabled={index === 0}
                      aria-label={"Переместить автора " + (index + 1) + " выше"}
                      onClick={() => move(index, -1)}
                      title="Выше"
                      className="pub-icon-btn"
                    >
                      <ArrowUp size={14} aria-hidden="true" />
                      Выше
                    </button>
                    <button
                      type="button"
                      disabled={index === authors.length - 1}
                      aria-label={"Переместить автора " + (index + 1) + " ниже"}
                      onClick={() => move(index, 1)}
                      title="Ниже"
                      className="pub-icon-btn"
                    >
                      <ArrowDown size={14} aria-hidden="true" />
                      Ниже
                    </button>
                    <button
                      type="button"
                      aria-label={"Удалить автора " + (index + 1)}
                      onClick={() => setAuthors(authors.filter((_, i) => i !== index))}
                      title="Удалить"
                      className="pub-icon-btn pub-delete-btn"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                      Удалить
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="pub-empty-subgroup">Соавторы пока не добавлены. Основной автор указывается отдельно выше.</div>
        )}
      </div>

      {/* LINKED RESEARCH & PROJECTS SECTION */}
      <div className="pub-relations-subgroup">
        <div className="pub-subgroup-header">
          <div className="pub-subgroup-title">
            <LinkIcon size={16} aria-hidden="true" />
            <span>Связанные исследования и проекты ({workIds.length})</span>
          </div>
          <span className="pub-subgroup-hint">Исследования платформы, результатом которых стала публикация</span>
        </div>

        <div className="pub-search-row">
          <label className="pub-search-field">
            <span className="visually-hidden">Поиск исследования или проекта RU / KK</span>
            <Search size={15} aria-hidden="true" />
            <input
              value={workQuery}
              maxLength={120}
              placeholder="Поиск исследования или проекта RU / KK..."
              onChange={(e) => setWorkQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  search("work");
                }
              }}
            />
          </label>
          <button
            type="button"
            className="secondary-button"
            disabled={pending}
            onClick={() => search("work")}
          >
            Найти научную работу
          </button>
        </div>

        <div className="pub-add-author-bar">
          <label className="pub-select-label">
            <span className="visually-hidden">Исследование / проект</span>
            <select
              value={workId}
              onChange={(e) => setWorkId(e.target.value)}
              className="pub-select-control"
            >
              <option value="">Выберите исследование или проект</option>
              {works
                .filter((w) => !workIds.includes(w.entityId))
                .map((w) => (
                  <option key={w.entityId} value={w.entityId}>
                    {w.kind === "project" ? "Проект" : "Исследование"}: {w.titleRu} / {w.titleKk}
                  </option>
                ))}
            </select>
          </label>
          <button
            type="button"
            className="secondary-button"
            disabled={!workId || workIds.length >= 20}
            onClick={() => {
              setWorkIds([...workIds, workId]);
              setWorkId("");
            }}
          >
            <Plus size={14} aria-hidden="true" />
            Связать работу
          </button>
        </div>

        {workIds.length > 0 ? (
          <ul className="relation-options pub-works-list">
            {workIds.map((id) => {
              const work = works.find((w) => w.entityId === id);
              const isProject = work?.kind === "project";
              return (
                <li key={id} className="pub-work-card">
                  <input type="hidden" name="workIds" value={id} />
                  <span className={`stage-badge ${isProject ? "stage-active" : "stage-completed"}`}>
                    {isProject ? "Проект" : "Исследование"}
                  </span>
                  <span className="pub-work-title">
                    {work?.titleRu ?? "Работа недоступна — удалите или замените связь"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setWorkIds(workIds.filter((value) => value !== id))}
                    className="pub-remove-link-btn"
                  >
                    <X size={14} aria-hidden="true" />
                    Убрать связь
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="pub-empty-subgroup">Связанные исследования не указаны.</div>
        )}
      </div>

      <p className="field-hint">
        Доступны проверенные публичные профили и опубликованные научные работы. Уточните запрос для поиска за пределами первых 50 результатов каждого типа.
      </p>
    </div>
  );
}
