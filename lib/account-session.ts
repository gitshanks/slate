/** Bind an old cookie to the exact account incarnation, even after re-signup. */
export function belongsToAccount(
  token: { accountCreatedAt?: string; iat?: number },
  createdAt: string,
) {
  if (token.accountCreatedAt) return token.accountCreatedAt === createdAt;
  const createdSeconds = Math.floor(new Date(createdAt).getTime() / 1_000);
  return typeof token.iat === "number" && token.iat >= createdSeconds;
}
