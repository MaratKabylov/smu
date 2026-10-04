"use client";

import type { ArticleAuthor, ArticleAuthorLink } from "@/types/domain/article";
import { articleAuthorRoles } from "@/types/domain/article";
import { articleAuthorRoleLabels } from "@/lib/articles/presentation";

export function ArticleAuthorsEditor({ authors, value, onChange, disabled }: {
  authors: ArticleAuthor[]; value: ArticleAuthorLink[];
  onChange: (value: ArticleAuthorLink[]) => void; disabled: boolean;
}) {
  function move(index: number, offset: number) {
    const next = [...value];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    onChange(next);
  }
  return <fieldset className="tag-fieldset" disabled={disabled}>
    <legend>Авторы и участники материала</legend>
    <input type="hidden" name="authors" value={JSON.stringify(value)} />
    <p className="field-hint">Порядок в списке определяет порядок подписей. Авторство не предоставляет права доступа к статье.</p>
    <div className="article-credit-list">
      {value.map((link, index) => <div className="article-credit-row" key={link.authorId}>
        <span>{index + 1}. {authors.find(author => author.id === link.authorId)?.nameRu ?? "Недоступный автор"}</span>
        <label>Роль<select value={link.role} onChange={event => onChange(value.map((item, i) => i === index ? { ...item, role: event.target.value as ArticleAuthorLink["role"] } : item))}>
          {articleAuthorRoles.map(role => <option value={role} key={role}>{articleAuthorRoleLabels.ru[role]}</option>)}
        </select></label>
        <button type="button" className="secondary-button" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Поднять автора ${index + 1}`}>↑</button>
        <button type="button" className="secondary-button" disabled={index === value.length - 1} onClick={() => move(index, 1)} aria-label={`Опустить автора ${index + 1}`}>↓</button>
        <button type="button" className="secondary-button" onClick={() => onChange(value.filter((_, i) => i !== index))}>Убрать</button>
      </div>)}
    </div>
    <label>Добавить автора<select value="" disabled={value.length >= 20 || disabled} onChange={event => {
      if (event.target.value) onChange([...value, { authorId: event.target.value, role: value.length ? "coauthor" : "author" }]);
    }}>
      <option value="">Выберите из справочника</option>
      {authors.filter(author => author.isActive && !value.some(link => link.authorId === author.id)).map(author => <option value={author.id} key={author.id}>{author.nameRu} / {author.nameKk}</option>)}
    </select></label>
  </fieldset>;
}
