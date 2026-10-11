import {flatRoutes} from '@react-router/fs-routes';
import {prefix, type RouteConfig, type RouteConfigEntry} from '@react-router/dev/routes';
import {hydrogenRoutes} from '@shopify/hydrogen';

const routes = await flatRoutes();
const LOCALIZED_PATHS = /^(?:$|blends|cart(?:\/|$)|collections(?:\/|$)|discount(?:\/|$)|pages(?:\/|$)|policies(?:\/|$)|products(?:\/|$)|reserve-list$|search$|sign-in$)/;

function localizedClone(route: RouteConfigEntry, suffix: string): RouteConfigEntry {
  return {
    ...route,
    id: `${route.id ?? route.file}__${suffix}`,
    children: route.children?.map((child) => localizedClone(child, suffix)),
  };
}

const publicRoutes = routes.filter((route) => LOCALIZED_PATHS.test(route.path ?? ''));
const localizedRoutes = ['en-us', 'en-ca', 'fr-ca'].flatMap((locale) =>
  prefix(locale, publicRoutes.map((route) => localizedClone(route, locale))),
);

export default hydrogenRoutes([
  ...routes,
  ...localizedRoutes,
  // Manual route definitions can be added to this array, in addition to or instead of using the `flatRoutes` file-based routing convention.
  // See https://reactrouter.com/api/framework-conventions/routes.ts#routests
]) satisfies RouteConfig;
