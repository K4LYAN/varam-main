"use strict";

/**
 * IndexNow: tells Bing (which also feeds ChatGPT search, Copilot and DuckDuckGo),
 * Yandex, Seznam and Naver that pages changed, so they re-crawl within minutes
 * instead of days. The key is public by design — search engines fetch
 * https://varams.in/<KEY>.txt to check it belongs to this site.
 *
 * Run after a deploy:  npm run indexnow
 */
const store = require("./store");

const KEY = "b9a07a6b4b162ac60099d9eb7bf523fa";
const SITE = "https://varams.in";

function urls() {
  return [
    `${SITE}/`,
    `${SITE}/shop.html`,
    `${SITE}/faq.html`,
    `${SITE}/llms.txt`,
    `${SITE}/llms-full.txt`,
    ...store.products().map((p) => `${SITE}/products/${p.slug}.html`),
  ];
}

async function submit() {
  const body = { host: "varams.in", key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList: urls() };
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  return { status: res.status, count: body.urlList.length };
}

module.exports = { KEY, urls, submit };
