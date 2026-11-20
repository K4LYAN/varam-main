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
| `server.js`, `package.json` | Optional file server for hosts that run `npm start` |

## Changing prices or products

Edit `js/data.js`: change `price`, `mrp` or `stockQty` on a pack size (`stockQty: 0` shows "Out of stock"). Cart totals and product cards use these values.
The page title and Google preview text on each `products/*.html` page also mention the starting price, so update that text too when a price changes.

## Run it locally

```bash
python -m http.server 4200
```

Then open http://localhost:4200.

## Deploy

- **MilesWeb (mPanel) Node app:** nothing to change. mPanel runs `npm start`, which starts `server.js`, a tiny file server with no dependencies and no database. Old links such as `/shop` and `/product/<slug>` still work, and `/login`, `/account` and `/admin` redirect to the home page.
- **Any static host (MilesWeb `public_html`, Vercel, Netlify, GitHub Pages):** upload the files, with no build command. `server.js` and `package.json` aren't needed there.
- **Vercel / Netlify / GitHub Pages:** import the repository as a static site, with no build command and the repository root as the output folder.
