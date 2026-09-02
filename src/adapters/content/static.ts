// TA-PORT-003 v1 adapter for ContentBackend. The content pipeline (TA-CNT-001,
// content ingest, licence-gated build step) is out of scope for Sprint 1
// (docs/03-SPRINT-PLAN.md); this wraps the one hand-authored arrangement
// (US-1.13) behind the real port so the port itself is still exercised rather
// than bypassed.

import type { ArrangementId, ContentBackend, ContentIndex } from '../ports';
import type { Arrangement, Piece } from '../../core/content/types';
import { assertLicenced, type LicenceEntry } from '../../core/content/licence';
import licencesJson from '../../../content/licences.json';
import { MARY_HAD_A_LITTLE_LAMB, MARY_HAD_A_LITTLE_LAMB_PIECE } from './maryHadALittleLamb';

const LICENCES = licencesJson as LicenceEntry[];
const PIECES: readonly Piece[] = [MARY_HAD_A_LITTLE_LAMB_PIECE];
const ARRANGEMENTS: readonly Arrangement[] = [MARY_HAD_A_LITTLE_LAMB];

export class StaticContentBackend implements ContentBackend {
  constructor() {
    for (const piece of PIECES) assertLicenced(piece.licenceId, LICENCES);
  }

  async index(): Promise<ContentIndex> {
    return { pieces: PIECES.map((p) => ({ id: p.id, title: p.title })) };
  }

  async arrangement(id: ArrangementId): Promise<Arrangement> {
    const found = ARRANGEMENTS.find((a) => a.id === id);
    if (!found) throw new Error(`StaticContentBackend: no arrangement with id "${id}"`);
    return found;
  }
}
