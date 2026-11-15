import mongoose from "mongoose";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { Meeting } from "./models/Meeting.js";

async function main() {
  await mongoose.connect(env.mongoUri);
  await Meeting.syncIndexes();
  createApp().listen(env.port, () =>
    console.log(`API listening on http://localhost:${env.port}`),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
