import type { Db } from "./index";
import type { Spec, Variant } from "../types";
import { DEFAULT_SETTINGS } from "../defaults";

/**
 * VARAM catalogue — prices from the business price list (per 1 Litre).
 * Seeded only into an empty database. Everything is editable in Admin → Products.
 * Additional bottle sizes can be added per product once their prices are confirmed.
 */

type SeedCategory = { id: string; slug: string; name: string; description: string };
const categories: SeedCategory[] = [
  { id: "cat-groundnut", slug: "groundnut-oil", name: "Groundnut Oil", description: "Cold-pressed from groundnuts." },
  { id: "cat-sesame", slug: "sesame-oil", name: "Sesame Oil", description: "Cold-pressed from white and black sesame seeds." },
  { id: "cat-coconut", slug: "coconut-oil", name: "Coconut Oil", description: "Cold-pressed from coconut." },
  { id: "cat-mustard", slug: "mustard-oil", name: "Mustard Oil", description: "Cold-pressed from mustard seeds." },
  { id: "cat-other", slug: "other-cold-pressed-oils", name: "Other Cold-Pressed Oils", description: "Sunflower and castor oil." },
  { id: "cat-ghee", slug: "ghee", name: "Ghee", description: "Traditional ghee." },
];

const litre = (price: number): Variant[] => [{ id: "1-litre", label: "1 Litre", price, available: true }];

const STORAGE =
  "Store in a cool, dry place away from direct sunlight. Close the cap tightly after every use. Natural sedimentation may occur — this is normal for unrefined oils.";

const coldPressed = (seed: string) =>
  `Our ${seed} are cleaned and sorted, then pressed slowly using the traditional cold-press method. The pressed oil is left to settle naturally, filtered, and bottled.`;

const specs = (source: string, type = "Cold-pressed, unrefined"): Spec[] => [
  { label: "Type", value: type },
  { label: "Source", value: source },
  { label: "Shelf life", value: "As printed on the pack" },
];

type SeedProduct = {
  slug: string;
  name: string;
  categoryId: string;
  shortDescription: string;
  description: string;
  ingredients: string;
  extraction: string;
  storage?: string;
  uses: string;
  specifications: Spec[];
  oilTone: string;
  variants: Variant[];
  featured?: boolean;
  isNew?: boolean;
};

const products: SeedProduct[] = [
  {
    slug: "cold-pressed-groundnut-oil",
    name: "Cold-Pressed Groundnut Oil",
    categoryId: "cat-groundnut",
    shortDescription: "A golden, nutty everyday oil for South Indian and home-style cooking.",
    description:
      "Pressed from groundnuts the traditional way, this golden oil carries the warm, nutty aroma of the seed itself. A versatile everyday oil for the Indian kitchen.",
    ingredients: "Groundnuts (peanuts).",
    extraction: coldPressed("groundnuts"),
    uses: "Tempering (tadka), sautéing, curries, chutneys and everyday home cooking. A traditional choice for frying snacks.",
    specifications: specs("Groundnuts"),
    oilTone: "#D7A436",
    variants: litre(370),
    featured: true,
  },
  {
    slug: "cold-pressed-white-sesame-oil",
    name: "Cold-Pressed White Sesame Oil",
    categoryId: "cat-sesame",
    shortDescription: "Traditional gingelly oil (nallennai) with a gentle, light aroma.",
    description:
      "Pressed from white sesame seeds, this light-coloured oil — known as gingelly or nallennai — is a staple of traditional South Indian kitchens.",
    ingredients: "White sesame seeds.",
    extraction: coldPressed("sesame seeds"),
    uses: "Pickles, podis, idli and dosa, kuzhambu, poriyal and traditional South Indian recipes.",
    specifications: specs("White sesame seeds"),
    oilTone: "#D6A13A",
    variants: litre(500),
    featured: true,
  },
  {
    slug: "cold-pressed-black-sesame-oil",
    name: "Cold-Pressed Black Sesame Oil",
    categoryId: "cat-sesame",
    shortDescription: "Deep, earthy oil pressed from black sesame seeds.",
    description:
      "Pressed from black sesame seeds, this oil is darker and more robust in character than white sesame oil, with a rich, earthy aroma.",
    ingredients: "Black sesame seeds.",
    extraction: coldPressed("black sesame seeds"),
    uses: "Traditional recipes, tempering, pickles and finishing dishes. Also traditionally used for oil massage and hair care.",
    specifications: specs("Black sesame seeds"),
    oilTone: "#7B4B1F",
    variants: litre(480),
  },
  {
    slug: "cold-pressed-coconut-oil",
    name: "Cold-Pressed Coconut Oil",
    categoryId: "cat-coconut",
    shortDescription: "Clear, fragrant oil pressed from mature coconuts.",
    description:
      "Pressed from mature coconuts, this oil is clear and naturally fragrant. It may solidify in cooler temperatures — keep the bottle in a warm place to liquefy.",
    ingredients: "Coconut.",
    extraction: coldPressed("coconuts"),
    uses: "Kerala-style cooking, avial, thoran, sweets and baking. Also traditionally used for hair and skin care.",
    specifications: specs("Coconut"),
    oilTone: "#EFE3BF",
    variants: litre(600),
    featured: true,
  },
  {
    slug: "cold-pressed-mustard-oil",
    name: "Cold-Pressed Mustard Oil",
    categoryId: "cat-mustard",
    shortDescription: "Bold and pungent — the signature oil of North and East Indian cooking.",
    description:
      "Pressed from mustard seeds, this oil has the bold, pungent character that defines many North and East Indian dishes and pickles.",
    ingredients: "Mustard seeds.",
    extraction: coldPressed("mustard seeds"),
    uses: "Pickles (achar), Bengali and Punjabi cooking, fish and vegetable curries, and marinades.",
    specifications: specs("Mustard seeds"),
    oilTone: "#C18414",
    variants: litre(480),
    featured: true,
  },
  {
    slug: "cold-pressed-sunflower-oil",
    name: "Cold-Pressed Sunflower Oil",
    categoryId: "cat-other",
    shortDescription: "A light, mild oil for everyday cooking.",
    description: "Pressed from sunflower seeds, this oil is light in colour and mild in flavour — an easy everyday choice.",
    ingredients: "Sunflower seeds.",
    extraction: coldPressed("sunflower seeds"),
    uses: "Everyday cooking, sautéing, salads and dishes where you want a mild, neutral flavour.",
    specifications: specs("Sunflower seeds"),
    oilTone: "#E6C14C",
    variants: litre(550),
  },
  {
    slug: "cold-pressed-castor-oil",
    name: "Cold-Pressed Castor Oil",
    categoryId: "cat-other",
    shortDescription: "Thick, traditional oil pressed from castor seeds.",
    description:
      "Pressed from castor seeds, this thick, pale oil has long been a part of traditional Indian households.",
    ingredients: "Castor seeds.",
    extraction: coldPressed("castor seeds"),
    uses: "Traditionally used in hair and skin care routines and for lamps. Please follow the label for usage.",
    specifications: specs("Castor seeds"),
    oilTone: "#E8D9A0",
    variants: litre(480),
  },
  {
    slug: "pure-ghee",
    name: "Pure Ghee",
    categoryId: "cat-ghee",
    shortDescription: "Golden, aromatic ghee prepared the traditional way.",
    description:
      "Rich, golden ghee with the nutty aroma of slowly clarified butter — for everyday meals, festive sweets and the pooja room.",
    ingredients: "Milk fat (butter).",
    extraction:
      "Butter is heated slowly until the milk solids separate and settle, leaving clear, golden, aromatic ghee that is then filtered and packed.",
    storage: "Store in a cool, dry place with the lid tightly closed. Always use a clean, dry spoon. Ghee may solidify in cooler weather — this is natural.",
    uses: "Drizzling over rice and dal, rotis, sweets and halwa, tempering, and festive and pooja use.",
    specifications: specs("Milk fat (butter)", "Traditional ghee"),
    oilTone: "#E9B949",
    variants: litre(800),
    featured: true,
    isNew: true,
  },
];

export async function seedDatabase(db: Db) {
  const existing = await db.query<{ count: string | number }>("select count(*)::int as count from categories");
  if (Number(existing[0]?.count ?? 0) > 0) return;

  for (const [i, c] of categories.entries()) {
    await db.query(
      `insert into categories (id, slug, name, description, sort_order) values ($1,$2,$3,$4,$5)
       on conflict (id) do nothing`,
      [c.id, c.slug, c.name, c.description, i],
    );
  }

  for (const [i, p] of products.entries()) {
    await db.query(
      `insert into products (id, slug, name, category_id, short_description, description, ingredients,
        extraction_process, storage, uses, specifications, images, variants, oil_tone, featured, is_new, available, sort_order)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14,$15,$16,true,$17)
       on conflict (slug) do nothing`,
      [
        crypto.randomUUID(),
        p.slug,
        p.name,
        p.categoryId,
        p.shortDescription,
        p.description,
        p.ingredients,
        p.extraction,
        p.storage ?? STORAGE,
        p.uses,
        JSON.stringify(p.specifications),
        JSON.stringify([]),
        JSON.stringify(p.variants),
        p.oilTone,
        Boolean(p.featured),
        Boolean(p.isNew),
        i,
      ],
    );
  }

  await db.query(
    `insert into settings (key, value) values ('site', $1::jsonb) on conflict (key) do nothing`,
    [JSON.stringify(DEFAULT_SETTINGS)],
  );
}
