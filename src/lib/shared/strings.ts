export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function generateInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const parts = [];
  for (let i = 0; i < 6; i++) parts.push(alphabet[Math.floor(Math.random() * alphabet.length)]);
  return `NP-${parts.join("")}`;
}
