// The profile avatars: fifteen different instruments, each with a spoken name
// for screen readers. Stored on the profile as the emoji itself, so profiles
// made with the earlier animal avatars keep working.

export interface Avatar {
  emoji: string;
  name: string;
}

export const AVATARS: readonly Avatar[] = [
  { emoji: '🎹', name: 'Piano' },
  { emoji: '🎸', name: 'Guitar' },
  { emoji: '🎻', name: 'Violin' },
  { emoji: '🎺', name: 'Trumpet' },
  { emoji: '🎷', name: 'Saxophone' },
  { emoji: '🥁', name: 'Drum' },
  { emoji: '🪗', name: 'Accordion' },
  { emoji: '🪕', name: 'Banjo' },
  { emoji: '🪘', name: 'Long drum' },
  { emoji: '🪈', name: 'Flute' },
  { emoji: '🪇', name: 'Maracas' },
  { emoji: '📯', name: 'Horn' },
  { emoji: '🔔', name: 'Bell' },
  { emoji: '🎤', name: 'Microphone' },
  { emoji: '🎼', name: 'Sheet music' },
];
