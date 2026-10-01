import type { FeaturedReview } from '../lib/data/reviews';
import { TestimonialsCarousel } from './TestimonialsCarousel';
export function TestimonialsSection({ reviews }: { reviews: FeaturedReview[] }) {
  return <section className="home-section" aria-labelledby="reviews-title"><TestimonialsCarousel reviews={reviews} /></section>;
}
