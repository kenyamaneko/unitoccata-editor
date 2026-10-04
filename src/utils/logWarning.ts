/** 利用者の操作を止めない事象を、構造化したログ (JSON 1 行) として警告レベルで出す。 */
export function logWarning(event: string, fields: Readonly<Record<string, unknown>>): void {
  console.warn(JSON.stringify({ level: 'warn', event, ...fields }))
}
