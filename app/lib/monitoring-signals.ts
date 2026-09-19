type Signal =
  | {kind: 'fastrr'; source: 'cart' | 'product'; result: 'requested' | 'missing' | 'threw'; diagnostic?: HydrationDiagnostic}
  | {kind: 'hydration'; diagnostic: HydrationDiagnostic};

export type HydrationDiagnostic = {
  reactErrorCode: string;
  errorName: string;
  routeGroup: string;
  componentStack: string;
  scriptStack: string;
  frames: Array<{filename: string; abs_path: string; function: string; lineno: number; colno: number; in_app: boolean}>;
  incidentId: string;
};

type Recorder = (signal: Signal) => void;

let recorder: Recorder | null = null;
let pending = false;
let queued: Signal[] = [];
let incidentId = '';
let sawMismatch = false;
let hydrationReports = 0;
const reportedHydrationKeys = new Set<string>();

export function prepareMonitoringSignals() {
  pending = true;
  incidentId = globalThis.crypto?.randomUUID?.() || 'unavailable';
  sawMismatch = false;
  hydrationReports = 0;
  reportedHydrationKeys.clear();
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
  const origin = typeof window !== 'undefined' ? window.location?.origin || '' : '';
  deliver({kind: 'fastrr', source, result, ...(error === undefined ? {} : {diagnostic: hydrationDiagnostic(error, undefined, pathname, origin)})});
}

export function recordHydrationFailure(error: unknown, componentStack: string | undefined, pathname: string, origin = '') {
  if (!pending && !recorder) return;
  const diagnostic = hydrationDiagnostic(error, componentStack, pathname, origin);
  // #423 only describes React's recovery. The preceding #418 is the useful failure.
  if (diagnostic.reactErrorCode === '423' && sawMismatch) return;
  if (diagnostic.reactErrorCode === '418') sawMismatch = true;
  const key = `${diagnostic.reactErrorCode}:${diagnostic.componentStack}:${diagnostic.scriptStack}`;
  if (reportedHydrationKeys.has(key) || hydrationReports >= 5) return;
  reportedHydrationKeys.add(key);
  hydrationReports += 1;
  deliver({kind: 'hydration', diagnostic});
}

export function hydrationDiagnostic(error: unknown, componentStack: string | undefined, pathname: string, origin = ''): HydrationDiagnostic {
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
  const frames = safeSentryFrames(error, origin);
  const scriptFrames = frames.slice().reverse().map((frame) =>
    `${frame.function} ${frame.filename.split('/').pop()}:${frame.lineno}:${frame.colno}`,
  );
  return {
    reactErrorCode: errorCode || 'unknown',
    errorName,
    routeGroup,
    componentStack: componentFrames.join(' > ') || 'unavailable',
    scriptStack: scriptFrames.join(' | ') || 'unavailable',
    frames,
    incidentId,
  };
}

function safeSentryFrames(error: unknown, origin: string): HydrationDiagnostic['frames'] {
  if (!(error instanceof Error) || !origin) return [];
  const frames = (error.stack || '').split('\n').flatMap((line) => {
    const match = line.match(/\bat (?:(?<function>[A-Za-z_$][\w$.<>-]{0,79})\s+\()?((?:https?:\/\/)[^\s()]+\.js):(\d{1,6}):(\d{1,6})\)?/);
    if (!match) return [];
    try {
      const url = new URL(match[2]);
      if (url.origin !== origin || !/^\/assets\/[A-Za-z0-9_.-]+\.js$/.test(url.pathname)) return [];
      const path = `${url.origin}${url.pathname}`;
      return [{
        filename: path,
        abs_path: path,
        function: match.groups?.function || '<anonymous>',
        lineno: Number(match[3]),
        colno: Number(match[4]),
        in_app: true,
      }];
    } catch {
      return [];
    }
  }).slice(0, 12);
  return frames.reverse();
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
