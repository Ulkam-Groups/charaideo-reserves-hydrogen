import {Money} from '@shopify/hydrogen';
import type {MoneyV2} from '@shopify/hydrogen/storefront-api-types';
import type {
  DiscountProgressMilestone,
  DiscountProgressStatus,
} from '~/lib/discount-progress';

export function DiscountProgress({
  amount,
  currencyCode,
  milestones,
  status,
  surface,
}: {
  amount?: string | number | null;
  currencyCode?: MoneyV2['currencyCode'] | null;
  milestones: DiscountProgressMilestone[];
  status: DiscountProgressStatus;
  surface: 'cart' | 'product';
}) {
  if (status !== 'ready') return null;

  const currentAmount = amount == null ? Number.NaN : Number(amount);
  if (
    !Number.isFinite(currentAmount) ||
    !currencyCode ||
    !milestones.length
  ) {
    return null;
  }

  const eligibleMilestones = milestones.filter(
    (milestone) => milestone.currencyCode === currencyCode,
  );
  if (!eligibleMilestones.length) return null;

  const maximum = Math.max(...eligibleMilestones.map((item) => item.threshold));
  const progress = Math.min(100, (currentAmount / maximum) * 100);
  const next = eligibleMilestones.find((item) => item.threshold > currentAmount);
  const reached = eligibleMilestones.filter(
    (item) => item.threshold <= currentAmount,
  );
  const lastReached = reached[reached.length - 1];
  const money = (value: number) => (
    <Money data={{amount: value.toFixed(2), currencyCode}} />
  );

  return (
    <section
      className={`discount-progress discount-progress--${surface}`}
      aria-label="Shopify offers"
      aria-live="polite"
    >
      <p className="discount-progress-message">
        {next ? (
          <>
            {lastReached ? (
              <>
                {lastReached.reward} unlocked. Add {money(next.threshold - currentAmount)} to reach{' '}
                {next.reward}.
              </>
            ) : (
              <>
                Add {money(next.threshold - currentAmount)} to unlock {next.reward}.
              </>
            )}
          </>
        ) : (
          <>
            {reached.length
              ? `${reached.map((item) => item.reward).join(' · ')} reached.`
              : 'Add to cart to see your offer progress.'}
          </>
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
        <span
          className="discount-progress-fill"
          style={{width: `${progress}%`}}
        />
        {eligibleMilestones.map((milestone) => {
          const reachedMilestone = currentAmount >= milestone.threshold;
          return (
            <span
              key={milestone.id}
              className={`discount-progress-marker${reachedMilestone ? ' is-reached' : ''}`}
              style={{left: `${(milestone.threshold / maximum) * 100}%`}}
              aria-hidden="true"
            >
              {reachedMilestone ? '✓' : ''}
            </span>
          );
        })}
      </div>
      <ol className="discount-progress-tiers">
        {eligibleMilestones.map((milestone) => {
          const reachedMilestone = currentAmount >= milestone.threshold;
          const code = milestone.codes[0];
          return (
            <li
              key={milestone.id}
              className={reachedMilestone ? 'is-reached' : undefined}
              title={milestone.title}
            >
              <strong>{milestone.reward}</strong>
              <span>{money(milestone.threshold)}</span>
              {code && (
                <small>
                  {reachedMilestone ? 'Use code' : 'Code'} {code}
                </small>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
