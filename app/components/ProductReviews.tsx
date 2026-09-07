import type {ProductReview, ProductReviewsResult} from '~/lib/judgeme.server';

export function ProductReviews({
  data,
  fallbackRating,
  fallbackCount,
}: {
  data: ProductReviewsResult;
  fallbackRating: number | null;
  fallbackCount: number;
}) {
  const reviews = data.reviews;
  const reviewCount = fallbackCount || reviews.length;
  const average = fallbackRating ?? averageRating(reviews);

  if (!reviews.length) {
    return (
      <div className="product-reviews-empty">
        <div className="product-reviews-empty-rating">
          <Stars rating={0} />
          <strong>0 reviews</strong>
        </div>
        <h3>No customer notes yet.</h3>
        <p>
          This reserve is waiting for its first review. Reviews published through
          Judge.me will appear here automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="product-review-content">
      <div className="product-rating-panel">
        <strong>{average?.toFixed(1)}</strong>
        <div>
          <Stars rating={average ?? 0} />
          <p>Based on {reviewCount} customer {reviewCount === 1 ? 'review' : 'reviews'}.</p>
        </div>
        <p className="product-review-provider-note">Published and managed through Judge.me.</p>
      </div>
      <div className="product-review-list" aria-label="Customer reviews">
        {reviews.map((review) => <ReviewCard key={review.id} review={review} />)}
      </div>
    </div>
  );
}

function ReviewCard({review}: {review: ProductReview}) {
  return (
    <article className="product-review-card">
      <div className="product-review-card-topline">
        <Stars rating={review.rating} />
        {review.createdAt && <time dateTime={review.createdAt}>{formatDate(review.createdAt)}</time>}
      </div>
      {review.title && <h3>{review.title}</h3>}
      <p>{review.body}</p>
      {review.pictures.length > 0 && (
        <div className="product-review-pictures">
          {review.pictures.map((picture) => (
            <img
              key={picture.url}
              src={picture.url}
              alt={picture.alt}
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ))}
        </div>
      )}
      <footer>
        <strong>{review.reviewerName}</strong>
        {review.verified && <span>Verified buyer</span>}
      </footer>
    </article>
  );
}

export function Stars({rating}: {rating: number}) {
  const rounded = Math.round(rating);
  return (
    <span className="product-stars" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      <span aria-hidden="true">{'★'.repeat(rounded)}{'☆'.repeat(5 - rounded)}</span>
    </span>
  );
}

function averageRating(reviews: Array<{rating: number}>) {
  return reviews.length
    ? reviews.reduce((total, review) => total + review.rating, 0) / reviews.length
    : null;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {month: 'short', year: 'numeric'}).format(date);
}
