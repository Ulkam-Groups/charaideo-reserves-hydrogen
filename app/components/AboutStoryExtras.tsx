import {useEffect, useRef, useState, type FormEvent} from 'react';

/** Adds `is-visible` once the element scrolls into view; visible by default without JS. */
function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [armed, setArmed] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }
    setArmed(true);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      {threshold: 0.25},
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return {ref, className: armed ? (visible ? 'is-visible' : 'is-armed') : ''};
}

const JOURNEY = [
  {
    id: 'garden',
    place: 'Rupai',
    title: 'The garden',
    body: 'Leaf is hand-plucked at the estate, and the pluck date is recorded against the lot.',
    x: 90,
    y: 250,
  },
  {
    id: 'craft',
    place: 'Small batch',
    title: 'The craft',
    body: 'One estate, one harvest, processed in a small batch as whole leaf. Never blended.',
    x: 300,
    y: 130,
  },
  {
    id: 'vault',
    place: 'Charaideo',
    title: 'The vault',
    body: 'Each lot is sealed and given a QR code that points back to its garden.',
    x: 560,
    y: 200,
  },
  {
    id: 'cup',
    place: 'Your table',
    title: 'Your cup',
    body: 'Scan the code to see the estate, the pluck date and the brew guide before you pour.',
    x: 800,
    y: 90,
  },
] as const;

export function JourneyMap() {
  const [active, setActive] = useState(0);
  const {ref, className} = useInView<HTMLDivElement>();

  return (
    <div className={`about-journey ${className}`} ref={ref}>
      <div className="about-journey-map">
        <svg
          viewBox="0 0 900 340"
          role="img"
          aria-label="Illustrative route of a tea lot from the garden in Rupai, through small-batch processing, to the Charaideo vault and your cup"
        >
          <path
            className="about-journey-river"
            d="M-20 300 C 150 250, 260 330, 430 280 S 720 230, 920 290"
          />
          <path
            className="about-journey-hills"
            d="M0 330 L80 300 L150 322 L240 280 L330 318 L420 296 L520 326 L640 292 L730 322 L820 300 L900 324"
          />
          <path
            className="about-journey-route"
            pathLength={1}
            d="M90 250 C 170 250, 210 130, 300 130 S 470 200, 560 200 S 720 90, 800 90"
          />
          {JOURNEY.map((step, index) => (
            <g
              key={step.id}
              className={`about-journey-node${index === active ? ' is-active' : ''}${
                index <= active ? ' is-passed' : ''
              }`}
              transform={`translate(${step.x} ${step.y})`}
            >
              <circle className="about-journey-halo" r="22" />
              <circle className="about-journey-dot" r="9" />
              <text className="about-journey-place" y="-30" textAnchor="middle">
                {step.place}
              </text>
            </g>
          ))}
        </svg>
        <p className="about-journey-note">Illustrative route, not to scale.</p>
      </div>

      <ol className="about-journey-steps">
        {JOURNEY.map((step, index) => (
          <li key={step.id}>
            <button
              type="button"
              className={index === active ? 'is-active' : undefined}
              aria-pressed={index === active}
              onClick={() => setActive(index)}
              onMouseEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
            >
              <span className="about-journey-step-number">0{index + 1}</span>
              <span>
                <strong>{step.title}</strong>
                <span>{step.body}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function NewsletterSignup() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'pending' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (status === 'pending') return;
    setStatus('pending');
    setMessage('');
    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email, consent: true}),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(result?.error || 'Unable to join the list. Please try again.');
      }
      setStatus('done');
    } catch (error) {
      setStatus('error');
      setMessage(
        error instanceof Error ? error.message : 'Unable to join the list. Please try again.',
      );
    }
  }

  if (status === 'done') {
    return (
      <p className="about-signup-done" role="status">
        Thank you. You are on the list, and we will write when the next reserve opens.
      </p>
    );
  }

  return (
    <form className="about-signup" onSubmit={submit}>
      <label htmlFor="about-signup-email">Hear first when the next reserve opens</label>
      <div className="about-signup-row">
        <input
          id="about-signup-email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <button className="about-page-button about-page-button-primary" disabled={status === 'pending'}>
          {status === 'pending' ? 'Joining…' : 'Join the list'}
        </button>
      </div>
      <p className="about-signup-fine">
        By joining you agree to receive emails about new reserves. Unsubscribe any time.
      </p>
      {status === 'error' ? (
        <p className="about-signup-error" role="alert">
          {message}
        </p>
      ) : null}
    </form>
  );
}
