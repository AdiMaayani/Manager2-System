/**
 * Shared nested-drawer stack. Only the topmost open drawer receives Escape, and
 * document.body.drawerOpen stays applied while at least one drawer remains open.
 *
 * Each register() call creates an independent stack entry (object identity), so two
 * drawers that happen to pass the same callback function can still unregister
 * independently without removing each other.
 */

export type DrawerEscapeHandler = () => void;

interface DrawerStackEntry {
  invoke: DrawerEscapeHandler;
}

export class DrawerStack {
  private readonly entries: DrawerStackEntry[] = [];
  private listening = false;

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    const topEntry = this.entries[this.entries.length - 1];
    topEntry?.invoke();
  };

  get depth(): number {
    return this.entries.length;
  }

  /** Register an open drawer. Returns an unregister function for effect cleanup. */
  register(onEscape: DrawerEscapeHandler): () => void {
    const entry: DrawerStackEntry = { invoke: onEscape };
    this.entries.push(entry);
    this.syncBodyClass();
    this.syncEscapeListener();

    return () => {
      const index = this.entries.indexOf(entry);
      if (index >= 0) {
        this.entries.splice(index, 1);
      }
      this.syncBodyClass();
      this.syncEscapeListener();
    };
  }

  /** Test helper: invoke Escape against the current top handler. */
  dispatchEscapeForTests(): boolean {
    const topEntry = this.entries[this.entries.length - 1];
    if (!topEntry) return false;
    topEntry.invoke();
    return true;
  }

  /** Test helper: clear stack without touching the DOM. */
  resetForTests(): void {
    this.entries.length = 0;
    this.listening = false;
  }

  private syncBodyClass(): void {
    if (typeof document === 'undefined') return;

    if (this.entries.length > 0) {
      document.body.classList.add('drawerOpen');
    } else {
      document.body.classList.remove('drawerOpen');
    }
  }

  private syncEscapeListener(): void {
    if (typeof window === 'undefined') return;

    if (this.entries.length > 0 && !this.listening) {
      window.addEventListener('keydown', this.onKeyDown);
      this.listening = true;
      return;
    }

    if (this.entries.length === 0 && this.listening) {
      window.removeEventListener('keydown', this.onKeyDown);
      this.listening = false;
    }
  }
}

/** Process-wide stack used by Drawer. Isolated instances are created in unit tests. */
export const sharedDrawerStack = new DrawerStack();
