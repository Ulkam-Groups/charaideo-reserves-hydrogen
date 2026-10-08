import {Money} from '@shopify/hydrogen';
import type {MoneyV2} from '@shopify/hydrogen/storefront-api-types';
import type {
  DiscountProgressItem,
  DiscountProgressMilestone,
  DiscountProgressStatus,
} from '~/lib/discount-progress';
import {
  discountProgressAmount,
  isDiscountProgressEligible,
} from '~/lib/discount-progress';

export function DiscountProgress({
  items = [],
  milestones,
  status,
  surface,
}: {
  items?: readonly DiscountProgressItem[];
  milestones: DiscountProgressMilestone[];
  status: DiscountProgressStatus;
  surface: 'cart' | 'product';
}) {
  if (status !== 'ready') return null;
  if (!items.length || !milestones.length) return null;

  const eligibleMilestones = milestones.filter(
    (milestone) =>
      (surface === 'cart' || milestone.productSpecific) &&
      isDiscountProgressEligible(milestone, items),
  );
  if (!eligibleMilestones.length) return null;

  const amounts = new Map(
    eligibleMilestones.map((milestone) => [
      milestone.id,
      discountProgressAmount(milestone, items),
    ]),
  );
  const maximum = Math.max(...eligibleMilestones.map((item) => item.threshold));
  const progress = Math.min(
    100,
    Math.max(
      ...eligibleMilestones.map(
        (milestone) =>
          (Math.min(amounts.get(milestone.id) ?? 0, milestone.threshold) / maximum) *
          100,
      ),
    ),
  );
  const next = eligibleMilestones.find(
    (milestone) => (amounts.get(milestone.id) ?? 0) < milestone.threshold,
  );
  const reached = eligibleMilestones.filter(
    (milestone) => (amounts.get(milestone.id) ?? 0) >= milestone.threshold,
  );
  const lastReached = reached[reached.length - 1];
  const money = (value: number, currencyCode: MoneyV2['currencyCode']) => (
    <Money as="span" data={{amount: value.toFixed(2), currencyCode}} />
  );

  const gap = next ? next.threshold - (amounts.get(next.id) ?? 0) : 0;

  return (
    <section
      className={`discount-progress discount-progress--${surface}`}
      aria-label="Shopify offers"
      aria-live="polite"
    >
      <p className="discount-progress-message">
        <span className="discount-progress-emoji" aria-hidden="true">
          {lastReached ? '\u{1F389}' : '\u{1F381}'}
        </span>
        {next ? (
          <span>
            {lastReached ? `${lastReached.reward} unlocked \u00b7 ` : ''}
            Add {money(gap, next.currencyCode)} for <b>{next.reward}</b>
          </span>
        ) : (
          <span>
            <b>{reached.map((item) => item.reward).join(' \u00b7 ')}</b> unlocked
          </span>
        )}
      </p>
      <div
        className="discount-progress-track"
        role="progressbar"
        aria-label="Progress toward Shopify offers"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
      >
        <span className="discount-progress-fill" style={{width: `${progress}%`}} />
        {eligibleMilestones.map((milestone) => {
          const reachedMilestone =
            (amounts.get(milestone.id) ?? 0) >= milestone.threshold;
          return (
            <span
              key={milestone.id}
              className={`discount-progress-marker${reachedMilestone ? ' is-reached' : ''}`}
              style={{left: `${(milestone.threshold / maximum) * 100}%`}}
              title={`${milestone.reward} at ${milestone.threshold}`}
              aria-hidden="true"
            >
              {reachedMilestone ? '\u{1F389}' : ''}
            </span>
          );
        })}
      </div>
    </section>
  );
}