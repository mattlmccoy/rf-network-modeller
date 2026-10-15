import type { ReactNode } from 'react';

/** A side sheet over the page, closed by its × or a click outside. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <aside className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header><b>{title}</b><button onClick={onClose} aria-label={`Close ${title}`}>×</button></header>
        {children}
      </aside>
    </div>
  );
}
