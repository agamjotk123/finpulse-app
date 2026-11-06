/** Reviewer workflow. Step 3's audit report reads these alongside the findings. */
export type ReviewStatus = 'open' | 'confirmed' | 'explained' | 'dismissed';

export const REVIEW_STATUSES: ReviewStatus[] = ['open', 'confirmed', 'explained', 'dismissed'];

export const REVIEW_LABEL: Record<ReviewStatus, string> = {
  open: 'To review',
  confirmed: 'Confirmed issue',
  explained: 'Explained',
  dismissed: 'False alarm',
};

export interface Review {
  status: ReviewStatus;
  note: string;
  updatedAt: string;
}

export type Reviews = Record<string, Review>;

export const EMPTY_REVIEW: Review = { status: 'open', note: '', updatedAt: '' };
