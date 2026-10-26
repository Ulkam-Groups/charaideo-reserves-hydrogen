import {useEffect, useMemo, useState, type CSSProperties} from 'react';

type MetafieldValue = {value?: string | null} | null;

type JourneyProduct = {
  title: string;
  teaJourney?: MetafieldValue;
};

type TeaJourney = {
  source: {
    name: string;
    latitude: number | null;
    longitude: number | null;
    googleMapsUrl: string | null;
    harvestedAt: string | null;
    craftedAt: string | null;
    processNote: string | null;
  };
  reserve: {
    name: string;
    latitude: number | null;
    longitude: number | null;
    receivedAt: string | null;
    arrivalNote: string | null;
  };
  finalStage: {
    title: string;
    note: string | null;
    videoUrl: string | null;
    videoPosterUrl: string | null;
  };
};

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function numberValue(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function safeMapUrl(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function parseTeaJourney(value?: string | null): TeaJourney | null {
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) return null;
    const source = isRecord(parsed.source) ? parsed.source : {};
    const reserve = isRecord(parsed.reserve) ? parsed.reserve : {};
    const finalStage = isRecord(parsed.finalStage) ? parsed.finalStage : {};
    const sourceName = stringValue(source.name);
    const harvestedAt = stringValue(source.harvestedAt);
    const receivedAt = stringValue(reserve.receivedAt);
    const videoUrl = safeMapUrl(stringValue(finalStage.videoUrl));

    if (!sourceName && !harvestedAt && !receivedAt && !videoUrl) return null;

    return {
      source: {
        name: sourceName || 'The originating estate',
        latitude: numberValue(source.latitude),
        longitude: numberValue(source.longitude),
        googleMapsUrl: safeMapUrl(stringValue(source.googleMapsUrl)),
        harvestedAt,
        craftedAt: stringValue(source.craftedAt),
        processNote: stringValue(source.processNote),
      },
      reserve: {
        name: stringValue(reserve.name) || 'Charaideo Reserves',
        latitude: numberValue(reserve.latitude),
        longitude: numberValue(reserve.longitude),
        receivedAt,
        arrivalNote: stringValue(reserve.arrivalNote),
      },
      finalStage: {
        title: stringValue(finalStage.title) || 'Ready for Your Cup',
        note: stringValue(finalStage.note),
        videoUrl,
        videoPosterUrl: safeMapUrl(stringValue(finalStage.videoPosterUrl)),
      },
    };
  } catch {
    return null;
  }
}

export function ProductTeaJourney({product}: {product: JourneyProduct}) {
  const [active, setActive] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const journey = useMemo(
    () => parseTeaJourney(product.teaJourney?.value),
    [product.teaJourney?.value],
  );
  const sourceLat = journey?.source.latitude ?? null;
  const sourceLng = journey?.source.longitude ?? null;
  const reserveLat = journey?.reserve.latitude ?? null;
  const reserveLng = journey?.reserve.longitude ?? null;
  const sourceName = journey?.source.name || 'The originating estate';
  const reserveName = journey?.reserve.name || 'Charaideo Reserves';
  const mapLink =
    journey?.source.googleMapsUrl ||
    (sourceLat !== null && sourceLng !== null
      ? `https://www.google.com/maps?q=${sourceLat},${sourceLng}`
      : null);

  useEffect(() => {
    if (isPaused || !journey) return;

    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % 3);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [isPaused, journey]);

  if (!journey) return null;

  const steps = [
    {
      title: 'Harvested & Crafted',
      date: formatDate(journey.source.craftedAt || journey.source.harvestedAt),
      body:
        journey.source.processNote ||
        `Plucked and processed at ${sourceName}.`,
    },
    {
      title: 'Received at the Reserve',
      date: formatDate(journey.reserve.receivedAt),
      body:
        journey.reserve.arrivalNote ||
        `This lot arrived at ${reserveName}, carrying its estate origin and lot details.`,
    },
    {
      title: journey.finalStage.title,
      date: null,
      body:
        journey.finalStage.note ||
        'The journey finishes in the cup: whole-leaf tea, prepared with care.',
    },
  ];

  const embedUrl =
    sourceLat !== null && sourceLng !== null
      ? `https://www.google.com/maps?q=${sourceLat},${sourceLng}&z=11&output=embed`
      : null;
  const directionsEmbedUrl =
    sourceLat !== null &&
    sourceLng !== null &&
    reserveLat !== null &&
    reserveLng !== null
      ? `https://www.google.com/maps?saddr=${sourceLat},${sourceLng}&daddr=${reserveLat},${reserveLng}&output=embed`
      : null;

  return (
    <section
      className="product-tea-journey tea-section"
      id="tea-journey-section"
      aria-labelledby="product-journey-title"
    >
      <header className="product-journey-heading">
        <span className="eyebrow">Our tea journey</span>
        <h2 id="product-journey-title">From the garden to your table.</h2>
      </header>

      <div className="product-journey-layout">
        <div className={`product-journey-viewport is-stage-${active + 1}`}>
          <div className="product-journey-map-layer" aria-hidden={active === 2}>
            {active === 0 && embedUrl ? (
              <iframe
                title={`Map showing ${sourceName}`}
                src={embedUrl}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : active === 1 && directionsEmbedUrl ? (
              <iframe
                title={`Route from ${sourceName} to ${reserveName}`}
                src={directionsEmbedUrl}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <JourneyRoute
                sourceName={sourceName}
                reserveName={reserveName}
              />
            )}
            <div className="product-journey-map-caption">
              <span>{active === 0 ? sourceName : `${sourceName} to ${reserveName}`}</span>
              {active === 0 && mapLink && (
                <a href={mapLink} target="_blank" rel="noreferrer">
                  View on Google Maps <span aria-hidden="true">↗</span>
                </a>
              )}
            </div>
          </div>

          <div className="product-journey-video-layer" aria-hidden={active !== 2}>
            {active === 2 && <GlobalDispatchMap />}
          </div>
        </div>

        <ol
          className={`product-journey-steps${isPaused ? ' is-paused' : ''}`}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {steps.map((step, index) => (
            <li key={step.title}>
              <button
                type="button"
                className={active === index ? 'is-active' : undefined}
                aria-pressed={active === index}
                onClick={() => setActive(index)}
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
              >
                <span className="product-journey-step-copy">
                  <strong>{step.title}</strong>
                  {step.date && <small>{step.date}</small>}
                  <span>{step.body}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const DISPATCH_ORIGIN = {x: 590, y: 180} as const;

const DISPATCH_ROUTES = [
  {id: 'usa', path: 'M590 180 Q380 42 173 176', x: 173, y: 176},
  {id: 'canada', path: 'M590 180 Q355 4 152 131', x: 152, y: 131},
  {id: 'brazil', path: 'M590 180 Q350 220 298 327', x: 298, y: 327},
  {id: 'russia', path: 'M590 180 Q670 62 746 115', x: 746, y: 115},
  {id: 'australia', path: 'M590 180 Q785 225 805 363', x: 805, y: 363},
  {id: 'delhi', path: 'M590 180 Q494 134 389 167', x: 389, y: 167},
  {id: 'africa', path: 'M590 180 Q548 235 511 298', x: 511, y: 298},
  {id: 'germany', path: 'M590 180 Q532 82 480 143', x: 480, y: 143},
] as const;

function GlobalDispatchMap() {
  return (
    <div
      className="product-dispatch-map"
      role="img"
      aria-label="Illustrative dispatch routes from Charaideo Reserves in Rupai to tea tables around the world"
    >
      <svg viewBox="95 58 720 365" aria-hidden="true">
        <defs>
          <marker
            id="dispatch-route-arrow"
            viewBox="0 0 9 8"
            refX="8"
            refY="4"
            markerWidth="9"
            markerHeight="8"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path className="product-dispatch-arrowhead" d="M0 0L9 4 0 8 2.4 4Z" />
          </marker>
          {DISPATCH_ROUTES.map((route, index) => (
            <mask
              key={route.id}
              id={`dispatch-route-mask-${route.id}`}
              maskUnits="userSpaceOnUse"
            >
              <path
                className="product-dispatch-route-reveal"
                pathLength="1"
                d={route.path}
                style={{'--route-index': index} as CSSProperties}
              />
            </mask>
          ))}
        </defs>
        <rect width="900" height="506" className="product-dispatch-backdrop" />
        <g className="product-dispatch-map-stage">
          <image
            className="product-dispatch-world-map"
            href="/world-map-natural-earth.svg"
            x="-55"
            y="-5"
            width="1010"
            height="505"
            preserveAspectRatio="xMidYMid meet"
          />
          <image
            className="product-dispatch-india-map"
            href="/india-assam-map.svg"
            x="295"
            y="60"
            width="310"
            height="355"
            preserveAspectRatio="xMidYMid meet"
          />
        </g>
        <g className="product-dispatch-routes">
          {DISPATCH_ROUTES.map((route, index) => (
            <g key={route.id} style={{'--route-index': index} as CSSProperties}>
              <path
                className="product-dispatch-route"
                pathLength="1"
                d={route.path}
                mask={`url(#dispatch-route-mask-${route.id})`}
                markerEnd="url(#dispatch-route-arrow)"
              />
              <circle className="product-dispatch-destination" cx={route.x} cy={route.y} r="5" />
              <circle className="product-dispatch-traveller" r="4">
                <animateMotion
                  begin={`${index * 0.22}s`}
                  dur="8s"
                  keyPoints="0;0;1;1"
                  keyTimes="0;0.20625;0.43125;1"
                  calcMode="linear"
                  repeatCount="indefinite"
                  path={route.path}
                />
              </circle>
            </g>
          ))}
        </g>
        <g
          className="product-dispatch-origin"
          transform={`translate(${DISPATCH_ORIGIN.x} ${DISPATCH_ORIGIN.y})`}
        >
          <circle className="product-dispatch-origin-pulse" r="22" />
          <circle r="9" />
          <text x="0" y="-31" textAnchor="middle">Rupai, Assam</text>
        </g>
        <text className="product-dispatch-caption" x="108" y="409">
          From Assam to tea tables around the world
        </text>
      </svg>
    </div>
  );
}

function JourneyRoute({
  sourceName,
  reserveName,
}: {
  sourceName: string;
  reserveName: string;
}) {
  return (
    <svg
      className="product-journey-route-map"
      viewBox="0 0 900 430"
      role="img"
      aria-label={`Illustrative journey from ${sourceName} to ${reserveName}`}
    >
      <path className="product-journey-land" d="M0 355C150 282 276 386 420 312s291-77 480-9v127H0Z" />
      <path className="product-journey-river" d="M-30 360c172-95 284 52 443-35s303-102 525-27" />
      <path
        className="product-journey-line"
        pathLength="1"
        d="M120 290C250 96 480 378 756 140"
      />
      <g transform="translate(120 290)">
        <circle className="product-journey-pin" r="11" />
        <text y="-25" textAnchor="middle">{sourceName}</text>
      </g>
      <g transform="translate(756 140)">
        <circle className="product-journey-pin is-destination" r="11" />
        <text y="-25" textAnchor="middle">{reserveName}</text>
      </g>
      <text className="product-journey-route-note" x="450" y="405" textAnchor="middle">
        Add both coordinate pairs to display the mapped route
      </text>
    </svg>
  );
}
