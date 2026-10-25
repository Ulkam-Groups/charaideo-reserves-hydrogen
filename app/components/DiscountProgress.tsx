import {useEffect, useRef, useState} from 'react';
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
  eligibilityItems,
  milestones,
  status,
  surface,
  paused = false,
  detailsMode = 'inline',
  appliedMilestoneIds = [],
}: {
  items?: readonly DiscountProgressItem[];
  /** Items that decide which offers belong on this surface. Defaults to items. */
  eligibilityItems?: readonly DiscountProgressItem[];
  milestones: DiscountProgressMilestone[];
  status: DiscountProgressStatus;
  surface: 'cart' | 'product';
  /** Hold the celebration while the cart is still updating. */
  paused?: boolean;
  detailsMode?: 'inline' | 'popup';
  /** IDs confirmed by Shopify's cart discount allocations. */
  appliedMilestoneIds?: readonly string[];
}) {
  const offerEligibilityItems = eligibilityItems ?? items;

  useEffect(() => {
    if (status === 'ready' && !items.length && !paused) {
      seenRewards.set(surface, new Set());
    }
  }, [status, items.length, paused, surface]);

  if (status !== 'ready') return null;
  if (!offerEligibilityItems.length || !milestones.length) return null;

  const eligibleMilestones = milestones.filter(
    (milestone) => isDiscountProgressEligible(milestone, offerEligibilityItems),
  );
  if (!eligibleMilestones.length) return null;

  const amounts = new Map(
    eligibleMilestones.map((milestone) => [
      milestone.id,
      discountProgressAmount(milestone, items),
    ]),
  );
  if (surface === 'cart') {
    return (
      <CartDiscountProgress
        items={items}
        milestones={eligibleMilestones}
        paused={paused}
        detailsMode={detailsMode}
        appliedMilestoneIds={appliedMilestoneIds}
      />
    );
  }
  const maximum = Math.max(...eligibleMilestones.map((item) => item.threshold));
  // Leave a short runway after the final offer so the last milestone does not
  // look like a hard limit on how much a customer can add to their cart.
  const visualMaximum = maximum * 1.1;
  const next = eligibleMilestones.find(
    (milestone) => (amounts.get(milestone.id) ?? 0) < milestone.threshold,
  );
  const progress = next
    ? Math.min(
        100,
        Math.max(
          ...eligibleMilestones.map((milestone) => {
            const fillLimit =
              milestone.threshold === maximum
                ? visualMaximum
                : milestone.threshold;
            return (
              (Math.min(amounts.get(milestone.id) ?? 0, fillLimit) /
                visualMaximum) *
              100
            );
          }),
        ),
      )
    : 100;
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
      aria-label="Available offers"
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
        aria-label="Progress toward available offers"
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
              style={{left: `${(milestone.threshold / visualMaximum) * 100}%`}}
              title={`${milestone.reward} at ${milestone.threshold}`}
              aria-hidden="true"
            >
              {reachedMilestone ? '\u2713' : ''}
            </span>
          );
        })}
      </div>
      <CelebrationBanner surface={surface} paused={paused} rewards={reached.map((item) => ({id: item.id, reward: item.reward}))} />
    </section>
  );
}

function CartDiscountProgress({
  items,
  milestones,
  paused,
  detailsMode,
  appliedMilestoneIds,
}: {
  items: readonly DiscountProgressItem[];
  milestones: DiscountProgressMilestone[];
  paused: boolean;
  detailsMode: 'inline' | 'popup';
  appliedMilestoneIds: readonly string[];
}) {
  const popoverRef = useRef<HTMLDetailsElement>(null);
  const groups = groupMilestonesByTarget(milestones);
  const reached = milestones.filter(
    (milestone) =>
      discountProgressAmount(milestone, items) >= milestone.threshold,
  );
  const completion = (reached.length / milestones.length) * 100;

  useEffect(() => {
    if (detailsMode !== 'popup') return;

    const closePopover = (event: PointerEvent) => {
      const popover = popoverRef.current;
      if (
        popover?.open &&
        event.target instanceof Node &&
        !popover.contains(event.target)
      ) {
        popover.open = false;
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && popoverRef.current?.open) {
        popoverRef.current.open = false;
      }
    };

    document.addEventListener('pointerdown', closePopover);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closePopover);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [detailsMode]);
  const summaryContent = (
    <>
      <span className="discount-progress-summary-copy">
        <span aria-hidden="true">{reached.length ? '🎉' : '🎁'}</span>
        <strong>
          {reached.length} of {milestones.length} offer conditions met
        </strong>
        {detailsMode === 'inline' && (
          <span className="discount-progress-details-label">Offer details</span>
        )}
      </span>
      <span className="discount-progress-summary-milestones" aria-hidden="true">
        {milestones.map((milestone) => {
          const done =
            discountProgressAmount(milestone, items) >= milestone.threshold;
          return (
            <span
              key={milestone.id}
              className={done ? 'is-reached' : undefined}
              title={`${milestone.reward} at ${formatMoney(milestone.threshold, milestone.currencyCode)}`}
            >
              <i />
              {formatMoney(milestone.threshold, milestone.currencyCode)}{' '}
              {milestone.reward}
            </span>
          );
        })}
      </span>
      <span
        className="discount-progress-summary-track"
        role="progressbar"
        aria-label="Offers reached"
        aria-valuemin={0}
        aria-valuemax={milestones.length}
        aria-valuenow={reached.length}
      >
        <span style={{width: `${completion}%`}} />
      </span>
    </>
  );

  return (
    <section
      className="discount-progress discount-progress--cart discount-progress--grouped"
      aria-label="Available offers"
      aria-live="polite"
    >
      {detailsMode === 'popup' ? (
        <div className="discount-progress-popup-summary">
          {summaryContent}
          <details ref={popoverRef} className="discount-progress-popover">
            <summary>Offer details</summary>
            <div className="discount-progress-popover-panel">
              <div className="discount-progress-popover-head">
                <strong>Offer details</strong>
                <button
                  type="button"
                  aria-label="Close offer details"
                  onClick={() => {
                    if (popoverRef.current) popoverRef.current.open = false;
                  }}
                >
                  ×
                </button>
              </div>
              <CartDiscountProgressGroups groups={groups} items={items} appliedMilestoneIds={appliedMilestoneIds} />
            </div>
          </details>
        </div>
      ) : (
        <details className="discount-progress-details">
          <summary>{summaryContent}</summary>
          <CartDiscountProgressGroups groups={groups} items={items} appliedMilestoneIds={appliedMilestoneIds} />
        </details>
      )}
      <CelebrationBanner
        surface="cart"
        paused={paused}
        rewards={reached.map((item) => ({id: item.id, reward: item.reward}))}
      />
    </section>
  );
}

function CartDiscountProgressGroups({
  groups,
  items,
  appliedMilestoneIds,
}: {
  groups: ReturnType<typeof groupMilestonesByTarget>;
  items: readonly DiscountProgressItem[];
  appliedMilestoneIds: readonly string[];
}) {
  return (
    <div className="discount-progress-detail-panel">
      <div className="discount-progress-groups">
        {groups.map((group) => {
          const amount = discountProgressAmount(group.milestones[0], items);
          const maximum = Math.max(
            ...group.milestones.map((milestone) => milestone.threshold),
          );
          const visualMaximum = maximum * 1.05;
          const next = group.milestones.find(
            (milestone) => amount < milestone.threshold,
          );
          const lastReached = [...group.milestones]
            .reverse()
            .find((milestone) => amount >= milestone.threshold);
          const activeMilestone = next ?? lastReached ?? group.milestones[0];
          const appliedMilestone = [...group.milestones]
            .reverse()
            .find((milestone) => appliedMilestoneIds.includes(milestone.id));
          const groupTitles = [
            ...new Set(group.milestones.map(({title}) => title)),
          ];

          return (
            <div className="discount-progress-group" key={group.key}>
              <div className="discount-progress-group-copy">
                <strong>
                  {group.productSpecific
                    ? groupTitles.join(' / ')
                    : activeMilestone.reward}
                </strong>
                <span>
                  {appliedMilestone
                    ? `${appliedMilestone.reward} applied`
                    : !next && group.productSpecific && appliedMilestoneIds.length > 0
                      ? 'A better offer has been applied'
                      : next
                    ? `${formatMoney(next.threshold - amount, next.currencyCode)} more for ${next.reward}`
                    : 'Conditions met'}
                </span>
              </div>
              <div
                className="discount-progress-track"
                role="progressbar"
                aria-label={`${group.productSpecific ? 'Eligible products' : 'Whole cart'} offer progress`}
                aria-valuemin={0}
                aria-valuemax={maximum}
                aria-valuenow={Math.min(amount, maximum)}
              >
                <span
                  className="discount-progress-fill"
                  style={{
                    width: `${Math.min(100, (amount / visualMaximum) * 100)}%`,
                  }}
                />
                {group.milestones.map((milestone) => {
                  const done = amount >= milestone.threshold;
                  return (
                    <span
                      key={milestone.id}
                      className={`discount-progress-marker${done ? ' is-reached' : ''}`}
                      style={{
                        left: `${(milestone.threshold / visualMaximum) * 100}%`,
                      }}
                      title={`${milestone.reward}: ${formatMoney(amount, milestone.currencyCode)} counted toward ${formatMoney(milestone.threshold, milestone.currencyCode)}`}
                      aria-hidden="true"
                    >
                      {done ? '✓' : ''}
                    </span>
                  );
                })}
              </div>
              <div className="discount-progress-group-labels">
                {group.productSpecific && activeMilestone.eligibleItems?.labels.length ? (
                  <details className="discount-progress-eligible-items">
                    <summary>
                      Eligible {activeMilestone.eligibleItems.kind} only ({activeMilestone.eligibleItems.labels.length})
                    </summary>
                    <ul>
                      {activeMilestone.eligibleItems.labels.map((label) => (
                        <li key={label}>{label}</li>
                      ))}
                    </ul>
                  </details>
                ) : (
                  <span>
                    {group.productSpecific ? 'Eligible products only' : 'Whole cart'}
                  </span>
                )}
                <span aria-hidden="true">
                  {formatMoney(amount, activeMilestone.currencyCode)} /{' '}
                  {formatMoney(
                    activeMilestone.threshold,
                    activeMilestone.currencyCode,
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function groupMilestonesByTarget(milestones: DiscountProgressMilestone[]) {
  const groups = new Map<
    string,
    {
      key: string;
      productSpecific: boolean;
      milestones: DiscountProgressMilestone[];
    }
  >();

  milestones.forEach((milestone) => {
    const key = JSON.stringify({
      currencyCode: milestone.currencyCode,
      allItems: milestone.targets.allItems,
      productIds: [...milestone.targets.productIds].sort(),
      variantIds: [...milestone.targets.variantIds].sort(),
      collectionIds: [...milestone.targets.collectionIds].sort(),
    });
    const group = groups.get(key);
    if (group) {
      group.milestones.push(milestone);
    } else {
      groups.set(key, {
        key,
        productSpecific: milestone.productSpecific,
        milestones: [milestone],
      });
    }
  });

  return [...groups.values()];
}

function formatMoney(value: number, currencyCode: MoneyV2['currencyCode']) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(value);
}

const CONFETTI = Array.from({length: 16}, (_, index) => index);

// Survives remounts (the cart aside can remount after a revalidation).
const seenRewards = new Map<string, Set<string>>();

/** Shows a short celebration when a milestone is newly reached (not on first load). */
function CelebrationBanner({
  rewards,
  paused,
  surface,
}: {
  rewards: {id: string; reward: string}[];
  paused: boolean;
  surface: string;
}) {
  const [message, setMessage] = useState('');
  const timer = useRef<number>(0);
  const key = rewards.map((item) => item.id).join('|');

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (paused) return;
    const seen = seenRewards.get(surface);
    if (!seen) {
      seenRewards.set(surface, new Set(rewards.map((item) => item.id)));
      return;
    }
    const fresh = rewards.filter((item) => !seen.has(item.id));
    rewards.forEach((item) => seen.add(item.id));
    if (!fresh.length) return;
    setMessage(fresh.map((item) => item.reward).join(' + '));
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(''), 4200);
  }, [key, paused]);

  if (!message) return null;
  return (
    <div className="discount-celebration" role="status">
      {CONFETTI.map((index) => (
        <i key={index} style={{'--i': index} as React.CSSProperties} aria-hidden="true" />
      ))}
      <span className="discount-celebration-text">
        <span aria-hidden="true">{'\u{1F389}'}</span> {message} unlocked!
      </span>
    </div>
  );
}
