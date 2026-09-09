let currentAbort: AbortController | undefined;

export function beginGeneration(): AbortSignal {
  cancelGeneration();
  currentAbort = new AbortController();
  return currentAbort.signal;
}

export function endGeneration(): void {
  currentAbort = undefined;
}

export function cancelGeneration(): void {
  currentAbort?.abort();
  currentAbort = undefined;
}

export function isGenerating(): boolean {
  return !!currentAbort && !currentAbort.signal.aborted;
}
