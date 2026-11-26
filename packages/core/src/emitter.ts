// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

/** Handlers by event name, as each renderer keeps them for `Renderer.on`. */
export class Emitter<E extends Record<keyof E, (...args: never[]) => void>> {
  private readonly handlers = new Map<keyof E, Set<E[keyof E]>>();

  on<K extends keyof E>(event: K, handler: E[K]): () => void {
    const set = this.handlers.get(event) ?? new Set();
    this.handlers.set(event, set.add(handler));
    return () => set.delete(handler);
  }

  emit<K extends keyof E>(event: K, ...args: Parameters<E[K]>): void {
    for (const h of this.handlers.get(event) ?? [])
      (h as (...a: Parameters<E[K]>) => void)(...args);
  }

  clear(): void {
    this.handlers.clear();
  }
}
