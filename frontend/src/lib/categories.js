/**
 * Category slugs, display labels, and one-line blurbs. Shared by the homepage
 * grouping, category race pages, category feeds, and the live radar filter.
 */
export const CATEGORY_META = {
  ai: { label: 'AI / LLM', blurb: 'Model inference endpoints where latency is the product.' },
  payments: { label: 'Payments', blurb: 'Payment and financial APIs where a timeout costs money.' },
  communications: { label: 'Communications', blurb: 'Email, SMS, and messaging delivery APIs.' },
  'cloud-aws': { label: 'Cloud — AWS', blurb: 'AWS service endpoints.' },
  'cloud-gcp': { label: 'Cloud — GCP', blurb: 'Google Cloud service endpoints.' },
  'cloud-azure': { label: 'Cloud — Azure', blurb: 'Microsoft Azure service endpoints.' },
  auth: { label: 'Auth & Identity', blurb: 'Identity providers sitting in front of your login flow.' },
  database: { label: 'Database / Storage', blurb: 'Managed database and object storage APIs.' },
  devtools: { label: 'Dev Tools & Hosting', blurb: 'CI, hosting, and developer platform APIs.' },
  commerce: { label: 'Commerce & Shipping', blurb: 'Storefront, catalogue, and logistics APIs.' },
};

/** Short label for a category slug, falling back to the raw slug. */
export function categoryLabel(slug) {
  return CATEGORY_META[slug]?.label || slug;
}

/** [{ slug, label }] in declaration order. */
export function categoryList() {
  return Object.entries(CATEGORY_META).map(([slug, meta]) => ({ slug, label: meta.label }));
}
