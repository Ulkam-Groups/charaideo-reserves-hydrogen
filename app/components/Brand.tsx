import {Link} from 'react-router';
import logoWordmark from '~/assets/charaideo-reserves-logo-wordmark-tm.svg';
import wordmark from '~/assets/charaideo-reserves-wordmark-tm.svg';

export function Brand({variant = 'default'}: {variant?: 'default' | 'light'}) {
  return (
    <Link
      to="/"
      className={`wordmark wordmark--${variant}`}
      aria-label="Charaideo Reserves home"
    >
      <img src={variant === 'light' ? wordmark : logoWordmark} alt="" />
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
