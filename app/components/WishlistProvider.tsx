import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type WishlistProduct = {
  id: string;
  handle: string;
  title: string;
  image?: {url: string; altText?: string | null} | null;
  price?: {amount: string; currencyCode: string} | null;
};

type WishlistContextValue = {
  products: WishlistProduct[];
  ready: boolean;
  authenticated: boolean;
  includes: (productId: string) => boolean;
  toggle: (product: WishlistProduct) => void;
};

const STORAGE_KEY = 'charaideo:wishlist:v1';
const WishlistContext = createContext<WishlistContextValue | null>(null);

function readLocalWishlist(): WishlistProduct[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value)
      ? value.filter(
          (item): item is WishlistProduct =>
            Boolean(item && typeof item.id === 'string' && typeof item.handle === 'string'),
        )
      : [];
  } catch {
    return [];
  }
}

function dedupe(products: WishlistProduct[]) {
  return [...new Map(products.map((product) => [product.id, product])).values()];
}

export function WishlistProvider({children}: {children: ReactNode}) {
  const [products, setProducts] = useState<WishlistProduct[]>([]);
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const authenticatedRef = useRef(false);

  const saveRemote = useCallback(async (nextProducts: WishlistProduct[]) => {
    if (!authenticatedRef.current) return;
    try {
      await fetch('/api/wishlist', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({productIds: nextProducts.map((product) => product.id)}),
      });
    } catch {
      // The local copy remains usable when customer sync is temporarily unavailable.
    }
  }, []);

  useEffect(() => {
    const localProducts = readLocalWishlist();
    setProducts(localProducts);
    setReady(true);

    const controller = new AbortController();
    void fetch('/api/wishlist', {
      headers: {Accept: 'application/json'},
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as {
          authenticated?: boolean;
          products?: WishlistProduct[];
        };
      })
      .then((result) => {
        if (!result) return;
        const signedIn = Boolean(result.authenticated);
        authenticatedRef.current = signedIn;
        setAuthenticated(signedIn);
        if (!signedIn) return;

        const merged = dedupe([...(result.products ?? []), ...localProducts]);
        setProducts(merged);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        if (merged.length !== (result.products ?? []).length) void saveRemote(merged);
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [saveRemote]);

  const toggle = useCallback(
    (product: WishlistProduct) => {
      setProducts((current) => {
        const next = current.some((item) => item.id === product.id)
          ? current.filter((item) => item.id !== product.id)
          : [...current, product];
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        void saveRemote(next);
        return next;
      });
    },
    [saveRemote],
  );

  const ids = useMemo(() => new Set(products.map((product) => product.id)), [products]);
  const value = useMemo<WishlistContextValue>(
    () => ({
      products,
      ready,
      authenticated,
      includes: (productId) => ids.has(productId),
      toggle,
    }),
    [authenticated, ids, products, ready, toggle],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const value = useContext(WishlistContext);
  if (!value) throw new Error('useWishlist must be used inside WishlistProvider');
  return value;
}
