import {useEffect, useMemo, useState} from 'react';
import type {ProductVariantFragment} from 'storefrontapi.generated';
import {Image} from '@shopify/hydrogen';

type GalleryImage = NonNullable<ProductVariantFragment['image']>;

export function ProductImage({
  image,
  images = [],
}: {
  image: ProductVariantFragment['image'];
  images?: GalleryImage[];
}) {
  const galleryImages = useMemo(() => {
    const unique = new Map<string, GalleryImage>();
    if (image) unique.set(imageKey(image), image);
    images.forEach((item) => unique.set(imageKey(item), item));
    return [...unique.values()];
  }, [image, images]);
  const [activeImageId, setActiveImageId] = useState(
    image ? imageKey(image) : undefined,
  );

  useEffect(() => {
    if (image) setActiveImageId(imageKey(image));
  }, [image]);

  if (!galleryImages.length) {
    return <div className="product-image" />;
  }

  const activeImage =
    galleryImages.find((item) => imageKey(item) === activeImageId) ?? galleryImages[0];

  return (
    <div className="product-media-gallery">
      <div className="product-image">
        <Image
          alt={activeImage.altText || 'Product image'}
          data={activeImage}
          key={imageKey(activeImage)}
          sizes="(min-width: 70em) 480px, (min-width: 45em) 44vw, 92vw"
        />
      </div>
      {galleryImages.length > 1 && (
        <div className="product-thumbnails" aria-label="Product images">
          {galleryImages.map((item, index) => {
            const key = imageKey(item);
            const active = key === imageKey(activeImage);
            return (
              <button
                type="button"
                key={key}
                className="product-thumbnail"
                aria-label={`View product image ${index + 1}`}
                aria-pressed={active}
                onClick={() => setActiveImageId(key)}
              >
                <Image
                  alt=""
                  data={item}
                  sizes="64px"
                  loading="lazy"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function imageKey(image: GalleryImage) {
  return image.id || image.url;
}
