import mongoose from "mongoose";
import { createApp } from "./app";
import { env } from "./config/env";
import { Meeting } from "./models/Meeting";

async function main() {
  await mongoose.connect(env.mongoUri);
  await Meeting.syncIndexes(); // ensures the one-active-visit-per-employee unique partial index exists
  createApp().listen(env.port, () =>
    console.log(`API listening on http://localhost:${env.port}`),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
