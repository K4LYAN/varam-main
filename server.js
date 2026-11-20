"use strict";

/** Starts the Varam Node.js app. `npm start` runs this (MilesWeb mPanel included). */
const app = require("./src/app");

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => console.log(`[varam] Node app running on port ${PORT}`));
