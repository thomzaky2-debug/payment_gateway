/**
 * Bridges API-layer step-up challenges (403 STEP_UP_REQUIRED) to a UI prompt.
 * The axios interceptor awaits `requestStepUp`; the mounted StepUpDialog
 * resolves it with the entered credential, or null when the user cancels.
 */
export type StepUpMethod = 'password' | 'totp';

export interface StepUpRequest {
  method: StepUpMethod;
  error?: string | null;
  resolve: (value: string | null) => void;
}

type Listener = (request: StepUpRequest | null) => void;

let listener: Listener | null = null;
let pending: Promise<string | null> | null = null;

export function subscribeStepUp(next: Listener): () => void {
  listener = next;
  return () => {
    if (listener === next) listener = null;
  };
}

/** Prompts the user once; concurrent callers share the same prompt. */
export function requestStepUp(method: StepUpMethod, error?: string | null): Promise<string | null> {
  if (pending) return pending;
  if (!listener) return Promise.resolve(null);
  const active = listener;
  pending = new Promise<string | null>((resolve) => {
    active({
      method,
      error,
      resolve: (value) => {
        pending = null;
        active(null);
        resolve(value);
      },
    });
  });
  return pending;
}
