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
}: {
  items?: readonly DiscountProgressItem[];
  /** Items that decide which offers belong on this surface. Defaults to items. */
  eligibilityItems?: readonly DiscountProgressItem[];
  milestones: DiscountProgressMilestone[];
  status: DiscountProgressStatus;
  surface: 'cart' | 'product';
  /** Hold the celebration while the cart is still updating. */
  paused?: boolean;
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
  const maximum = Math.max(...eligibleMilestones.map((item) => item.threshold));
  // Leave a short runway after the final offer so the last milestone does not
  // look like a hard limit on how much a customer can add to their cart.
  const visualMaximum = maximum * 1.1;
  const progress = Math.min(
    100,
    Math.max(
      ...eligibleMilestones.map(
        (milestone) => {
          const fillLimit =
            milestone.threshold === maximum ? visualMaximum : milestone.threshold;
          return (
            (Math.min(amounts.get(milestone.id) ?? 0, fillLimit) /
              visualMaximum) *
            100
          );
        },
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
              style={{left: `${(milestone.threshold / visualMaximum) * 100}%`}}
              title={`${milestone.reward} at ${milestone.threshold}`}
              aria-hidden="true"
            >
              {reachedMilestone ? '\u2713' : ''}
            </span>
          );
        })}
      </div>
      {surface === 'cart' && (
        <div className="discount-progress-labels" aria-hidden="true">
          {eligibleMilestones.map((milestone) => {
            const done = (amounts.get(milestone.id) ?? 0) >= milestone.threshold;
            const position = (milestone.threshold / visualMaximum) * 100;
            return (
              <span
                key={milestone.id}
                className={`discount-progress-label${done ? ' is-reached' : ''}${
                  position >= 99 ? ' is-last' : ''
                }`}
                style={{left: `${position}%`}}
              >
                <b>{money(milestone.threshold, milestone.currencyCode)}</b>
                <small>{milestone.reward}</small>
              </span>
            );
          })}
        </div>
      )}
      <CelebrationBanner surface={surface} paused={paused} rewards={reached.map((item) => ({id: item.id, reward: item.reward}))} />
    </section>
  );
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
