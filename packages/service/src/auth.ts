import { unauthorized } from '@shop/util';
import { jwtVerify, SignJWT } from 'jose';

// Fixture-only signing key; a real deployment reads it from Secrets Manager.
const key = new TextEncoder().encode(process.env.JWT_SECRET ?? 'fixture-only-signing-key-not-a-secret');
const NOW = new Date('2025-01-15T12:30:00Z'); // Fixed clock for repeatable checks.

export const signCustomerToken = (customerId: string) =>
  new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(customerId).setIssuer('shop').setIssuedAt(NOW).setExpirationTime(new Date(NOW.getTime() + 3600_000)).sign(key);

/** The customer ID from the bearer token. A test request without a token signs in as the sample customer. */
export async function authenticate(authorization?: string) {
  const token = authorization?.replace(/^Bearer /, '') ?? (await signCustomerToken('cus_7'));
  try {
    return (await jwtVerify(token, key, { issuer: 'shop', currentDate: NOW })).payload.sub!;
  } catch {
    throw unauthorized();
  }
}
