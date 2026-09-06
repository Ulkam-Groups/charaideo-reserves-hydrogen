import {Link} from 'react-router';

export function Brand() {
  return <Link to="/" className="wordmark" aria-label="Charaideo Reserves home"><span>CHARAIDEO</span><small>R E S E R V E S</small></Link>;
}

export function TextileRule() {
  return <div className="textile-rule" aria-hidden="true"><span>◇</span><span>◇</span><span>◇</span></div>;
}
