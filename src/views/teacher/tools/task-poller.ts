export function createTaskPoller<T extends { status: string }>(options: {
  fetchTask: (id: string, signal: AbortSignal) => Promise<T>;
  onUpdate: (task: T) => void;
  onError: (fatal: boolean) => void;
  interval?: number;
}) {
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  const stop = () => {
    generation++;
    clearTimeout(timer);
    controller?.abort();
  };
  const start = (id: string) => {
    stop();
    const ownGeneration = generation;
    let failures = 0;
    const poll = async () => {
      controller = new AbortController();
      let delay = options.interval ?? 3000;
      try {
        const task = await options.fetchTask(id, controller.signal);
        if (generation !== ownGeneration) return;
        failures = 0;
        options.onUpdate(task);
        if (!["queued", "processing"].includes(task.status)) return;
      } catch (error) {
        if (generation !== ownGeneration) return;
        const status = (error as { response?: { status?: number } })?.response
          ?.status;
        const fatal = [401, 403, 404].includes(status ?? 0);
        options.onError(fatal);
        if (fatal) return;
        delay = Math.min(30000, delay * 2 ** ++failures);
      }
      if (generation === ownGeneration)
        timer = setTimeout(() => void poll(), delay);
    };
    void poll();
  };
  return { start, stop };
}
