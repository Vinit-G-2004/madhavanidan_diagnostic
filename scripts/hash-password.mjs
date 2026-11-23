// Usage: npm run hash-password -- "your-strong-password"
// Prints the value to paste into the ADMIN_PASSWORD_HASH environment variable.
import crypto from 'node:crypto';
const pw = process.argv[2];
if (!pw || pw.length < 10) { console.error('Give a password of at least 10 characters:\n  npm run hash-password -- "your-strong-password"'); process.exit(1); }
const salt = crypto.randomBytes(16);
const hash = crypto.scryptSync(pw, salt, 64);
console.log(`scrypt$${salt.toString('hex')}$${hash.toString('hex')}`);
