import {useLocation} from 'react-router';
import {LOCALES, type LocaleKey} from '~/lib/i18n';

export function LocaleSelector({activeLocale, compact = false}: {activeLocale: LocaleKey; compact?: boolean}) {
  const location = useLocation();
  const active = LOCALES[activeLocale];
  const returnTo = `${location.pathname}${location.search}${location.hash}`;
  return (
    <details className={`locale-selector${compact ? ' locale-selector--mobile' : ' header-locale'}`}>
      <summary aria-label={`Country and language: ${active.label}`} title={active.label}>
        <span aria-hidden="true">{active.flag}</span>
      </summary>
      <div className="locale-selector-menu" role="group" aria-label="Choose country and language">
        {(Object.entries(LOCALES) as Array<[LocaleKey, (typeof LOCALES)[LocaleKey]]>).map(([key, locale]) => (
          <form action="/locale" key={key} method="post">
            <input name="returnTo" type="hidden" value={returnTo} />
            <input name="locale" type="hidden" value={key} />
            <button aria-current={key === activeLocale ? 'true' : undefined} type="submit">
              <span aria-hidden="true">{locale.flag}</span>
              <span>{locale.label}</span>
            </button>
          </form>
        ))}
      </div>
    </details>
  );
}
