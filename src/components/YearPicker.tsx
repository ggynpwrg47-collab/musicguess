import { useEffect, useId, useState } from 'react';
import { maxYear, MIN_YEAR } from '../lib/years';

interface Props {
  value: number | null;
  onChange: (year: number) => void;
  label: string;
  disabled?: boolean;
}

const clampYear = (y: number) => Math.min(maxYear(), Math.max(MIN_YEAR, Math.round(y)));

export function YearPicker({ value, onChange, label, disabled }: Props) {
  const id = useId();
  const current = value ?? 1990;
  const step = (d: number) => onChange(clampYear(current + d));
  // Entwurf erlaubt das Tippen unvollständiger Jahreszahlen („19…“), übernommen wird nur ein gültiges Jahr.
  const [draft, setDraft] = useState(value === null ? '' : String(value));
  useEffect(() => setDraft(value === null ? '' : String(value)), [value]);
  return (
    <div className="year-picker">
      <label htmlFor={id} className="year-picker__label">
        {label}
      </label>
      <div className="year-picker__row">
        <button type="button" className="btn btn--ghost" onClick={() => step(-10)} disabled={disabled} aria-label="10 Jahre früher">
          −10
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => step(-1)} disabled={disabled} aria-label="1 Jahr früher">
          −1
        </button>
        <input
          id={id}
          className="year-picker__input"
          type="number"
          inputMode="numeric"
          min={MIN_YEAR}
          max={maxYear()}
          value={draft}
          placeholder="Jahr"
          disabled={disabled}
          onChange={(e) => {
            setDraft(e.target.value);
            const n = parseInt(e.target.value, 10);
            if (e.target.value.length === 4 && Number.isFinite(n) && n >= MIN_YEAR && n <= maxYear()) onChange(n);
          }}
          onBlur={() => setDraft(value === null ? '' : String(value))}
        />
        <button type="button" className="btn btn--ghost" onClick={() => step(1)} disabled={disabled} aria-label="1 Jahr später">
          +1
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => step(10)} disabled={disabled} aria-label="10 Jahre später">
          +10
        </button>
      </div>
      <input
        type="range"
        className="year-picker__range"
        min={1940}
        max={maxYear()}
        value={Math.max(1940, current)}
        disabled={disabled}
        aria-label={`${label} (Schieberegler)`}
        onChange={(e) => onChange(+e.target.value)}
      />
    </div>
  );
}
