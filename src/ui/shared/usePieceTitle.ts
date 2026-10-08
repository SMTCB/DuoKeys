// The play screens' heading: the piece's title from the content index, so the
// page says "Hot Cross Buns" rather than its arrangement id. Undefined until the
// index loads, or when the piece is not in it (generated or imported content).

import { useEffect, useState } from 'react';
import { getAdapters } from '../../runtime/bootstrap';

export function usePieceTitle(pieceId: string | undefined): string | undefined {
  const [title, setTitle] = useState<string | undefined>();
  useEffect(() => {
    setTitle(undefined);
    if (pieceId === undefined) return;
    let cancelled = false;
    getAdapters()
      .content.index()
      .then((index) => {
        if (!cancelled) setTitle(index.pieces.find((p) => p.id === pieceId)?.title);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pieceId]);
  return title;
}
