import { describe, expect, it, vi } from 'vitest';
import { notifyDataChanged, subscribeData } from '../notify';

describe('subscribeData / notifyDataChanged', () => {
  it('calls every listener on notify', () => {
    const a = vi.fn();
    const b = vi.fn();
    subscribeData(a);
    subscribeData(b);
    notifyDataChanged();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('unsubscribing stops future notifications and is idempotent', () => {
    const a = vi.fn();
    const b = vi.fn();
    const unsub = subscribeData(a);
    subscribeData(b);
    unsub();
    unsub();
    notifyDataChanged();
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('listeners added during a notify are not called for that emit', () => {
    const a = vi.fn();
    const b = vi.fn();
    subscribeData(() => {
      subscribeData(b);
    });
    subscribeData(a);
    notifyDataChanged();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
  });
});
