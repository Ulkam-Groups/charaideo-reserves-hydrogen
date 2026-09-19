type Signal =
  | {kind: 'fastrr'; source: 'cart' | 'product'; result: 'requested' | 'missing' | 'threw'}
  | {kind: 'hydration'};

type Recorder = (signal: Signal) => void;

let recorder: Recorder | null = null;
let pending = false;
let queued: Signal[] = [];

export function prepareMonitoringSignals() {
  pending = true;
}

export function installMonitoringRecorder(next: Recorder | null) {
  recorder = next;
  pending = false;
  const buffered = queued;
  queued = [];
  if (next) buffered.forEach(deliver);
}

export function recordFastrrLaunch(source: 'cart' | 'product', result: 'requested' | 'missing' | 'threw') {
  deliver({kind: 'fastrr', source, result});
}

export function recordHydrationFailure() {
  deliver({kind: 'hydration'});
}

function deliver(signal: Signal) {
  if (recorder) {
    try {
      recorder(signal);
    } catch {
      // Monitoring cannot interrupt checkout or hydration.
    }
  } else if (pending && queued.length < 10) {
    queued.push(signal);
  }
}
