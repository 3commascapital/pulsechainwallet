import { type Hex, hexToBytes, numberToBytes, toBytes, concatBytes, keccak256 } from 'viem'
import type { ChainIds } from '$common/config'

/**
 * Clear out any entries from the lastUpdated map that are older than the TTL
 */
const clearBeforeNow = (ttl: number, now: number, lastUpdated: Map<unknown, { timestamp: number }>) => {
  for (const [key, { timestamp }] of lastUpdated.entries()) {
    if (now - timestamp > ttl) {
      lastUpdated.delete(key)
    }
  }
}

/**
 * Memoize a function with a TTL
 */
export const memoizeWithTTL = <K = unknown, Args extends unknown[] = [], Value = unknown>(
  createKey: (...args: Args) => K,
  runner: (...args: Args) => Value,
  ttl: number,
) => {
  const lastUpdated = new Map<
    K,
    {
      timestamp: number
      value: Value
    }
  >()
  return (...args: Args) => {
    const now = Date.now()
    clearBeforeNow(ttl, now, lastUpdated)
    const key = createKey(...args)
    const lastUpdate = lastUpdated.get(key)
    if (lastUpdate) {
      // Cache hit and TTL not expired, return cached value
      // console.log('hit now=%o lastUpdate=%o ttl=%o', new Date(now), new Date(lastUpdate.timestamp), ttl)
      return lastUpdate.value
    }
    const result = runner(...args)
    lastUpdated.set(key, {
      value: result,
      timestamp: now,
    })
    return result
  }
}

export const poolIdFromParts = (chainId: ChainIds, address: Hex) => {
  return keccak256(concatBytes([numberToBytes(chainId, { size: 32 }), toBytes('privacyPool'), hexToBytes(address)]))
}

export const loopWork = (fn: () => Promise<number>) => {
  let id: ReturnType<typeof setTimeout> | null = null
  let currentWork: Promise<void> | null = null

  const loop = (ms: number = 3_000) => {
    const i = setTimeout(async () => {
      if (i !== id) return
      if (currentWork !== null) {
        // if another loop started and then this loop started, then wait for the other loop to finish it's work. the id will be different so the other work will not continue
        await currentWork
      }
      currentWork = fn()
        .catch((err) => {
          console.log(err)
          return 10_000
        })
        .then((ms) => {
          // if the loop is being torn down, then don't do any more work
          if (id === null) return
          // if another loop started, then discontinue this loop's work
          if (i !== id) return
          return loop(ms)
        })
    }, ms)
    currentWork = null
    id = i
  }
  const cancel = () => {
    // current work will still finish but the loop will not continue
    if (id !== null) {
      clearTimeout(id)
      id = null
    }
  }
  return {
    loop,
    cancel,
  }
}

export const log = (pattern: string, ...params: unknown[]) => {
  console.log(`%o ${pattern}`, new Date(), ...params)
}

export const truncateHash = (hash: Hex) => {
  return hash.slice(0, 12) + '...'
}
