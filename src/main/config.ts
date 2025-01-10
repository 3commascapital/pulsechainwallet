import { get } from 'svelte/store'
import _ from 'lodash'

import { writable } from '$main/store'
import type { Key } from '$preload/api'
import { type Config, defaultConfig } from '$common/config'
import poolsConfig from '$common/pools-config.json'
import { emit, handle } from '$main/ipc'
import * as autoUpdate from '$main/auto-update'

/**
 * The config store
 * creates a store that will emit config:update events when the config is updated
 * it will also save the config to disk at config.json
 * and it will backfill configuration during first load
 */
export const config = writable<Config>('config', defaultConfig, (current) => {
  // backfill pools config if missing
  for (const chainId of Object.keys(current.byChain)) {
    current.byChain[chainId].pools = current.byChain[chainId].pools || poolsConfig[chainId]
  }
  return {
    ...defaultConfig,
    ...current,
  }
})
config.subscribe((c) => {
  emit('config:update', c)
})

handle('config:get', async () => {
  return get(config)
})
handle('config:set', async <K extends Key, V = K extends '.' ? Partial<Config> : unknown>(k: K, value: V) => {
  if (k === null) {
    return
  }
  config.update(($config) => {
    if (k === '.') {
      return {
        ...$config,
        ...value,
      }
    }
    let clone = _.cloneDeep($config)
    const kSplit = Array.isArray(k) ? k : k.split('.')
    const [zeroTh, first, second] = kSplit
    if (zeroTh === 'byChain' && second === 'poolPower') {
      clone = _.set(clone, [zeroTh, first, 'poolByPowerIndex', value], 0)
    }
    if (k === 'autoUpdate') {
      if (value) {
        autoUpdate.start()
      } else {
        autoUpdate.stop()
      }
    }
    return _.set(clone, k, value)
  })
})
