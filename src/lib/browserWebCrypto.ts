/** Browser-only adapter for Mesh's optional Node WebCrypto fallback.
 * Next aliases @peculiar/webcrypto here only in the client build. Server builds
 * retain the Node implementation; browser cryptography always uses Web Crypto.
 */
export class Crypto {
  constructor() {
    if (!globalThis.crypto?.subtle) {
      throw new Error("Wallet cryptography requires Web Crypto in a secure browser context.");
    }
    return globalThis.crypto;
  }
}
