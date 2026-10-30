const config = require("../config/env");

// Counts hits in one atomic step: the first hit of a window starts the expiry, and a key that
// somehow lost its expiry gets one again, so a counter can never stick forever.
const INCREMENT_SCRIPT = `
local hits = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if hits == 1 or ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return { hits, ttl }`;

// express-rate-limit store backed by Redis, so every server instance (each Vercel function)
// shares one counter per key. Fixed window, like the default in-memory store.
class RedisRateLimitStore {
  constructor({ client, prefix }) {
    this.client = client;
    this.prefix = prefix;
    this.localKeys = false;
    this.windowMs = 60 * 1000;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  key(key) {
    return `${this.prefix}${key}`;
  }

  async increment(key) {
    const [hits, ttl] = await this.client.eval(INCREMENT_SCRIPT, [this.key(key)], [this.windowMs]);
    return { totalHits: Number(hits), resetTime: new Date(Date.now() + Number(ttl)) };
  }

  async decrement(key) {
    await this.client.decr(this.key(key));
  }

  async resetKey(key) {
    await this.client.del(this.key(key));
  }
}

let sharedClient;

// One REST client for all limiters. Loaded lazily so local runs and tests without Upstash
// never touch the package.
function redisClient({ redisUrl, redisToken }) {
  if (!sharedClient) {
    // eslint-disable-next-line n/global-require -- only when Upstash is configured
    const { Redis } = require("@upstash/redis");
    sharedClient = new Redis({ url: redisUrl, token: redisToken });
  }
  return sharedClient;
}

// A Redis store for one limiter, or undefined (express-rate-limit then counts in memory) when
// UPSTASH_REDIS_REST_URL / _TOKEN are not set. Each limiter needs its own store and prefix.
function storeFor(name, settings = config.rateLimit, client = undefined) {
  if (!settings.redisUrl || !settings.redisToken) return undefined;
  return new RedisRateLimitStore({
    client: client || redisClient(settings),
    prefix: `wk:rl:${name}:`,
  });
}

module.exports = { RedisRateLimitStore, storeFor, INCREMENT_SCRIPT };
