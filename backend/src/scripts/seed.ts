import mongoose from "mongoose";
import { env } from "../config/env.js";
import { Account } from "../models/Account.js";
import { FollowUp } from "../models/FollowUp.js";
import { Meeting } from "../models/Meeting.js";
import { User } from "../models/User.js";
import { hashPassword } from "../services/authService.js";

const PASSWORD = "Password@123";

async function main() {
  await mongoose.connect(env.mongoUri);
  await Promise.all([
    User.deleteMany({}),
    Account.deleteMany({}),
    Meeting.deleteMany({}),
    FollowUp.deleteMany({}),
  ]);
  await Meeting.syncIndexes();
  const passwordHash = await hashPassword(PASSWORD);

  const admin = await User.create({
    name: "Asha Admin",
    email: "admin@optronix.test",
    role: "admin",
    passwordHash,
  });
  const mgrA = await User.create({
    name: "Meera Manager",
    email: "manager1@optronix.test",
    role: "manager",
    passwordHash,
  });
  const mgrB = await User.create({
    name: "Manoj Manager",
    email: "manager2@optronix.test",
    role: "manager",
    passwordHash,
  });
  await User.create([
    {
      name: "Ravi Sales",
      email: "ravi@optronix.test",
      role: "employee",
      managerId: mgrA._id,
      passwordHash,
    },
    {
      name: "Sana Sales",
      email: "sana@optronix.test",
      role: "employee",
      managerId: mgrA._id,
      passwordHash,
    },
    {
      name: "Tarun Sales",
      email: "tarun@optronix.test",
      role: "employee",
      managerId: mgrB._id,
      passwordHash,
    },
  ]);

  await Account.create([
    {
      name: "Acme Industries",
      address: "Plot 12, Sector 18, Gurugram",
      industry: "Manufacturing",
      createdBy: admin._id,
      contacts: [
        {
          name: "Priya Nair",
          designation: "Procurement Head",
          email: "priya@acme.test",
          phone: "+91 98100 00001",
        },
        {
          name: "Karan Shah",
          designation: "Plant Manager",
          email: "karan@acme.test",
        },
      ],
    },
    {
      name: "Globex Retail",
      address: "Connaught Place, New Delhi",
      industry: "Retail",
      createdBy: admin._id,
      contacts: [
        {
          name: "Neha Bansal",
          designation: "Operations Director",
          email: "neha@globex.test",
        },
      ],
    },
  ]);

  console.log(`Seeded. All users use password: ${PASSWORD}`);
  console.log(
    "admin@optronix.test | manager1@optronix.test | manager2@optronix.test | ravi@ | sana@ | tarun@optronix.test",
  );
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
