import "dotenv/config";

const nodeEnv = process.env.NODE_ENV ?? "development";

if (nodeEnv === "production" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be set in production");
}

export const env = {
  nodeEnv,
  port: Number(process.env.PORT ?? 4000),
  mongoUri:
    process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/optronix_sales",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
};
