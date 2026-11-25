export const trackedServiceFields = [
  "name",
  "category",
  "type",
  "providerRate",
  "sellingRate",
  "min",
  "max",
  "refill",
  "cancel",
  "active",
] as const;

export type CatalogFieldChange = {
  field: (typeof trackedServiceFields)[number];
  previous: unknown;
  current: unknown;
};

export function getCatalogServiceChanges(previous: object | undefined, current: Record<string, unknown>) {
  return trackedServiceFields.flatMap((field): CatalogFieldChange[] => {
    const oldValue = previous ? Reflect.get(previous, field) : undefined;
    const newValue = current[field];
    if (previous && Object.is(oldValue, newValue)) return [];
    return [{ field, previous: oldValue ?? null, current: newValue ?? null }];
  });
}
