/** Run save operations one at a time while allowing the latest snapshot to queue behind them. */
export function createSaveQueue() {
  let tail: Promise<void> = Promise.resolve();

  return <T>(work: () => Promise<T>): Promise<T> => {
    const result = tail.then(work, work);
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
}
