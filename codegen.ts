import {pluckConfig, preset, getSchema} from '@shopify/hydrogen-codegen';
export default {
  overwrite: true,
  pluckConfig,
  generates: {
    'storefrontapi.generated.d.ts': {
      preset,
      schema: getSchema('storefront'),
      documents: ['./app/components/*.{ts,tsx}', './app/routes/*.{ts,tsx}', './app/lib/fragments.ts', '!./app/routes/account*.{ts,tsx}'],
    },
  },
};
