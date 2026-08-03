// Tiny change emitter: repository writes notify subscribers (the data hooks),
// so screens refresh after any local edit or sync application.

type Listener = () => void;

const listeners = new Set<Listener>();

export function subscribeData(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyDataChanged(): void {
  for (const listener of [...listeners]) {
    listener();
  }
}
