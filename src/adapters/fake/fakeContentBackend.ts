// TA-PORT-004 — deterministic fake ContentBackend, served from arrangements
// passed in at construction rather than a network fetch.

import type { Arrangement, ArrangementId, ContentBackend, ContentIndex } from '../ports';

export class FakeContentBackend implements ContentBackend {
  constructor(
    private readonly arrangements: readonly Arrangement[] = [],
    private readonly pieces: readonly { id: string; title: string; defaultArrangementId: string }[] = [],
  ) {}

  async index(): Promise<ContentIndex> {
    return { pieces: [...this.pieces] };
  }

  async arrangement(id: ArrangementId): Promise<Arrangement> {
    const found = this.arrangements.find((a) => a.id === id);
    if (!found) throw new Error(`FakeContentBackend: no arrangement "${id}"`);
    return found;
  }
}
