import {useEffect, useState} from 'react';

type MetafieldValue = {value: string} | null | undefined;

type ProductEditorialData = {
  productType: string;
  category?: {name: string} | null;
  description: string;
  options: Array<{name: string; optionValues: Array<{name: string}>}>;
  taxonomyTeaVariety?: TaxonomyMetafield;
  taxonomyTeaInputType?: TaxonomyMetafield;
  taxonomyTasteProfile?: TaxonomyMetafield;
  roast?: MetafieldValue;
  body?: MetafieldValue;
  sweetness?: MetafieldValue;
  astringency?: MetafieldValue;
  caffeineScore?: MetafieldValue;
  bitterness?: MetafieldValue;
  bestTime?: MetafieldValue;
  milkPairing?: MetafieldValue;
  tastingNotes?: MetafieldValue;
  characterSummary?: MetafieldValue;
  recipeHot?: MetafieldValue;
  recipeIced?: MetafieldValue;
  recipeLatte?: MetafieldValue;
  origin?: MetafieldValue;
  estate?: MetafieldValue;
  cultivar?: MetafieldValue;
  grade?: MetafieldValue;
  harvest?: MetafieldValue;
  flush?: MetafieldValue;
  pluckDate?: MetafieldValue;
  ingredients?: MetafieldValue;
  caffeineLevel?: MetafieldValue;
  brewingSuggestion?: MetafieldValue;
  storage?: MetafieldValue;
  shelfLife?: MetafieldValue;
  allergens?: MetafieldValue;
  certifications?: MetafieldValue;
  process?: MetafieldValue;
  teaStyle?: MetafieldValue;
  lotNumber?: MetafieldValue;
  netWeight?: MetafieldValue;
  isThisTeaYes?: MetafieldValue;
  isThisTeaNo?: MetafieldValue;
  whyChooseTea?: MetafieldValue;
  whyChooseAttribution?: MetafieldValue;
};

type TaxonomyMetafield = {
  references?: {
    nodes: Array<{label?: {value?: string | null} | null}>;
  } | null;
} | null;

type VariantData = {
  sku?: string | null;
  selectedOptions: Array<{name: string; value: string}>;
} | null;

type Recipe = {
  title: string;
  description: string;
  items: Array<{label: string; value: string}>;
  video?: {
    url: string;
    title?: string;
    thumbnail?: string;
  };
};

type RecipeVideoEmbed = {
  provider: 'instagram' | 'video' | 'youtube';
  src: string;
  thumbnail?: string;
};

const PROFILE_FIELDS = [
  ['Roast', 'roast'],
  ['Body', 'body'],
  ['Sweetness', 'sweetness'],
  ['Astringency', 'astringency'],
  ['Caffeine', 'caffeineScore'],
  ['Bitterness', 'bitterness'],
] as const;

const RECIPE_FIELDS = [
  ['hot', 'Hot', 'recipeHot'],
  ['iced', 'Iced', 'recipeIced'],
  ['latte', 'Latte', 'recipeLatte'],
] as const;

export function ProductEditorialSections({
  product,
  selectedVariant,
}: {
  product: ProductEditorialData;
  selectedVariant: VariantData;
}) {
  return (
    <div className="tea-editorial">
      <CupCharacter product={product} />
      <RecipeExperience product={product} />
      <TeaFit product={product} />
      <WhyThisTea product={product} />
      <TeaRecord product={product} selectedVariant={selectedVariant} />
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  intro,
  id,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  id: string;
}) {
  return (
    <header className="tea-section-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2 id={id}>{title}</h2>
      </div>
      {intro && <p>{intro}</p>}
    </header>
  );
}

function CupCharacter({product}: {product: ProductEditorialData}) {
  const notes = parseStringList(product.tastingNotes?.value);

  return (
    <section
      id="tea-character-section"
      className="tea-section tea-character-section"
      suppressHydrationWarning
      aria-labelledby="cup-character-title"
    >
      <SectionHeading
        eyebrow="Taste profile"
        title="What does it taste like?"
        intro="See the flavour, body and drinking style before you choose your pack."
        id="cup-character-title"
      />
      <div className="tea-character-layout">
        <div className="tea-profile" aria-label="Tea character scores">
          {PROFILE_FIELDS.map(([label, key]) => {
            const score = parseScore(product[key]?.value);
            if (score == null) return null;
            return (
              <div className="tea-meter" key={key}>
                <div className="tea-meter-label">
                  <span>{label}</span>
                  <strong>{score} / 5</strong>
                </div>
                <div className="tea-meter-track" aria-hidden="true">
                  <span style={{width: `${score * 20}%`}} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="tea-character-copy">
          <span className="eyebrow">What you’ll notice</span>
          {notes.length > 0 ? (
            <ul className="tea-notes" aria-label="Tasting notes">
              {notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : (
            <p className="tea-empty">Tasting notes are being prepared.</p>
          )}
          <div className="tea-character-facts">
            <Fact label="Best time" value={product.bestTime?.value} />
            <Fact label="With milk" value={product.milkPairing?.value} />
          </div>
          {(product.characterSummary?.value || product.description) && (
            <div className="tea-callout">
              <p>{product.characterSummary?.value || product.description}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Fact({label, value}: {label: string; value?: string}) {
  if (!value?.trim()) return null;
  return (
    <div>
      <span>{label}</span>
      <strong>{value.trim()}</strong>
    </div>
  );
}

function RecipeExperience({product}: {product: ProductEditorialData}) {
  const recipes = RECIPE_FIELDS.map(([id, label, key]) => ({
    id,
    label,
    recipe: parseRecipe(product[key]?.value),
  })).filter((item) => item.recipe);
  const [activeId, setActiveId] = useState<string>(recipes[0]?.id ?? 'hot');
  const active = recipes.find((item) => item.id === activeId) ?? recipes[0];
  if (!active) return null;

  return (
    <section
      id="tea-recipe-section"
      className="tea-section tea-recipe-section"
      suppressHydrationWarning
      aria-labelledby="tea-recipe-title"
    >
      <SectionHeading
        eyebrow="Brewing guide"
        title="How to make your best cup."
        id="tea-recipe-title"
      />
      <div className="tea-recipe-tabs" role="tablist" aria-label="Preparation style">
        {recipes.map((item) => (
          <button
            aria-controls={`recipe-${item.id}`}
            aria-selected={active.id === item.id}
            className={active.id === item.id ? 'is-active' : undefined}
            id={`recipe-tab-${item.id}`}
            key={item.id}
            onClick={() => setActiveId(item.id)}
            role="tab"
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
      <div
        aria-labelledby={`recipe-tab-${active.id}`}
        className="tea-recipe-panel"
        id={`recipe-${active.id}`}
        role="tabpanel"
      >
        {active.recipe ? (
          <>
            <div className="tea-recipe-copy">
              <h3>{active.recipe.title}</h3>
              <p>{active.recipe.description}</p>
              <RecipeVideo video={active.recipe.video} />
            </div>
            <dl>
              {active.recipe.items.map((item) => (
                <div key={`${item.label}-${item.value}`}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : (
          <div className="tea-recipe-empty">
            <h3>{active.label} recipe</h3>
            <p>This preparation will be added to the tea record soon.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function RecipeVideo({video}: {video?: Recipe['video']}) {
  const embed = getRecipeVideoEmbed(video?.url);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  if (!embed) return null;

  const title = video?.title?.trim() || 'Watch this tea preparation';
  const thumbnail = getSafeImageUrl(video?.thumbnail) || embed.thumbnail;
  const modalSrc =
    embed.provider === 'youtube' ? `${embed.src}?autoplay=1` : embed.src;

  return (
    <>
      <button
        aria-label={`Play video: ${title}`}
        className={`tea-recipe-video-thumb tea-recipe-video-thumb--${embed.provider}`}
        onClick={() => setIsOpen(true)}
        type="button"
      >
        {thumbnail ? (
          <img alt="" loading="lazy" src={thumbnail} />
        ) : (
          <span className="tea-recipe-video-placeholder" aria-hidden="true">
            {embed.provider === 'instagram' ? 'Instagram Reel' : 'Preparation video'}
          </span>
        )}
        <span className="tea-recipe-video-play" aria-hidden="true">▶</span>
        <span className="tea-recipe-video-label">Watch preparation</span>
      </button>

      {isOpen && (
        <div
          aria-label={title}
          aria-modal="true"
          className="tea-recipe-video-backdrop"
          onClick={(event) => {
            if (event.currentTarget === event.target) setIsOpen(false);
          }}
          role="dialog"
        >
          <div className={`tea-recipe-video-modal tea-recipe-video-modal--${embed.provider}`}>
            <button
              aria-label="Close video"
              className="tea-recipe-video-close"
              onClick={() => setIsOpen(false)}
              type="button"
            >
              ×
            </button>
            {embed.provider === 'video' ? (
              <video
                autoPlay
                controls
                playsInline
                poster={thumbnail}
                preload="metadata"
                src={embed.src}
              >
                Your browser does not support embedded video.
              </video>
            ) : (
              <iframe
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                src={modalSrc}
                title={title}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function TeaRecord({
  product,
  selectedVariant,
}: {
  product: ProductEditorialData;
  selectedVariant: VariantData;
}) {
  const selectedWeight = selectedVariant?.selectedOptions.find((option) =>
    /size|weight|pack/i.test(option.name),
  )?.value;
  const packSizes = product.options
    .find((option) => /size|weight|pack/i.test(option.name))
    ?.optionValues.map((option) => option.name)
    .join(' / ');
  const harvest = [product.harvest?.value, product.flush?.value, product.pluckDate?.value]
    .filter(Boolean)
    .join(' · ');
  const teaVariety = taxonomyLabels(product.taxonomyTeaVariety).join(', ');
  const teaInputType = taxonomyLabels(product.taxonomyTeaInputType).join(', ');
  const tasteProfile = taxonomyLabels(product.taxonomyTasteProfile).join(', ');
  const records = [
    ['Origin', product.origin?.value],
    ['Estate', product.estate?.value],
    ['Cultivar', product.cultivar?.value],
    [
      'Tea type',
      product.teaStyle?.value ||
        teaVariety ||
        product.productType ||
        product.category?.name,
    ],
    ['Tea format', teaInputType],
    ['Taste profile', tasteProfile],
    ['Process', product.process?.value],
    ['Grade', product.grade?.value],
    ['Harvest', harvest],
    ['Ingredients', formatValue(product.ingredients?.value)],
    ['Caffeine level', product.caffeineLevel?.value],
    ['Preparation', product.brewingSuggestion?.value],
    ['Storage', product.storage?.value],
    ['Shelf life', product.shelfLife?.value],
    ['Allergens', product.allergens?.value],
    ['Certifications', product.certifications?.value],
    ['Lot', product.lotNumber?.value],
    ['Pack size', formatValue(product.netWeight?.value) || packSizes || selectedWeight],
  ] as const;
  const filled = records.filter(([, value]) => Boolean(value));
  if (filled.length === 0) return null;

  const meaningful = filled.filter(([, value]) => {
    const normalized = String(value).trim();
    return !/^(replace with|todo|tbd|coming soon|revealed soon)/i.test(normalized);
  });
  if (meaningful.length === 0) return null;

  const highlightOrder = ['Origin', 'Estate', 'Harvest', 'Grade', 'Lot', 'Pack size'];
  const highlights = highlightOrder
    .map((label) => meaningful.find(([recordLabel]) => recordLabel === label))
    .filter(Boolean)
    .slice(0, 4) as Array<(typeof meaningful)[number]>;

  return (
    <section
      id="tea-record-section"
      className="tea-section tea-record-section"
      suppressHydrationWarning
      aria-labelledby="tea-record-title"
    >
      <SectionHeading
        eyebrow="Product information"
        title="What you’re getting."
        intro="Clear details about the tea’s origin, harvest, ingredients and pack."
        id="tea-record-title"
      />
      {highlights.length > 0 && (
        <dl className="tea-record-highlights">
          {highlights.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="tea-record-details">
        <div className="tea-record-summary">
          <span className="tea-record-summary-copy">
            <strong>Complete product information</strong>
            <small>Ingredients, processing, storage, pack size and more</small>
          </span>
        </div>
        <dl className="tea-record-grid">
          {meaningful.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="tea-record-shop-cta">
        <div>
          <strong>Ready to try this tea?</strong>
          <span>Choose your pack size and checkout securely.</span>
        </div>
        <a href="#product-buy-box">Choose pack &amp; buy ↑</a>
      </div>
    </section>
  );
}

function TeaFit({product}: {product: ProductEditorialData}) {
  const yes = parseStringList(product.isThisTeaYes?.value);
  const no = parseStringList(product.isThisTeaNo?.value);
  if (yes.length === 0 && no.length === 0) return null;

  return (
    <section id="tea-fit-section" className="tea-section tea-fit-section" suppressHydrationWarning aria-labelledby="tea-fit-title">
      <div className="tea-section-shell">
        <SectionHeading
          eyebrow="Find your match"
          title="Is this tea right for you?"
          id="tea-fit-title"
        />
        <div className="tea-fit-grid">
          <FitList heading="You’ll probably love this if…" items={yes} tone="yes" />
          <FitList heading="Maybe look elsewhere if…" items={no} tone="no" />
        </div>
      </div>
    </section>
  );
}

function FitList({
  heading,
  items,
  tone,
}: {
  heading: string;
  items: string[];
  tone: 'yes' | 'no';
}) {
  return (
    <div className={`tea-fit-card tea-fit-card--${tone}`}>
      <h3>{heading}</h3>
      {items.length > 0 ? (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="tea-empty">Guidance is being prepared.</p>
      )}
    </div>
  );
}

function WhyThisTea({product}: {product: ProductEditorialData}) {
  if (!product.whyChooseTea?.value) return null;

  return (
    <section id="tea-why-section" className="tea-section tea-why-section" suppressHydrationWarning aria-labelledby="why-this-tea-title">
      <div className="tea-section-shell">
        <SectionHeading
          eyebrow="Why you’ll love it"
          title="What makes this tea worth choosing."
          id="why-this-tea-title"
        />
        <blockquote className="tea-founder-note">
          <p>{product.whyChooseTea.value}</p>
          {product.whyChooseAttribution?.value && (
            <footer>— {product.whyChooseAttribution.value}</footer>
          )}
        </blockquote>
      </div>
    </section>
  );
}

function parseScore(value?: string) {
  if (!value) return null;
  const score = Number(value);
  if (!Number.isFinite(score)) return null;
  return Math.min(5, Math.max(0, score));
}

function parseStringList(value?: string) {
  if (!value?.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0,
      );
    }
  } catch {
    // Accept newline-separated text as a safe fallback for older metafields.
  }
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseRecipe(value?: string): Recipe | null {
  if (!value?.trim()) return null;
  try {
    const parsed = JSON.parse(value) as Partial<Recipe>;
    if (!parsed.title || !Array.isArray(parsed.items)) return null;
    const items = parsed.items.filter((item): item is {label: string; value: string} =>
      Boolean(item && typeof item.label === 'string' && typeof item.value === 'string'),
    );
    return {
      title: parsed.title,
      description: typeof parsed.description === 'string' ? parsed.description : '',
      items,
      video:
        parsed.video &&
        typeof parsed.video === 'object' &&
        typeof parsed.video.url === 'string' &&
        parsed.video.url.trim()
          ? {
              url: parsed.video.url.trim(),
              title:
                typeof parsed.video.title === 'string'
                  ? parsed.video.title.trim()
                  : undefined,
              thumbnail:
                typeof parsed.video.thumbnail === 'string'
                  ? parsed.video.thumbnail.trim()
                  : undefined,
            }
          : undefined,
    };
  } catch {
    return null;
  }
}

function getRecipeVideoEmbed(url?: string): RecipeVideoEmbed | null {
  if (!url?.trim()) return null;

  try {
    const parsed = new URL(url.trim());
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');

    if (/\.(mp4|m4v|webm|ogg)$/i.test(parsed.pathname)) {
      return {
        provider: 'video',
        src: parsed.toString(),
      };
    }

    if (hostname === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      return youtubeEmbed(id);
    }

    if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
      const segments = parsed.pathname.split('/').filter(Boolean);
      const id =
        parsed.pathname === '/watch'
          ? parsed.searchParams.get('v')
          : ['embed', 'shorts', 'live'].includes(segments[0] ?? '')
            ? segments[1]
            : null;
      return youtubeEmbed(id);
    }

    if (hostname === 'instagram.com') {
      const segments = parsed.pathname.split('/').filter(Boolean);
      if (!['p', 'reel', 'reels', 'tv'].includes(segments[0] ?? '') || !segments[1]) {
        return null;
      }
      const mediaType = segments[0] === 'reels' ? 'reel' : segments[0];
      return {
        provider: 'instagram',
        src: `https://www.instagram.com/${mediaType}/${segments[1]}/embed/`,
      };
    }
  } catch {
    // Ignore malformed or unsupported URLs from the metafield.
  }

  return null;
}

function youtubeEmbed(id?: string | null): RecipeVideoEmbed | null {
  if (!id || !/^[A-Za-z0-9_-]{6,}$/.test(id)) return null;
  return {
    provider: 'youtube',
    src: `https://www.youtube-nocookie.com/embed/${id}`,
    thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  };
}

function getSafeImageUrl(url?: string) {
  if (!url?.trim()) return undefined;
  try {
    const parsed = new URL(url.trim());
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

function formatValue(value?: string) {
  if (!value?.trim()) return '';
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) return parsed.join(', ');
    if (parsed && typeof parsed === 'object' && 'value' in parsed) {
      const measurement = parsed as {value?: string | number; unit?: string};
      if (measurement.value == null) return value;
      const units: Record<string, string> = {
        GRAMS: 'g',
        KILOGRAMS: 'kg',
        OUNCES: 'oz',
        POUNDS: 'lb',
      };
      return `${measurement.value}${measurement.unit ? ` ${units[measurement.unit] || measurement.unit.toLowerCase()}` : ''}`;
    }
  } catch {
    // Plain text is already display-ready.
  }
  return value;
}

function taxonomyLabels(metafield?: TaxonomyMetafield) {
  return (
    metafield?.references?.nodes
      .map((node) => node.label?.value?.trim())
      .filter((value): value is string => Boolean(value)) ?? []
  );
}
