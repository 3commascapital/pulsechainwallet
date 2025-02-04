import * as fs from 'fs'
import path from 'path'
import { writable as w } from 'svelte/store'

import { paths } from '$main/paths'
import { valueToJSON } from '$main/json'

const io = {
  write: (key: string, value: object) => {
    const pathToFile = path.join(paths.data, `${key}.json`)
    const contents = valueToJSON.stringify(value)!
    fs.mkdirSync(paths.data, { recursive: true })
    fs.writeFileSync(pathToFile, contents)
  },
  read: <T>(key: string) => {
    const filePath = path.join(paths.data, `${key}.json`)
    try {
      const startInfo = fs.readFileSync(filePath, 'utf8')
      return valueToJSON.parse(startInfo) as T
    } catch (err) {
      console.log('failed to read', key, err)
      return null
    }
  },
}

export const writable = <T>(
  key: string,
  defaultValue: T,
  merge: (a: T) => T = (current) => ({
    ...defaultValue,
    ...current,
  }),
) => {
  const stored = io.read<T>(key) || defaultValue
  const store = w<T>(merge(stored))
  return {
    ...store,
    set: (value: T) => {
      io.write(key, value as object)
      store.set(value)
    },
    update: (fn: (value: T) => T) => {
      store.update(($value) => {
        const result = fn($value as T)
        // pit stop to save the value to disk
        io.write(key, result as object)
        return result
      })
    },
    updatePartial: (value: Partial<T>) => {
      store.update(($value) => {
        const result = {
          ...$value,
          ...value,
        }
        io.write(key, result)
        return result
      })
    },
  }
}
