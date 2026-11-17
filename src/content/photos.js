"use strict";

/**
 * Free-licence photos from Unsplash (https://unsplash.com/license) used for
 * category tiles, the hero and section images until the shop's own photos
 * are uploaded. Product cards never use these — they show the product's own
 * uploaded photo (Admin → Products) or a drawn bottle.
 */
const unsplash = (id, w = 640, h) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}${h ? `&h=${h}` : ""}&q=70`;

const IDS = {
  hero: "1611608927037-4e8da6aa170e", // bottle of golden oil on wood with hessian
  seeds: "1785619564649-658675821809", // raw groundnuts in shells
  pressing: "1768689033119-c3ac1e437d20", // oil flowing from a press spout
  settled: "1709293078197-370c804d610c", // settled oil in a metal bowl
  kitchen: "1709294707971-43949c5f8387", // fresh oil poured into a steel vessel
  pour: "1709293287084-544575bb1398", // oil being poured
};

const CATEGORY = {
  "groundnut-oil": "1549978113-29eb25c8177f",
  "sesame-oil": "1778048840964-d221d23b86ee",
  "coconut-oil": "1560769680-ba2f3767c785",
  "mustard-oil": "1701188543419-f2e932565056",
  "other-oils": "1720468750623-39e9a09f5067",
  ghee: "1573812461383-e5f8b759d12e",
  honey: "1613548058193-1cd24c1bebcf",
};

const photo = (key, w, h) => (IDS[key] ? unsplash(IDS[key], w, h) : "");
const categoryPhoto = (slug, w = 480, h = 360) => unsplash(CATEGORY[slug] || IDS.hero, w, h);

module.exports = { photo, categoryPhoto };
