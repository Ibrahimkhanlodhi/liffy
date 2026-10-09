import { Redis } from "@upstash/redis";
export default async function handler(req, res) {
  if (!process.env.STATS_KEY || req.query.key !== process.env.STATS_KEY) return res.status(401).end();
  const redis = new Redis({ url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
                            token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN });
  const [countries, cities, sources] = await Promise.all([
    redis.hgetall("stats:countries"), redis.hgetall("stats:cities"), redis.hgetall("stats:source")]);
  res.json({ countries, cities, sources });
}
