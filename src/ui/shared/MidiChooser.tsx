// US-3.22 — the "choose your piano" step shared by every play screen. Picture
// tile + title + one big button per device + a connection line that says its
// state in words as well as a dot (NFR-008).

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
  return (
    <div className={styles.chooser}>
      <div className={styles.lead}>
        <span className={styles.keys} aria-hidden="true">
          🎹
        </span>
        <span className={styles.title}>Choose your piano</span>
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
        Connection: {connectionState}
      </span>
    </div>
  );
}
