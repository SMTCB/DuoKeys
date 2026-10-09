// US-3.21 — the "choose your piano" step shared by every play screen. Picture
// tile + title + one big button per device + a connection line that says its
// state in words as well as a dot (NFR-008).

import { useT } from '../i18n/useT';
import styles from './MidiChooser.module.css';

export function MidiChooser({
  inputs,
  connectionState,
  onSelect,
}: {
  inputs: ReadonlyArray<{ id: string; name: string }>;
  connectionState: string;
  onSelect: (inputId: string) => void;
}) {
  const t = useT();
  return (
    <div className={styles.chooser}>
      <div className={styles.lead}>
        <span className={styles.keys} aria-hidden="true">
          <svg width="30" height="30" viewBox="0 0 30 30" focusable="false">
            <rect x="2" y="5" width="26" height="20" rx="3" fill="var(--cream)" stroke="currentColor" strokeWidth="2" />
            <path d="M10.7 5v20M19.3 5v20" stroke="currentColor" strokeWidth="2" />
            <rect x="8.2" y="5" width="5" height="11" rx="1" fill="currentColor" />
            <rect x="16.8" y="5" width="5" height="11" rx="1" fill="currentColor" />
          </svg>
        </span>
        <span className={styles.title}>{inputs.length > 0 ? t('Tap your piano to start') : t('Choose your piano')}</span>
      </div>
      <div className={styles.list}>
        {inputs.map((input) => (
          <button key={input.id} type="button" className={styles.device} onClick={() => onSelect(input.id)}>
            {input.name}
            <span className={styles.play} aria-hidden="true">
              ▶
            </span>
          </button>
        ))}
      </div>
      <span className={styles.status}>
        <span className={`${styles.dot} ${connectionState === 'connected' ? styles.dotOn : ''}`} aria-hidden="true" />
        {connectionState === 'connected'
          ? t('Piano connected')
          : inputs.length > 0
            ? t('Piano found, not started yet')
            : t('No piano found. Plug it in and switch it on.')}
      </span>
    </div>
  );
}
