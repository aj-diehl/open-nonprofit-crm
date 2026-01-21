export function formDataFrom(entries: Record<string, any>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    if (value === undefined) continue;
    form.set(key, value as any);
  }
  return form;
}
