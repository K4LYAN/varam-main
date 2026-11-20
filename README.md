# Varam Organic Oil — static website

Plain HTML, CSS and JavaScript. No server, no database, no build step: upload the files to any static host.

## How ordering works

Customers add products to the cart (kept in their browser), enter their details and tap **Send order on WhatsApp**. WhatsApp opens with the itemised order, order number and total already written; stock, delivery and payment are confirmed in the chat.

## Files

| Path | What it is |
| --- | --- |
| `index.html`, `shop.html`, `faq.html`, `404.html` | Pages |
| `products/*.html` | One page per product |
| `js/data.js` | **Products, pack sizes, prices, stock, delivery fee, contact details, WhatsApp number and coupons** |
| `js/common.js` | Header, footer, cart and WhatsApp checkout |
| `js/home.js`, `shop.js`, `product.js`, `faq.js`, `catalog.js`, `motion.js` | Page scripts |
| `css/` | Styles |
| `img/` | Logo |
| `sitemap.xml`, `robots.txt` | For search engines |

## Changing prices or products

Edit `js/data.js`: change `price`, `mrp` or `stockQty` on a pack size (`stockQty: 0` shows "Out of stock"). Cart totals and product cards use these values.
The page title and Google preview text on each `products/*.html` page also mention the starting price, so update that text too when a price changes.

## Run it locally

```bash
python -m http.server 4200
```

Then open http://localhost:4200.

## Deploy

- **MilesWeb (mPanel):** upload everything except `README.md` and `.claude/` into the domain's document root (usually `public_html`) with the File Manager or FTP. Remove the old Node.js application for the domain so it no longer answers requests.
- **Vercel / Netlify / GitHub Pages:** import the repository as a static site, with no build command and the repository root as the output folder.
