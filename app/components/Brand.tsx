import {Link} from 'react-router';
import riverThreadLogo from '../../river-thread-web/svg/header-quiet.svg?url';

export function Brand() {
  return (
    <Link to="/" className="wordmark" aria-label="Charaideo Reserves home">
      <img src={riverThreadLogo} alt="" width="1200" height="360" />
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
