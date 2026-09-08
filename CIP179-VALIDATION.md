# CIP-179 frontend validation

Use the committed npm lockfile and Node 22.13 or newer; the local validation used
Node 22.23.2. Run `npm ci`, then:

```sh
npm run test:cip179
npm run test:cip179:integration
npm run lint
npm run build
```

The focused unit tests cover response encoding. Ten integration cases extract
the actual vote-submission callback and run real Mesh coin selection and CBOR
assembly, followed by an independent CSL signature with a public synthetic key.
Wallet, provider and UI boundaries are simulated. Test output stays in ignored
`.test-artifacts/`. Nothing is submitted to a network.

Invalid survey drafts block wallet access until corrected or explicitly discarded
using the governance-vote-only checkbox. Editing a draft clears that consent.
Presentation refreshes retain answers for the same survey, and a changed survey
reference remounts the form. Ordinary governance votes and wallet rejection are
covered by the integration suite.

This release supports public DRep responses to built-in questions. Custom
methods are explicitly unsupported, rather than inferred from a schema's text
type. Presentation documents are bounded to 1 MiB with a 15-second timeout per
gateway and verified against the raw-byte hash. Points and ratings show counts,
weighted sums and answered weight; weighting is CGov policy, not a CIP-179 rule.

The client-only Web Crypto adapter resolves Mesh's optional Node fallback in
browser builds. It uses the browser's native Web Crypto in a secure context;
server builds retain the dependency's Node implementation.

The production build passes; lint retains an unrelated pre-existing `<img>`
warning in AIChatPanel. Browser-extension interaction, accessibility review and
Preview ledger acceptance still require coordinated deployment testing.
Pre-existing transitive dependency advisories remain; this change is not a
blanket dependency-security certification.
