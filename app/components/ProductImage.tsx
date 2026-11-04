import {useEffect, useMemo, useRef, useState} from 'react';
import type {ReactNode} from 'react';
import {createPortal} from 'react-dom';
import type {ProductVariantFragment} from 'storefrontapi.generated';
import {Image, useAnalytics} from '@shopify/hydrogen';

type GalleryImage = NonNullable<ProductVariantFragment['image']>;

const LIGHTBOX_FIT_SCALE = 1;
const LIGHTBOX_MIN_SCALE = 1;
const LIGHTBOX_MAX_SCALE = 5;

export function ProductImage({
  image,
  images = [],
  overlay,
}: {
  image: ProductVariantFragment['image'];
  images?: GalleryImage[];
  overlay?: ReactNode;
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
  const [lightboxScale, setLightboxScale] = useState(LIGHTBOX_FIT_SCALE);
  const [lightboxOffset, setLightboxOffset] = useState({x: 0, y: 0});
  const touchStartX = useRef<number | null>(null);
  const lightboxPointers = useRef(new Map<number, {x: number; y: number}>());
  const lightboxDrag = useRef<{x: number; y: number} | null>(null);
  const lightboxPinch = useRef<{distance: number; scale: number} | null>(null);

  useEffect(() => {
    if (image) setActiveImageId(imageKey(image));
  }, [image]);

  useEffect(() => {
    if (!zoomed) return;

    setLightboxScale(LIGHTBOX_FIT_SCALE);
    setLightboxOffset({x: 0, y: 0});
    lightboxPointers.current.clear();
    lightboxDrag.current = null;
    lightboxPinch.current = null;

    const scrollY = window.scrollY;
    const previousBodyStyles = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setZoomed(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = previousBodyStyles.overflow;
      document.body.style.position = previousBodyStyles.position;
      document.body.style.top = previousBodyStyles.top;
      document.body.style.width = previousBodyStyles.width;
      window.scrollTo(0, scrollY);
    };
  }, [zoomed]);

  if (!galleryImages.length) {
    return <div className="product-image" />;
  }

  const activeImage =
    galleryImages.find((item) => imageKey(item) === activeImageId) ?? galleryImages[0];
  const activeIndex = galleryImages.findIndex(
    (item) => imageKey(item) === imageKey(activeImage),
  );

  const step = (direction: 1 | -1) => {
    const next =
      galleryImages[(activeIndex + direction + galleryImages.length) % galleryImages.length];
    setActiveImageId(imageKey(next));
  };

  const updateLightboxScale = (nextScale: number) => {
    const scale = Math.min(LIGHTBOX_MAX_SCALE, Math.max(LIGHTBOX_MIN_SCALE, nextScale));
    setLightboxScale(scale);
    if (scale <= LIGHTBOX_FIT_SCALE) setLightboxOffset({x: 0, y: 0});
  };

  return (
    <div className="product-media-gallery">
      <div
        className="product-stage"
        onKeyDown={(event) => {
          if (galleryImages.length < 2) return;
          if (event.key === 'ArrowRight') step(1);
          if (event.key === 'ArrowLeft') step(-1);
        }}
        onTouchStart={(event) => {
          touchStartX.current = event.touches[0].clientX;
        }}
        onTouchEnd={(event) => {
          if (touchStartX.current === null || galleryImages.length < 2) return;
          const delta = event.changedTouches[0].clientX - touchStartX.current;
          touchStartX.current = null;
          if (Math.abs(delta) > 40) step(delta < 0 ? 1 : -1);
        }}
      >
      {overlay}
      <button
        type="button"
        className="product-image product-image-trigger"
        aria-label="Open product image in full screen"
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const zoomX = ((event.clientX - rect.left) / rect.width) * 100;
          const zoomY = ((event.clientY - rect.top) / rect.height) * 100;
          event.currentTarget.style.setProperty('--zoom-x', `${zoomX}%`);
          event.currentTarget.style.setProperty('--zoom-y', `${zoomY}%`);
        }}
        onClick={() => {
          publish('custom_product_image_zoomed', {imageIndex: activeIndex + 1});
          setZoomed(true);
        }}
      >
        <img
          alt={activeImage.altText || 'Product image'}
          src={activeImage.url}
          key={imageKey(activeImage)}
          width={activeImage.width ?? undefined}
          height={activeImage.height ?? undefined}
          loading="eager"
          {...{fetchpriority: 'high'}}
          decoding="async"
        />
        <span className="product-image-count" aria-hidden="true">
          {activeIndex + 1} / {galleryImages.length}
        </span>
        <span className="product-image-zoom" aria-hidden="true">
          Zoom
        </span>
      </button>
      {galleryImages.length > 1 && (
        <>
          <button type="button" className="product-stage-arrow product-stage-arrow--prev" aria-label="Previous image" onClick={() => step(-1)}>&#8249;</button>
          <button type="button" className="product-stage-arrow product-stage-arrow--next" aria-label="Next image" onClick={() => step(1)}>&#8250;</button>
        </>
      )}
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
      {zoomed && typeof document !== 'undefined'
        ? createPortal(<div
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
            onWheel={(event) => {
              event.preventDefault();
              updateLightboxScale(lightboxScale + (event.deltaY < 0 ? 0.35 : -0.35));
            }}
            onDoubleClick={() =>
              updateLightboxScale(
                lightboxScale > LIGHTBOX_FIT_SCALE
                  ? LIGHTBOX_FIT_SCALE
                  : LIGHTBOX_FIT_SCALE * 2,
              )
            }
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              lightboxPointers.current.set(event.pointerId, {x: event.clientX, y: event.clientY});
              if (lightboxPointers.current.size === 1) {
                lightboxDrag.current = {x: event.clientX, y: event.clientY};
              } else if (lightboxPointers.current.size === 2) {
                const [first, second] = [...lightboxPointers.current.values()];
                lightboxPinch.current = {
                  distance: Math.hypot(second.x - first.x, second.y - first.y),
                  scale: lightboxScale,
                };
              }
            }}
            onPointerMove={(event) => {
              if (!lightboxPointers.current.has(event.pointerId)) return;
              const previous = lightboxPointers.current.get(event.pointerId);
              lightboxPointers.current.set(event.pointerId, {x: event.clientX, y: event.clientY});

              if (lightboxPointers.current.size === 2 && lightboxPinch.current) {
                const [first, second] = [...lightboxPointers.current.values()];
                const distance = Math.hypot(second.x - first.x, second.y - first.y);
                updateLightboxScale(
                  lightboxPinch.current.scale * (distance / lightboxPinch.current.distance),
                );
              } else if (
                previous &&
                lightboxScale > LIGHTBOX_FIT_SCALE &&
                lightboxDrag.current
              ) {
                setLightboxOffset((offset) => ({
                  x: offset.x + event.clientX - previous.x,
                  y: offset.y + event.clientY - previous.y,
                }));
                lightboxDrag.current = {x: event.clientX, y: event.clientY};
              }
            }}
            onPointerUp={(event) => {
              lightboxPointers.current.delete(event.pointerId);
              lightboxDrag.current = null;
              lightboxPinch.current = null;
            }}
            onPointerCancel={(event) => {
              lightboxPointers.current.delete(event.pointerId);
              lightboxDrag.current = null;
              lightboxPinch.current = null;
            }}
          >
            <img
              alt={activeImage.altText || 'Product image'}
              src={activeImage.url}
              width={activeImage.width ?? undefined}
              height={activeImage.height ?? undefined}
              decoding="async"
              draggable={false}
              style={{
                transform: `translate3d(${lightboxOffset.x}px, ${lightboxOffset.y}px, 0) scale(${lightboxScale})`,
              }}
            />
            <div
              className="product-image-lightbox-controls"
              role="group"
              aria-label="Image zoom controls"
              onPointerDown={(event) => event.stopPropagation()}
              onPointerMove={(event) => event.stopPropagation()}
              onPointerUp={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                aria-label="Zoom out"
                onClick={() => updateLightboxScale(lightboxScale - LIGHTBOX_FIT_SCALE * 0.5)}
                disabled={lightboxScale <= LIGHTBOX_MIN_SCALE}
              >
                &minus;
              </button>
              <output aria-live="polite">
                {Math.round((lightboxScale / LIGHTBOX_FIT_SCALE) * 100)}%
              </output>
              <button
                type="button"
                aria-label="Zoom in"
                onClick={() => updateLightboxScale(lightboxScale + LIGHTBOX_FIT_SCALE * 0.5)}
                disabled={lightboxScale >= LIGHTBOX_MAX_SCALE}
              >
                +
              </button>
              <button
                type="button"
                className="product-image-lightbox-reset"
                onClick={() => updateLightboxScale(LIGHTBOX_FIT_SCALE)}
                disabled={lightboxScale === LIGHTBOX_FIT_SCALE}
              >
                Reset
              </button>
            </div>
          </div>
        </div>, document.body)
        : null}
    </div>
  );
}

function imageKey(image: GalleryImage) {
  return image.id || image.url;
}
