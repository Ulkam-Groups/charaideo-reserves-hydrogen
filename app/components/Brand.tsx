import {Link} from 'react-router';
import riverThreadLogo from '../../river-thread-web/teacup-brand/svg/header-quiet.svg?url';
import riverThreadLogoLight from '../../river-thread-web/teacup-brand/svg/header-quiet-light.svg?url';

export function Brand({variant = 'default'}: {variant?: 'default' | 'light'}) {
  const logo = variant === 'light' ? riverThreadLogoLight : riverThreadLogo;

  return (
    <Link to="/" className="wordmark" aria-label="Charaideo Reserves home">
      <img src={logo} alt="" width="1200" height="360" />
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
