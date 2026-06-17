const API_BASE_URL = 'http://localhost:8080/api';
const DEFAULT_TIMEOUT_MS = 3000;

let currentAbortController = null;

export function cancelPendingRequest() {
  if (currentAbortController) {
    try { currentAbortController.abort(); } catch (e) { /* noop */ }
    currentAbortController = null;
  }
}

export async function fetchAllSensors({ timeoutMs = DEFAULT_TIMEOUT_MS, signal } = {}) {
  cancelPendingRequest();

  const ctrl = signal ? null : new AbortController();
  if (ctrl) currentAbortController = ctrl;
  const effectiveSignal = signal || ctrl.signal;

  let timeoutId = null;
  if (timeoutMs > 0 && !signal) {
    timeoutId = setTimeout(() => {
      try { ctrl.abort(); } catch (e) { /* noop */ }
    }, timeoutMs);
  }

  try {
    const response = await fetch(`${API_BASE_URL}/v1/sensors`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      signal: effectiveSignal,
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      error._aborted = true;
    }
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    if (ctrl && currentAbortController === ctrl) {
      currentAbortController = null;
    }
  }
}

export async function fetchHealth({ timeoutMs = 2000 } = {}) {
  try {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), timeoutMs);
    const response = await fetch(`${API_BASE_URL}/v1/sensors/health`, { signal: ctrl.signal });
    clearTimeout(id);
    return await response.json();
  } catch (error) {
    return null;
  }
}
