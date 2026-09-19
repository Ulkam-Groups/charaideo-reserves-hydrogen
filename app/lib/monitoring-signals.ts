type Signal =
  | {kind: 'fastrr'; source: 'cart' | 'product'; result: 'requested' | 'missing' | 'threw'; diagnostic?: HydrationDiagnostic}
  | {kind: 'hydration'; diagnostic: HydrationDiagnostic};

export type HydrationDiagnostic = {
  reactErrorCode: string;
  errorName: string;
  routeGroup: string;
  componentStack: string;
  scriptStack: string;
};

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

export function recordFastrrLaunch(source: 'cart' | 'product', result: 'requested' | 'missing' | 'threw', error?: unknown) {
  if (!pending && !recorder) return;
  const pathname = typeof window !== 'undefined' ? window.location?.pathname || '/' : '/';
  deliver({kind: 'fastrr', source, result, ...(error === undefined ? {} : {diagnostic: hydrationDiagnostic(error, undefined, pathname)})});
}

export function recordHydrationFailure(error: unknown, componentStack: string | undefined, pathname: string) {
  if (!pending && !recorder) return;
  deliver({kind: 'hydration', diagnostic: hydrationDiagnostic(error, componentStack, pathname)});
}

export function hydrationDiagnostic(error: unknown, componentStack: string | undefined, pathname: string): HydrationDiagnostic {
  const message = error instanceof Error ? error.message : '';
  const errorCode = message.match(/(?:invariant=|react\.dev\/errors\/)(\d{3,4})/)?.[1];
  const errorName = error instanceof Error && ['Error', 'TypeError', 'ReferenceError'].includes(error.name)
    ? error.name
    : 'OtherError';
  const firstSegment = pathname.split('/')[1];
  const routeGroup = pathname === '/' ? 'home' :
    ['products', 'collections', 'cart', 'search', 'account', 'pages'].includes(firstSegment)
      ? firstSegment
      : 'other';
  const componentFrames = (componentStack || '').split('\n').flatMap((line) => {
    const name = line.match(/^\s*at ([A-Za-z_$][\w$.<>-]{0,79})(?:\s|$)/)?.[1];
    return name ? [name] : [];
  }).slice(0, 20);
  const scriptFrames = (error instanceof Error ? error.stack || '' : '').split('\n').flatMap((line) => {
    const match = line.match(/\bat ([A-Za-z_$][\w$.<>-]{0,79})?\s*\(?(?:[^\s()]*\/)?([A-Za-z0-9_.-]+\.(?:js|tsx?)):(\d{1,6}):(\d{1,6})\)?/);
    return match ? [`${match[1] || '<anonymous>'} ${match[2]}:${match[3]}:${match[4]}`] : [];
  }).slice(0, 12);
  return {
    reactErrorCode: errorCode || 'unknown',
    errorName,
    routeGroup,
    componentStack: componentFrames.join(' > ') || 'unavailable',
    scriptStack: scriptFrames.join(' | ') || 'unavailable',
  };
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
