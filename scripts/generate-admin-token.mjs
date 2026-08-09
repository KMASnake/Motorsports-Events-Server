import { createHmac } from 'node:crypto';

const secret = process.env.ADMIN_AUTH_SECRET;
const role = process.env.ADMIN_ROLE ?? 'admin';
const subject = process.env.ADMIN_SUBJECT ?? 'vps-validation';
const lifetime = Number(process.env.ADMIN_TOKEN_LIFETIME_SECONDS ?? 3600);
if (!secret || secret.length < 32) throw new Error('ADMIN_AUTH_SECRET doit contenir au moins 32 caractères.');
if (!['admin', 'viewer'].includes(role)) throw new Error('ADMIN_ROLE doit être admin ou viewer.');
const payload = Buffer.from(JSON.stringify({ sub: subject, role, exp: Math.floor(Date.now() / 1000) + lifetime })).toString('base64url');
const signature = createHmac('sha256', secret).update(payload).digest('base64url');
process.stdout.write(`${payload}.${signature}`);
