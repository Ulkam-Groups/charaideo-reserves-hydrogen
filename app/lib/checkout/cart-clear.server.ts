export type CheckoutCart = {
  get: () => Promise<{lines?: {nodes?: Array<{id: string}>}} | null>;
  removeLines: (lineIds: string[]) => Promise<{errors?: unknown[]} | unknown>;
};

export async function clearCartAfterSuccessfulCheckout(cart: CheckoutCart) {
  for (const delay of [0, 100, 250]) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    try {
      const currentCart = await cart.get();
      const lineIds = currentCart?.lines?.nodes?.map(({id}) => id) ?? [];
      if (!lineIds.length) return true;
      const result = (await cart.removeLines(lineIds)) as {errors?: unknown[]};
      if (!result.errors?.length) return true;
    } catch {
      // Retry cleanup without changing the already-confirmed payment outcome.
    }
  }

  return false;
}
