import {Image} from '@shopify/hydrogen';
import {useEffect, useRef, useState} from 'react';

export type ProductCardImage = {
  url: string;
  altText: string | null;
  width: number;
  height: number;
};

export function RotatingProductImage({
  images,
  alt,
  sizes,
}: {
  images?: ProductCardImage[] | null;
  alt: string;
  sizes: string;
}) {
  const visibleImages = images?.slice(0, 2) ?? [];
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isTouching, setIsTouching] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const didSwipe = useRef(false);
  const canRotate = visibleImages.length === 2;

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotionPreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updateMotionPreference();
    mediaQuery.addEventListener('change', updateMotionPreference);

    return () => mediaQuery.removeEventListener('change', updateMotionPreference);
  }, []);

  useEffect(() => {
    if (!canRotate || isHovered || isTouching || prefersReducedMotion) return;

    const timer = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % visibleImages.length);
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [
    activeIndex,
    canRotate,
    isHovered,
    isTouching,
    prefersReducedMotion,
    visibleImages.length,
  ]);

  if (visibleImages.length === 0) return null;

  return (
    <span
      className="product-card-image-rotator"
      data-image-count={visibleImages.length}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') setIsHovered(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') setIsHovered(false);
      }}
      onTouchStart={(event) => {
        if (!canRotate) return;
        touchStartX.current = event.touches[0]?.clientX ?? null;
        setIsTouching(true);
      }}
      onTouchEnd={(event) => {
        const startX = touchStartX.current;
        const endX = event.changedTouches[0]?.clientX;

        if (canRotate && startX != null && endX != null && Math.abs(endX - startX) >= 32) {
          didSwipe.current = true;
          setActiveIndex((current) => (current + 1) % visibleImages.length);
          window.setTimeout(() => {
            didSwipe.current = false;
          }, 400);
        }

        touchStartX.current = null;
        setIsTouching(false);
      }}
      onTouchCancel={() => {
        touchStartX.current = null;
        setIsTouching(false);
      }}
      onClickCapture={(event) => {
        if (!didSwipe.current) return;
        event.preventDefault();
        event.stopPropagation();
        didSwipe.current = false;
      }}
    >
      {visibleImages.map((image, index) => (
        <span
          key={image.url}
          className={`product-card-image-rotator__slide ${activeIndex === index ? 'is-active' : ''}`}
          aria-hidden={activeIndex !== index}
        >
          <Image
            className="product-card-image-rotator__image"
            data={image}
            alt={index === 0 ? image.altText || alt : ''}
            loading="lazy"
            sizes={sizes}
          />
        </span>
      ))}
      {canRotate && (
        <span className="product-card-image-dots" aria-label="Product images">
          {visibleImages.map((image, index) => (
            <button
              type="button"
              key={image.url}
              className={activeIndex === index ? 'is-active' : ''}
              aria-label={`Show product image ${index + 1} of ${visibleImages.length}`}
              aria-current={activeIndex === index ? 'true' : undefined}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setActiveIndex(index);
              }}
            />
          ))}
        </span>
      )}
    </span>
  );
}
