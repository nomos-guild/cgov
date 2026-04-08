/**
 * Wraps free-form rationale text into a CIP-100-compatible JSON structure
 * for IPFS upload. Produces { body: { comment, title? } } which is already
 * parsed by extractRationaleText and getRationale in the read path.
 */
export function wrapRationaleAsJson(
  comment: string,
  title?: string,
): Record<string, unknown> {
  const body: Record<string, string> = { comment: comment.trim() };
  if (title?.trim()) {
    body.title = title.trim();
  }
  return { body };
}
