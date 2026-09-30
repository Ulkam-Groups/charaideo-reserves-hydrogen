import {useEffect, useMemo, useState} from 'react';
import type {ProductVariantFragment} from 'storefrontapi.generated';
import {Image, useAnalytics} from '@shopify/hydrogen';

type GalleryImage = NonNullable<ProductVariantFragment['image']>;

export function ProductImage({
  image,
  images = [],
}: {
  image: ProductVariantFragment['image'];
  images?: GalleryImage[];
}) {
  const {publish} = useAnalytics();
  const galleryImages = useMemo(() => {
    const unique = new Map<string, GalleryImage>();
    if (image) unique.set(imageKey(image), image);
    images.forEach((item) => unique.set(imageKey(item), item));
    return [...unique.values()];
  }, [image, images]);
  const [activeImageId, setActiveImageId] = useState(image ? imageKey(image) : undefined);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    if (image) setActiveImageId(imageKey(image));
  }, [image]);

  useEffect(() => {
    if (!zoomed) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setZoomed(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [zoomed]);

  if (!galleryImages.length) {
    return <div className="product-image" />;
  }

  const activeImage =
    galleryImages.find((item) => imageKey(item) === activeImageId) ?? galleryImages[0];
  const activeIndex = galleryImages.findIndex(
    (item) => imageKey(item) === imageKey(activeImage),
  );

  return (
    <div className="product-media-gallery">
      <button
        type="button"
        className="product-image product-image-trigger"
        aria-label="Open product image in full screen"
        onClick={() => {
          publish('custom_product_image_zoomed', {imageIndex: activeIndex + 1});
          setZoomed(true);
        }}
      >
        <Image
          alt={activeImage.altText || 'Product image'}
          data={activeImage}
          key={imageKey(activeImage)}
          sizes="(min-width: 70em) 480px, (min-width: 45em) 44vw, 92vw"
        />
        <span className="product-image-count" aria-hidden="true">
          {activeIndex + 1} / {galleryImages.length}
        </span>
        <span className="product-image-zoom" aria-hidden="true">
          Zoom
        </span>
      </button>
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
                onClick={() => {
                  publish('custom_product_gallery_viewed', {imageIndex: index + 1});
                  setActiveImageId(key);
                }}
              >
                <Image alt="" data={item} sizes="64px" loading="lazy" />
              </button>
            );
          })}
        </div>
      )}
      {zoomed && (
        <div
          className="product-image-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Product image viewer"
          onClick={() => setZoomed(false)}
        >
          <button
            type="button"
            className="product-image-lightbox-close"
            aria-label="Close image viewer"
            onClick={() => setZoomed(false)}
          >
            &times;
          </button>
          <div
            className="product-image-lightbox-content"
            onClick={(event) => event.stopPropagation()}
          >
            <Image
              alt={activeImage.altText || 'Product image'}
              data={activeImage}
              sizes="95vw"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function imageKey(image: GalleryImage) {
  return image.id || image.url;
}
