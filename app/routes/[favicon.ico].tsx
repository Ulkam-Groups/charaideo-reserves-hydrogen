import {redirect} from 'react-router';
import favicon from '~/assets/favicon.svg?url';

export function loader() {
  return redirect(favicon, 302);
}
