"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { openDataIconOptions } from "@/lib/open-data-constants";
import { OpenDataIcon } from "@/components/open-data/OpenDataIcon";

type Props = {
  name?: string;
  value: string;
  onChange: (nextIcon: string) => void;
  disabled?: boolean;
};

export function OpenDataIconPicker({
  name = "icon",
  value,
  onChange,
  disabled = false,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const normalizedValue = value.trim().toLowerCase();
  const currentOption =
    openDataIconOptions.find((opt) => opt.value === normalizedValue) ?? {
      value: value || "database",
      label: value || "База данных",
    };

  useEffect(() => {
    if (!isOpen) return;

    const handleOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen]);

  const query = search.trim().toLowerCase();
  const filtered = query
    ? openDataIconOptions.filter(
        (opt) =>
          opt.label.toLowerCase().includes(query) ||
          opt.value.toLowerCase().includes(query)
      )
    : openDataIconOptions;

  return (
    <div
      ref={containerRef}
      className={`opendata-icon-picker ${isOpen ? "is-open" : ""}`}
    >
      <input type="hidden" name={name} value={value} />

      <button
        type="button"
        className="opendata-icon-picker-trigger"
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
      >
        <span className="opendata-icon-picker-current">
          <span className="opendata-icon-preview-tile">
            <OpenDataIcon name={value} size={16} />
          </span>
          <span className="opendata-icon-picker-meta">
            <strong>{currentOption.label}</strong>
            <code>{currentOption.value}</code>
          </span>
        </span>
        <ChevronDown className="wp-custom-select-icon" size={15} aria-hidden="true" />
      </button>

      {isOpen ? (
        <div className="opendata-icon-picker-popover">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск иконки (экология, климат, leaf...)"
            className="opendata-icon-picker-search"
            autoFocus
          />

          <div className="opendata-icon-picker-grid" role="listbox" aria-label="Выбор иконки">
            {filtered.map((opt) => {
              const selected = opt.value === normalizedValue;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`opendata-icon-option ${selected ? "is-selected" : ""}`}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setSearch("");
                  }}
                >
                  <OpenDataIcon name={opt.value} size={16} />
                  <span>{opt.label}</span>
                </button>
              );
            })}
            {filtered.length === 0 ? (
              <p className="opendata-field-hint" style={{ gridColumn: "1 / -1", padding: "8px 4px" }}>
                Подходящие иконки не найдены.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
