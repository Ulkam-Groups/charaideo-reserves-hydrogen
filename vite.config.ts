import {defineConfig} from 'vite';
import {hydrogen} from '@shopify/hydrogen/vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({plugins: [hydrogen(), tsconfigPaths()]});
