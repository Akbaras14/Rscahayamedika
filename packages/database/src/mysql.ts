/** DATETIME MySQL menerima UTC tanpa akhiran Z; nilai DATE dan JSON dipertahankan. */
type NilaiMysql = string | number | bigint | boolean | null | Date | Uint8Array | NilaiMysql[];
export function parameterMysql(values: readonly unknown[]): NilaiMysql[] {
  return values.map((value) => {
    if (Array.isArray(value)) return parameterMysql(value);
    if (typeof value === "string") {
      return /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)
        ? value.slice(0, 23).replace("T", " ")
        : value;
    }
    if (value === null || typeof value === "number" || typeof value === "boolean" || typeof value === "bigint" || value instanceof Date || value instanceof Uint8Array) return value;
    throw new TypeError("Parameter MySQL harus berupa nilai skalar; serialisasi JSON harus dilakukan eksplisit.");
  });
}

export function waktuMysql(value: string | Date): string {
  if (value instanceof Date) return value.toISOString();
  const iso = /^\d{4}-\d\d-\d\d \d\d:\d\d/.test(value) ? value.replace(" ", "T") + "Z" : value;
  return new Date(iso).toISOString();
}
