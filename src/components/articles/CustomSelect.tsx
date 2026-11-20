"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, Check } from "lucide-react";

export type CustomSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type CustomSelectProps = {
  name?: string;
  id?: string;
  value?: string;
  defaultValue?: string;
  options: CustomSelectOption[];
  disabled?: boolean;
  placeholder?: string;
  onChange?: (value: string) => void;
  className?: string;
  ariaLabel?: string;
};

export function CustomSelect({
  name,
  id,
  value,
  defaultValue,
  options,
  disabled = false,
  placeholder,
  onChange,
  className = "",
  ariaLabel,
}: CustomSelectProps) {
  const [internalValue, setInternalValue] = useState<string>(() => {
    if (value !== undefined) return value;
    if (defaultValue !== undefined) return defaultValue;
    return options[0]?.value ?? "";
  });

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentValue = value !== undefined ? value : internalValue;
  const selectedOption = options.find((opt) => opt.value === currentValue);

  // Close when clicked outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (nextValue: string) => {
    if (value === undefined) {
      setInternalValue(nextValue);
    }
    setIsOpen(false);
    onChange?.(nextValue);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;

    if (e.key === "Escape") {
      setIsOpen(false);
      return;
    }

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsOpen((prev) => !prev);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      const currentIndex = options.findIndex((opt) => opt.value === currentValue);
      const nextIndex = currentIndex < options.length - 1 ? currentIndex + 1 : 0;
      const nextOption = options[nextIndex];
      if (nextOption && !nextOption.disabled) {
        handleSelect(nextOption.value);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      const currentIndex = options.findIndex((opt) => opt.value === currentValue);
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : options.length - 1;
      const prevOption = options[prevIndex];
      if (prevOption && !prevOption.disabled) {
        handleSelect(prevOption.value);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className={`wp-custom-select ${isOpen ? "is-open" : ""} ${disabled ? "is-disabled" : ""} ${className}`}
      onKeyDown={handleKeyDown}
    >
      {/* Underlying select for full form data & SSR test compatibility */}
      <select
        name={name}
        id={id}
        value={currentValue}
        onChange={(e) => handleSelect(e.target.value)}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        style={{ display: "none" }}
        className="wp-custom-select-native"
      >
        {options.map((opt, idx) => (
          <option key={opt.value || `opt-${idx}`} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Modern styled trigger */}
      <button
        type="button"
        className="wp-custom-select-trigger"
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
      >
        <span className="wp-custom-select-current-text">
          {selectedOption ? (
            (() => {
              const parts = selectedOption.label.split(" / ");
              if (parts.length > 1) {
                return (
                  <span className="wp-custom-select-trigger-label">
                    <span className="wp-custom-select-trigger-primary">{parts[0]}</span>
                    <span className="wp-custom-select-trigger-sep">/</span>
                    <span className="wp-custom-select-trigger-secondary">{parts.slice(1).join(" / ")}</span>
                  </span>
                );
              }
              return selectedOption.label;
            })()
          ) : (
            placeholder || "Выберите значение"
          )}
        </span>
        <ChevronDown className="wp-custom-select-icon" size={15} aria-hidden="true" />
      </button>

      {/* Styled Dropdown Menu */}
      {isOpen ? (
        <div className="wp-custom-select-popover">
          <ul className="wp-custom-select-menu" role="listbox">
            {options.map((opt, idx) => {
              const isSelected = opt.value === currentValue;
              const parts = opt.label.split(" / ");
              const primary = parts[0];
              const secondary = parts.length > 1 ? parts.slice(1).join(" / ") : null;

              return (
                <li
                  key={opt.value || `item-${idx}`}
                  role="option"
                  aria-selected={isSelected}
                  className={`wp-custom-select-item ${isSelected ? "is-selected" : ""} ${opt.disabled ? "is-disabled" : ""}`}
                  onClick={() => {
                    if (opt.disabled) return;
                    handleSelect(opt.value);
                  }}
                >
                  <div className="wp-custom-select-item-content">
                    <span className="wp-custom-select-item-primary">{primary}</span>
                    {secondary ? (
                      <span className="wp-custom-select-item-secondary">{secondary}</span>
                    ) : null}
                  </div>
                  {isSelected ? (
                    <Check size={16} className="wp-custom-select-check" aria-hidden="true" />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
