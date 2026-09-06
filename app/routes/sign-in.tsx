import {Link, redirect} from 'react-router';
import type {Route} from './+types/sign-in';
import {TextileRule} from '~/components/Brand';

export const meta = () => [{title: 'Your tea room | Charaideo Reserves'}];

export async function loader({context}: Route.LoaderArgs) {
  if (await context.customerAccount.isLoggedIn()) return redirect('/account');
  return null;
}

export default function SignIn() {
  return (
    <section className="signin-page">
      <div className="signin-story">
        <span className="eyebrow">A place at our table / 01</span>
        <span className="signin-cha" aria-hidden="true">চ</span>
        <h1>Your next<br /><em>cup awaits.</em></h1>
        <TextileRule />
        <p>Old favourites. New discoveries.<br />A little Assam, wherever you are.</p>
      </div>
      <div className="signin-panel">
        <span className="eyebrow">Your account</span>
        <h2>Welcome back.</h2>
        <p>Sign in to see your orders and manage your details, ready for your next tea ritual.</p>
        <a className="button primary" href="/account/login">Continue to sign in <span aria-hidden="true">↗</span></a>
        <p className="fine-print">You’ll continue to our secure sign-in page. New here? You can create your account there too.</p>
        <Link className="text-link" to="/collections/all">Keep exploring the teas →</Link>
      </div>
    </section>
  );
}
