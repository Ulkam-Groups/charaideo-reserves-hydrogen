import {useMemo, useState} from 'react';
import {defaultBlendRules, priceBlend, validateBlend, type TeaIngredient} from '~/lib/blend';

export type BlendTea = Omit<TeaIngredient, 'grams'>;
export function BlendBuilder({teas, rules = defaultBlendRules}: {teas: BlendTea[]; rules?: typeof defaultBlendRules}) {
  const [items, setItems] = useState<TeaIngredient[]>([]);
  const [message, setMessage] = useState('');
  const validation = useMemo(() => validateBlend(items, rules), [items, rules]);
  const update = (tea: BlendTea, grams: number) => setItems((previous) => grams <= 0 ? previous.filter((item) => item.variantId !== tea.variantId) : [...previous.filter((item) => item.variantId !== tea.variantId), {...tea, grams}]);
  const checkout = async () => {
    if (!validation.valid) return setMessage(validation.errors[0]);
    setMessage('Preparing secure Shopify checkout…');
    const response = await fetch('/api/blend-checkout', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({items})});
    const data = await response.json() as {checkoutUrl?: string; error?: string};
    if (data.checkoutUrl) window.location.assign(data.checkoutUrl);
    else setMessage(data.error || 'Could not start checkout.');
  };
  return <section className="blend-builder">
    <div className="eyebrow">Build a box</div><h1>Your own tea blend</h1><p>Choose up to {rules.maxItems} teas. Every selection moves in 5g steps and is packed separately inside one box.</p>
    <div className="tea-grid">{teas.filter((tea) => tea.eligible).map((tea) => { const current = items.find((item) => item.variantId === tea.variantId)?.grams || 0; return <article className="tea-card" key={tea.variantId}><h2>{tea.title}</h2><p>₹{tea.pricePerGram.toFixed(2)} / g · up to {tea.maxContributionGrams}g</p><label>Grams <input aria-label={`${tea.title} grams`} type="number" min="0" max={tea.maxContributionGrams} step={rules.incrementGrams} value={current} onChange={(event) => update(tea, Number(event.target.value))}/></label></article>;})}</div>
    <aside className="blend-summary"><strong>{validation.totalGrams}g selected</strong><span>Ingredient price + packaging: ₹{priceBlend(items, rules).toFixed(2)}</span><button onClick={checkout} disabled={!validation.valid}>Add blend and go to checkout</button>{message && <p role="status">{message}</p>}{!validation.valid && items.length > 0 && <p>{validation.errors.join(' ')}</p>}</aside>
  </section>;
}
