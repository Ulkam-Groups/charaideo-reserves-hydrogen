import {Link} from 'react-router';
import logo from '~/assets/charaideo_logo_transparent.png';

export function Brand({variant = 'default'}: {variant?: 'default' | 'light'}) {
  return (
    <Link to="/" className={`wordmark wordmark--${variant}`} aria-label="Charaideo Reserves home">
      <img src={logo} alt="" />
    </Link>
  );
}

export function TextileRule() {
  return (
    <div className="textile-rule" aria-hidden="true">
      <span>◇</span><i /><span>◇</span>
    </div>
  );
}
