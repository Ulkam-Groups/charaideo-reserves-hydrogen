import {useEffect, useMemo, useRef, useState} from 'react';
import {Link} from 'react-router';
import {rankSensoryTeas, type SensoryAnswers, type SensoryTea} from '~/lib/tea-sensory';
import charaideoLogo from '~/assets/charaideo-reserves-logo.svg?url';

const QUESTIONS = [
  {key: 'mood', title: 'How would you like to feel?', sub: 'Choose the feeling closest to your moment.', options: [
    ['fresh', 'Fresh & refreshed', 'A bright, clean-feeling cup', 1], ['calm', 'Calm & unwind', 'A gentle pause in the day', 0],
    ['focused', 'Focused & present', 'A cup for a mindful moment', 5], ['comfort', 'Comfort & warmth', 'Something rounded and reassuring', 2],
    ['energised', 'Energised & ready', 'A lively, brisk character', 4], ['curious', 'Curious & adventurous', 'Explore something new', 3],
  ]},
  {key: 'flavour', title: 'Which flavour sounds inviting?', sub: 'Choose a taste direction you usually enjoy.', options: [
    ['floral', 'Floral & delicate', 'Light, fragrant, nuanced', 0], ['grassy', 'Fresh & grassy', 'Green, vegetal, lively', 5],
    ['malty', 'Rich & malty', 'Mellow sweetness and depth', 2], ['roasted', 'Roasted & toasty', 'Warm, nutty, toasted notes', 3],
    ['brisk', 'Brisk & bright', 'Lively and refreshing', 4], ['surprise', 'Surprise me', 'Choose a discovery for me', 1],
  ]},
  {key: 'intensity', title: 'How strong should the cup feel?', sub: 'Think about body and flavour intensity.', options: [
    ['light', 'Light', 'Delicate and easy-going', 0], ['balanced', 'Balanced', 'Neither too light nor too strong', 1], ['bold', 'Bold', 'Full-bodied and pronounced', 2],
  ]},
  {key: 'style', title: 'How would you like to prepare it?', sub: 'This helps choose the right brewing instructions.', options: [
    ['hot', 'Hot, brewed cup', 'A classic hot infusion', 2], ['iced', 'Iced', 'Bright and chilled', 1], ['whisked', 'Whisked', 'Fine tea powder whisked into water', 5],
  ]},
] as const;

type QuestionKey = keyof SensoryAnswers;

export function TeaSensoryExperience({teas, onRevealChange}: {teas: SensoryTea[]; onRevealChange?: (revealed: boolean) => void}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<SensoryAnswers>>({});
  const [revealed, setRevealed] = useState(false);
  const [rotation, setRotation] = useState(30);
  const wheelColumnRef = useRef<HTMLDivElement>(null);
  const scrollAnimationRef = useRef<number | null>(null);
  const previousScrollBehaviorRef = useRef<string | null>(null);
  const question = QUESTIONS[step];
  const complete = QUESTIONS.every(({key}) => answers[key]);
  const ranked = useMemo(() => complete ? rankSensoryTeas(teas, answers as SensoryAnswers) : [], [answers, complete, teas]);
  const match = ranked[0];

  function choose(key: QuestionKey, value: string, segment: number) {
    setAnswers((current) => ({...current, [key]: value}));
    setRotation((current) => {
      const currentPosition = ((current % 360) + 360) % 360;
      const targetPosition = (360 - (segment * 60 + 30)) % 360;
      const shortestTurn = ((targetPosition - currentPosition + 540) % 360) - 180;
      return current + shortestTurn;
    });
    if (window.matchMedia('(max-width: 760px)').matches) scrollToWheel();
  }

  function scrollToWheel() {
    const wheel = wheelColumnRef.current;
    if (!wheel) return;
    const scroller = document.scrollingElement as HTMLElement | null;
    if (!scroller) return;
    if (scrollAnimationRef.current !== null) {
      cancelAnimationFrame(scrollAnimationRef.current);
      if (previousScrollBehaviorRef.current !== null) scroller.style.scrollBehavior = previousScrollBehaviorRef.current;
    }
    const headerHeight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 70;
    const sectionMenuHeight = document.querySelector<HTMLElement>('.academy-section-menu')?.getBoundingClientRect().height ?? 0;
    const start = window.scrollY;
    const target = Math.max(0, start + wheel.getBoundingClientRect().top - headerHeight - sectionMenuHeight - 32);
    const distance = target - start;
    if (Math.abs(distance) < 4) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      scroller.scrollTop = target;
      return;
    }
    previousScrollBehaviorRef.current = scroller.style.scrollBehavior;
    scroller.style.scrollBehavior = 'auto';
    const startedAt = performance.now();
    const duration = 1000;
    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 0.5 - Math.cos(Math.PI * progress) / 2;
      scroller.scrollTop = start + distance * eased;
      if (progress < 1) scrollAnimationRef.current = requestAnimationFrame(animate);
      else {
        scrollAnimationRef.current = null;
        scroller.style.scrollBehavior = previousScrollBehaviorRef.current ?? '';
        previousScrollBehaviorRef.current = null;
      }
    };
    scrollAnimationRef.current = requestAnimationFrame(animate);
  }

  function restart() {
    setStep(0); setAnswers({}); setRevealed(false); setRotation(30);
    onRevealChange?.(false);
  }

  function reveal() {
    setRevealed(true);
    onRevealChange?.(true);
  }

  if (revealed) {
    return match
      ? <SensoryResult ranked={ranked.slice(0, 3)} answers={answers as SensoryAnswers} onRestart={restart} />
      : <SensoryPendingResult onRestart={restart} />;
  }

  return (
    <section className="sensory-experience" aria-labelledby="sensory-question">
      {!teas.length ? <p className="sensory-data-notice" role="status">Preview mode · The wheel is ready, but product recommendations will appear after sensory metafields are added in Shopify.</p> : null}
      <div className="sensory-wheel-column" ref={wheelColumnRef}>
        <p className="eyebrow">Your sensory compass</p>
        <div className="sensory-wheel-shell">
          <span className="sensory-wheel-pointer" aria-hidden="true" />
          <div className="sensory-wheel" style={{transform: `rotate(${rotation}deg)`}}>
            {[
              ['Floral', 'floral'],
              ['Fresh', 'grassy'],
              ['Malty', 'malty'],
              ['Roasted', 'roasted'],
              ['Brisk', 'brisk'],
              ['Green', 'grassy'],
            ].map(([label, value], index) => (
              <button
                aria-label={`Choose ${label.toLowerCase()} flavour`}
                aria-pressed={answers.flavour === value}
                className={answers.flavour === value ? 'selected' : ''}
                disabled={question.key !== 'flavour'}
                key={label}
                onClick={() => choose('flavour', value, index)}
                style={{
                  '--wheel-index': index,
                  '--counter-rotation': `${-(index * 60 + 30 + rotation)}deg`,
                } as React.CSSProperties}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <div className="sensory-wheel-centre" aria-hidden="true">
            <img src={charaideoLogo} alt="" />
          </div>
        </div>
        <p className="sensory-wheel-note">Each answer turns the wheel closer to your cup.</p>
      </div>

      <div className="sensory-quiz-column">
        <ol className="sensory-progress" aria-label="Tea matching progress">
          {QUESTIONS.map((item, index) => <li key={item.key} className={index <= step ? 'active' : ''}><span>{index + 1}</span></li>)}
        </ol>
        <p className="sensory-step">Step {step + 1} of {QUESTIONS.length}</p>
        <h2 id="sensory-question">{question.title}</h2>
        <p className="sensory-question-sub">{question.sub}</p>
        <div className="sensory-choices">
          {question.options.map(([value, label, description, segment]) => {
            const selected = answers[question.key] === value;
            return <button key={value} type="button" className={selected ? 'selected' : ''} aria-pressed={selected} onClick={() => choose(question.key, value, segment)}>
              <strong>{label}{selected ? <span className="sensory-choice-check" aria-hidden="true">✓</span> : null}</strong><small>{description}</small>
            </button>;
          })}
        </div>
        <div className="sensory-actions">
          <button className="sensory-back" type="button" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>← Back</button>
          <button className="button primary" type="button" disabled={!answers[question.key]} onClick={() => step === QUESTIONS.length - 1 ? reveal() : setStep((value) => value + 1)}>
            {step === QUESTIONS.length - 1 ? 'Reveal my tea' : 'Continue'} <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </section>
  );
}

function SensoryResult({ranked, answers, onRestart}: {ranked: ReturnType<typeof rankSensoryTeas>; answers: SensoryAnswers; onRestart: () => void}) {
  const primary = ranked[0];
  return <section className="sensory-result" aria-live="polite">
    <div className="sensory-result-heading"><p className="eyebrow">Your closest sensory match</p><h2>Your tea match</h2><p>{primary.tea.profile.tastingSummary || `A ${primary.tea.profile.flavours.join(', ')} tea selected for your preferences.`}</p></div>
    <div className="sensory-result-grid">
      <article className="sensory-primary-match">
        {primary.tea.image ? <img src={primary.tea.image.url} alt={primary.tea.image.altText || primary.tea.title} /> : <div className="sensory-image-placeholder" aria-hidden="true">CR</div>}
        <div>
          <span className="sensory-match-score">Best match · {Math.round(primary.score)} points</span>
          <h3><Link prefetch="none" className="sensory-product-title-link" to={`/products/${primary.tea.handle}`}>{primary.tea.title}<span aria-hidden="true">↗</span></Link></h3>
          <p>{[primary.tea.profile.estate, primary.tea.profile.origin].filter(Boolean).join(' · ') || primary.tea.vendor}</p>
          <div className="sensory-tags">{primary.tea.profile.flavours.map((value) => <span key={value}>{value}</span>)}</div>
          <div className="sensory-result-actions"><Link prefetch="none" className="button primary" to={`/products/${primary.tea.handle}`}>Discover this tea</Link><button className="sensory-back" type="button" onClick={onRestart}>Start again</button></div>
        </div>
      </article>
      <BrewGuide tea={primary.tea} style={answers.style} />
    </div>
    {ranked.length > 1 && <div className="sensory-alternatives"><p className="eyebrow">Also close to your taste</p><div>{ranked.slice(1).map(({tea}) => <Link prefetch="none" key={tea.id} to={`/products/${tea.handle}`}><strong>{tea.title}</strong><span>{tea.profile.flavours.slice(0, 3).join(' · ')}</span><span aria-hidden="true">→</span></Link>)}</div></div>}
  </section>;
}

function BrewGuide({tea, style}: {tea: SensoryTea; style: string}) {
  const total = tea.profile.brew.seconds;
  const [remaining, setRemaining] = useState(total ?? 0);
  const [running, setRunning] = useState(false);
  useEffect(() => { setRemaining(total ?? 0); setRunning(false); }, [tea.id, total]);
  useEffect(() => {
    if (!running || remaining <= 0) return;
    const timer = window.setInterval(() => setRemaining((value) => {
      if (value <= 1) { window.clearInterval(timer); setRunning(false); return 0; }
      return value - 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [remaining, running]);
  const formatted = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  return <aside className="sensory-brew-guide"><p className="eyebrow">Brew your cup</p><h3>{style === 'whisked' ? 'Whisk with intention' : 'A considered infusion'}</h3><dl><div><dt>Water</dt><dd>{tea.profile.brew.temperatureC ? `${tea.profile.brew.temperatureC}°C` : 'To taste'}</dd></div><div><dt>Time</dt><dd>{total ? `${Math.floor(total / 60)} min ${total % 60 ? `${total % 60} sec` : ''}` : 'To taste'}</dd></div><div><dt>Ratio</dt><dd>{tea.profile.brew.ratio || 'Follow pack guidance'}</dd></div></dl>{total ? <div className="sensory-timer"><output aria-live="polite">{formatted}</output><div><button type="button" onClick={() => setRunning((value) => !value)}>{running ? 'Pause' : remaining ? 'Start' : 'Finished'}</button><button type="button" onClick={() => {setRemaining(total); setRunning(false);}}>Reset</button></div></div> : null}</aside>;
}

function SensoryPendingResult({onRestart}: {onRestart: () => void}) {
  return <section className="sensory-empty" aria-live="polite"><p className="eyebrow">Your preferences are saved</p><h2>The matching table is being prepared.</h2><p>The sensory journey is working, but no published product has a valid <code>custom.tea_sensory_profile</code> yet. Add a profile in Shopify to turn these answers into a tea recommendation.</p><div className="sensory-result-actions"><button className="button primary" type="button" onClick={onRestart}>Try the wheel again</button><Link prefetch="none" className="button secondary" to="/reserve-list">Explore the tea library</Link></div></section>;
}
