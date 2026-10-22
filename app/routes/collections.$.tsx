import {redirect} from 'react-router';

export function loader() {
  return redirect('/reserve-list', 301);
}

export default function CollectionsCatchAll() {
  return null;
}
