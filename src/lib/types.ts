export type Variant = {
  id: string;
  /** Display label, e.g. "500 ML", "1 Litre" */
  label: string;
  /** Price in Indian Rupees */
  price: number;
  available: boolean;
  sku?: string;
};

export type Spec = { label: string; value: string };

export type Category = {
  id: string;
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  categoryId: string | null;
  categoryName: string;
  categorySlug: string;
  shortDescription: string;
  description: string;
  ingredients: string;
  extractionProcess: string;
  storage: string;
  /** "How to use" — kitchen / household uses */
  uses: string;
  specifications: Spec[];
  images: string[];
  variants: Variant[];
  /** Hex colour of the oil, used by the bottle render when no photo exists */
  oilTone: string;
  featured: boolean;
  isNew: boolean;
  available: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type Testimonial = {
  id: string;
  name: string;
  location: string;
  quote: string;
  published: boolean;
  sortOrder: number;
  /** 1–5 stars */
  rating: number;
  /** Where the review was posted */
  source: "google" | "customer";
  /** Free text, e.g. "2 months ago" or "March 2026" */
  date: string;
};

export type ImageRef = { image: string; alt: string };

export type Store = {
  name: string;
  address: string;
  phone: string;
  hours: string;
  /** Link to the Google Maps listing */
  mapsUrl: string;
  /** Text used for the embedded map and directions */
  mapQuery: string;
};

export type SiteSettings = {
  brand: {
    tagline: string;
    description: string;
    announcement: string;
  };
  hero: {
    eyebrow: string;
    headline: string;
    subtext: string;
    image: string;
    imageAlt: string;
  };
  contact: {
    /** International format digits, e.g. 91XXXXXXXXXX. Falls back to env. */
    whatsappNumber: string;
    phone: string;
    email: string;
    address: string;
    hours: string;
  };
  social: {
    instagram: string;
    instagramHandle: string;
    facebook: string;
    youtube: string;
  };
  story: {
    eyebrow: string;
    title: string;
    intro: string;
    body: string;
    quote: string;
    image: string;
    secondaryImage: string;
  };
  pillars: { title: string; text: string }[];
  process: { title: string; text: string; image: string }[];
  ingredients: { name: string; text: string; image: string }[];
  gallery: ImageRef[];
  stores: Store[];
  reviews: {
    /** Google rating shown when the Places API is not configured */
    rating: number;
    count: number;
    /** Link to the Google listing / reviews */
    url: string;
    /** "Write a review" link (optional) */
    writeUrl: string;
  };
  policies: {
    privacy: string;
    terms: string;
    shipping: string;
    returns: string;
  };
  analytics: {
    /** Link to the GA4 property for the business owner */
    reportUrl: string;
  };
};

/** The subset of settings exposed to client components. */
export type PublicSettings = {
  whatsappNumber: string;
  contact: SiteSettings["contact"];
  social: SiteSettings["social"];
  brand: SiteSettings["brand"];
};
