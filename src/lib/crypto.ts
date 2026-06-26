// Credential obfuscation for at-rest storage.
// NOTE: This is a lightweight XOR cipher with a per-deploy key — sufficient to keep
// secrets out of plain-text in the DB and logs, but NOT a substitute for proper
// AES-256 envelope encryption in a real mainnet deployment. Swap in node:crypto
// createCipheriv('aes-256-gcm', ...) before going live with real capital.

const KEY = process.env.OMEGA_SECRET_KEY || 'omega-skytrader-default-obfuscation-key-2026'

function xorCipher(input: string): string {
  const buf = Buffer.from(input, 'utf8')
  const keyBuf = Buffer.from(KEY, 'utf8')
  const out = Buffer.allocUnsafe(buf.length)
  for (let i = 0; i < buf.length; i++) {
    out[i] = buf[i] ^ keyBuf[i % keyBuf.length]
  }
  return out.toString('base64')
}

export function obfuscate(plain: string): string {
  if (!plain) return ''
  return xorCipher(plain)
}

export function deobfuscate(cipher: string): string {
  if (!cipher) return ''
  try {
    const buf = Buffer.from(cipher, 'base64')
    const keyBuf = Buffer.from(KEY, 'utf8')
    const out = Buffer.allocUnsafe(buf.length)
    for (let i = 0; i < buf.length; i++) {
      out[i] = buf[i] ^ keyBuf[i % keyBuf.length]
    }
    return out.toString('utf8')
  } catch {
    return ''
  }
}

/** Mask a secret for display: show first 2 + last 2 chars, asterisks in between. */
export function maskSecret(secret: string): string {
  if (!secret) return ''
  if (secret.length <= 6) return '••••'
  return secret.slice(0, 2) + '•'.repeat(Math.max(4, secret.length - 4)) + secret.slice(-2)
}
