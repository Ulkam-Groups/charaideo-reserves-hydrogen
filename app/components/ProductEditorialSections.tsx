import {useState} from 'react';

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
      <TeaRecord product={product} selectedVariant={selectedVariant} />
      <CupCharacter product={product} />
      <RecipeExperience product={product} />
      <WhyThisTea product={product} />
      <TeaFit product={product} />
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
      className="tea-section tea-character-section"
      aria-labelledby="cup-character-title"
    >
      <SectionHeading
        eyebrow="This reserve in 10 seconds"
        title="The character of the cup."
        intro="A clear view of how this tea is likely to feel and taste in your cup."
        id="cup-character-title"
      />
      <div className="tea-character-layout">
        <div className="tea-profile" aria-label="Tea character scores">
          {PROFILE_FIELDS.map(([label, key]) => {
            const score = parseScore(product[key]?.value);
            return (
              <div className="tea-meter" key={key}>
                <div className="tea-meter-label">
                  <span>{label}</span>
                  <strong>{score == null ? 'Not set' : `${score} / 5`}</strong>
                </div>
                <div className="tea-meter-track" aria-hidden="true">
                  <span style={{width: `${(score ?? 0) * 20}%`}} />
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
  return (
    <div>
      <span>{label}</span>
      <strong>{value?.trim() || 'Not yet provided'}</strong>
    </div>
  );
}

function RecipeExperience({product}: {product: ProductEditorialData}) {
  const recipes = RECIPE_FIELDS.map(([id, label, key]) => ({
    id,
    label,
    recipe: parseRecipe(product[key]?.value),
  }));
  const firstAvailable = recipes.find((item) => item.recipe)?.id ?? 'hot';
  const [activeId, setActiveId] = useState(firstAvailable);
  const active = recipes.find((item) => item.id === activeId) ?? recipes[0];

  return (
    <section
      className="tea-section tea-recipe-section"
      aria-labelledby="tea-recipe-title"
    >
      <SectionHeading
        eyebrow="Make it yours"
        title="Experience it your way."
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
            <div>
              <h3>{active.recipe.title}</h3>
              <p>{active.recipe.description}</p>
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
    ['Taxonomy taste profile', tasteProfile],
    ['Process', product.process?.value],
    ['Grade', product.grade?.value],
    ['Harvest', harvest],
    ['Ingredients', formatValue(product.ingredients?.value)],
    ['Lot', product.lotNumber?.value],
    ['Pack size', formatValue(product.netWeight?.value) || packSizes || selectedWeight],
    ['SKU', selectedVariant?.sku],
    ['Shopify category', product.category?.name],
  ] as const;

  return (
    <section
      className="tea-section tea-record-section"
      aria-labelledby="tea-record-title"
    >
      <SectionHeading
        eyebrow="Product details"
        title="Traceability"
        intro="Origin, craft and pack details—read directly from this product’s Shopify record."
        id="tea-record-title"
      />
      <dl className="tea-record-grid">
        {records.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className={value ? undefined : 'is-missing'}>
              {value || 'Not yet provided'}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function TeaFit({product}: {product: ProductEditorialData}) {
  const yes = parseStringList(product.isThisTeaYes?.value);
  const no = parseStringList(product.isThisTeaNo?.value);

  return (
    <section className="tea-section tea-fit-section" aria-labelledby="tea-fit-title">
      <div className="tea-section-shell">
        <SectionHeading
          eyebrow="Know before you buy"
          title="Is this your tea?"
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
  return (
    <section className="tea-section tea-why-section" aria-labelledby="why-this-tea-title">
      <div className="tea-section-shell">
        <SectionHeading
          eyebrow="The reason it belongs here"
          title="Why we chose this tea."
          id="why-this-tea-title"
        />
        <blockquote className="tea-founder-note">
          <p>
            {product.whyChooseTea?.value ||
              'The curator’s note for this reserve is coming soon.'}
          </p>
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
    };
  } catch {
    return null;
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
