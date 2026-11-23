// Prints a random SESSION_SECRET value.
import crypto from 'node:crypto';
console.log(crypto.randomBytes(48).toString('base64url'));
