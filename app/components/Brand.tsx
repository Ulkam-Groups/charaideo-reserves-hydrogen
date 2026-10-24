import {Link} from 'react-router';
import logoWordmark from '~/assets/charaideo-reserves-logo-wordmark-now-medium-tm.svg';
import wordmark from '~/assets/charaideo-reserves-wordmark-tm.svg';

interface BrandProps {
  variant?: 'default' | 'light' | 'footer';
  endorsement?: string;
}

export function Brand({variant = 'default', endorsement}: BrandProps) {
  return (
    <Link
      to="/"
      className={`wordmark wordmark--${variant}${endorsement ? ' wordmark--endorsed' : ''}`}
      aria-label={
        endorsement
          ? `Charaideo Reserves, ${endorsement.toLowerCase()}, home`
          : 'Charaideo Reserves home'
      }
      prefetch="none"
    >
      <img
        src={variant === 'light' ? wordmark : logoWordmark}
        alt=""
      />
      {endorsement ? (
        <span className="wordmark-endorsement" aria-hidden="true">
          {endorsement}
        </span>
      ) : null}
    </Link>
  );
}

export function TextileRule() {
  return (
    <div className="textile-rule" aria-hidden="true">
      <span>◇</span>
      <i />
      <span>◇</span>
    </div>
  );
}
