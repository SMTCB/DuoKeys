// US-3.21 — a radio group drawn as a row of pills. Real radio inputs underneath
// (keyboard and screen readers work); the selected pill is filled and also
// carries a tick, so colour is never the only cue (NFR-008).

import styles from './Segmented.module.css';

export function Segmented<T extends string | number>({
  name,
  legend,
  options,
  value,
  onChange,
}: {
  name: string;
  legend: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.row}>
        {options.map((o) => (
          <label key={String(o.value)} className={styles.option}>
            <input
              type="radio"
              name={name}
              value={String(o.value)}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            <span className={styles.pill}>
              {value === o.value ? '✓ ' : ''}
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
