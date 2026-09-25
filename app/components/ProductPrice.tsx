import {Money} from '@shopify/hydrogen';
import type {MoneyV2} from '@shopify/hydrogen/storefront-api-types';

export function ProductPrice({
  price,
  compareAtPrice,
}: {
  price?: MoneyV2;
  compareAtPrice?: MoneyV2 | null;
}) {
  const validCompareAtPrice =
    price &&
    compareAtPrice &&
    price.currencyCode === compareAtPrice.currencyCode &&
    Number(compareAtPrice.amount) > Number(price.amount)
      ? compareAtPrice
      : null;
  const savings =
    price && validCompareAtPrice
      ? Number(validCompareAtPrice.amount) - Number(price.amount)
      : 0;
  const savingsPercent = validCompareAtPrice
    ? Math.round((savings / Number(validCompareAtPrice.amount)) * 100)
    : 0;

  return (
    <div className="product-price">
      {validCompareAtPrice ? (
        <div className="product-price-on-sale">
          {price ? <Money data={price} /> : null}
          <s>
            <Money data={validCompareAtPrice} />
          </s>
          <span className="product-savings">
            Save{' '}
            <Money
              data={{
                amount: savings.toFixed(2),
                currencyCode: price!.currencyCode,
              }}
            />{' '}
            ({savingsPercent}%)
          </span>
        </div>
      ) : price ? (
        <Money data={price} />
      ) : (
        <span>&nbsp;</span>
      )}
    </div>
  );
}
