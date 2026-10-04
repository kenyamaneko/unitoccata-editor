const REGISTRY_KEY = Symbol.for('unitoccata-editor.test.sharedState')

type Registry = Map<string, unknown>

function getRegistry(): Registry {
  const holder = globalThis as { [REGISTRY_KEY]?: Registry }
  holder[REGISTRY_KEY] ??= new Map()
  return holder[REGISTRY_KEY]
}

export function getSharedState<T>(key: string, create: () => T): T {
  const registry = getRegistry()
  return (registry.get(key) ?? registry.set(key, create()).get(key)) as T
}

export function discardSharedState(key: string): void {
  getRegistry().delete(key)
}
