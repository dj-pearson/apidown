const QUEUE_KEY = 'signals:raw';
const BATCH_SIZE = 500;

/**
 * Drains the Redis signals queue and batch-inserts into Supabase signals table.
 */
export async function drainSignals(redis, supabase) {
  const pipeline = redis.pipeline();
  pipeline.lrange(QUEUE_KEY, 0, BATCH_SIZE - 1);
  pipeline.ltrim(QUEUE_KEY, BATCH_SIZE, -1);
  const results = await pipeline.exec();

  const rawItems = results[0][1]; // lrange result
  if (!rawItems || rawItems.length === 0) return 0;

  const signals = [];
  for (const raw of rawItems) {
    try {
      signals.push(JSON.parse(raw));
    } catch {
      // Skip malformed entries
    }
  }

  if (signals.length === 0) return 0;

  const { error } = await supabase.from('signals').insert(signals);

  if (error) {
    console.error('[drain] Supabase insert error:', error.message);
    // Re-queue failed signals so they aren't lost
    const rePipeline = redis.pipeline();
    for (const signal of signals) {
      rePipeline.rpush(QUEUE_KEY, JSON.stringify(signal));
    }
    await rePipeline.exec();
    return 0;
  }

  console.log(`[drain] Inserted ${signals.length} signals`);
  return signals.length;
}
