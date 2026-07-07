import mongoose from "mongoose";

type CachedConnection = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as typeof globalThis & {
  mongooseCache?: CachedConnection;
};

const cache =
  globalForMongoose.mongooseCache ??
  (globalForMongoose.mongooseCache = { conn: null, promise: null });

export async function dbConnect() {
  if (cache.conn) return cache.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not configured");
  }

  if (!cache.promise) {
    console.log("MongoDB connecting to:", uri.slice(0, 60), "...");
    mongoose.connection.on("connected", () => {
      console.log("MongoDB connection established");
    });
    mongoose.connection.on("error", (error) => {
      console.error("MongoDB connection error:", error);
    });

    cache.promise = mongoose.connect(uri, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
    }) as Promise<typeof mongoose>;

    cache.promise = cache.promise.then((conn) => {
      cache.conn = conn;
      return conn;
    }).catch((error) => {
      cache.promise = null;
      console.error("MongoDB connection failed:", error);
      throw error;
    });
  }

  return cache.promise;
}
