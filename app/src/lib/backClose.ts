// Android back-gesture support for overlays (sheets / callouts): while any
// overlay is open, exactly one history sentinel entry sits on top of the
// stack, so the hardware/gesture Back closes the topmost overlay instead of
// navigating. With nothing open, Back navigates as usual.
//
// Model (agreed in the Codex design debate):
// - one sentinel while the overlay stack is non-empty, armed on 0→1;
// - popstate with overlays open closes only the top one; a busy overlay
//   refuses and the sentinel is re-armed (never navigate away mid-save);
// - UI close (button/backdrop/Escape) consumes the sentinel via history.back();
// - sentinel sync is deferred one tick so close→open handoffs (detail → edit)
//   keep the sentinel instead of briefly consuming it;
// - whether we sit on the sentinel is read from history.state, not a local
//   flag, so router pushes (e.g. route-backed sheets) can't desync it.

type Overlay = { id: number; close: () => void; isBusy?: () => boolean };

const SENTINEL = '__overlayBack__';

let stack: Overlay[] = [];
let nextId = 1;
let ignoreNextPop = false;
let pendingNavigate: (() => void) | null = null;
let syncTimer: number | null = null;

const onSentinel = () => typeof history !== 'undefined' && !!(history.state && history.state[SENTINEL]);

function arm() {
  if (onSentinel()) return;
  history.pushState({ ...(history.state ?? {}), [SENTINEL]: true }, '');
}

function syncSentinel() {
  if (stack.length > 0 && !onSentinel()) {
    arm();
  } else if (stack.length === 0 && onSentinel()) {
    ignoreNextPop = true;
    history.back();
  } else if (pendingNavigate && stack.length === 0) {
    // Nothing to consume (sentinel already gone) — run the queued navigation.
    const nav = pendingNavigate;
    pendingNavigate = null;
    nav();
  }
}

function scheduleSync() {
  if (typeof window === 'undefined' || syncTimer != null) return;
  syncTimer = window.setTimeout(() => {
    syncTimer = null;
    syncSentinel();
  }, 0);
}

/**
 * Register an open overlay. Returns the unregister function — call it when the
 * overlay closes (effect cleanup). `isBusy` lets an overlay refuse back-close
 * while a save is in flight.
 */
export function registerOverlay(close: () => void, isBusy?: () => boolean): () => void {
  const entry: Overlay = { id: nextId++, close, isBusy };
  stack.push(entry);
  if (stack.length === 1) arm();
  return () => {
    stack = stack.filter((o) => o.id !== entry.id);
    scheduleSync();
  };
}

/**
 * Close an overlay and navigate once its history sentinel is consumed — for
 * overlay actions that open a route (FAB → weigh-in). Navigating directly
 * would leave the sentinel behind and make the next Back a no-op.
 */
export function closeOverlayThenNavigate(close: () => void, navigate: () => void) {
  pendingNavigate = navigate;
  close();
  // Fallback: if no popstate arrives (sentinel was never armed), still navigate.
  window.setTimeout(() => {
    if (pendingNavigate) {
      const nav = pendingNavigate;
      pendingNavigate = null;
      nav();
    }
  }, 80);
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (ignoreNextPop) {
      ignoreNextPop = false;
      if (pendingNavigate) {
        const nav = pendingNavigate;
        pendingNavigate = null;
        nav();
      }
      return;
    }
    if (stack.length === 0) return; // plain navigation — not ours
    const top = stack[stack.length - 1];
    if (top.isBusy?.()) {
      // Mid-save: keep the overlay and restore the sentinel the pop consumed.
      arm();
      return;
    }
    top.close();
    scheduleSync(); // unregister runs after React re-renders — re-arm or finish then
  });
}
