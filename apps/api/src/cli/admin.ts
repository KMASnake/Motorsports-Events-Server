import { createInitialAdministrator, resetAdministratorPassword, closeAdministratorStore } from '../lib/adminAccount.js';
import { Writable } from 'node:stream';
import { createInterface } from 'node:readline/promises';

type Command = 'create' | 'reset-password';

function usage(): never {
  throw new Error('Usage: admin <create|reset-password> --username NAME [--password-stdin]');
}

function parseArguments(argv: string[]): { command: Command; username: string; passwordStdin: boolean } {
  const command = argv[0] as Command;
  if (!['create', 'reset-password'].includes(command)) usage();
  let username = '';
  let passwordStdin = false;
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--username') username = argv[++index] ?? usage();
    else if (argument === '--password-stdin') passwordStdin = true;
    else usage();
  }
  if (!username) usage();
  return { command, username, passwordStdin };
}

async function readPasswordFromStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    throw new Error('Standard input is interactive; omit --password-stdin for a hidden prompt.');
  }
  let content = '';
  for await (const chunk of process.stdin) content += String(chunk);
  const password = content.replace(/[\r\n]+$/, '');
  if (!password) throw new Error('No password received on standard input.');
  return password;
}

async function promptHidden(label: string): Promise<string> {
  let muted = false;
  const output = new Writable({
    write(chunk, _encoding, callback) {
      if (!muted) process.stderr.write(chunk);
      callback();
    }
  });
  const reader = createInterface({ input: process.stdin, output, terminal: true });
  process.stderr.write(label);
  muted = true;
  try {
    return await reader.question('');
  } finally {
    muted = false;
    process.stderr.write('\n');
    reader.close();
  }
}

async function readPasswordInteractively(): Promise<string> {
  if (!process.stdin.isTTY) {
    throw new Error('Non-interactive input requires --password-stdin.');
  }
  const password = await promptHidden('Password: ');
  const confirmation = await promptHidden('Confirm password: ');
  if (password !== confirmation) throw new Error('Password confirmation does not match.');
  return password;
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2));
  const password = args.passwordStdin
    ? await readPasswordFromStdin()
    : await readPasswordInteractively();
  if (args.command === 'create') await createInitialAdministrator(args.username, password);
  else await resetAdministratorPassword(args.username, password);
  process.stdout.write(args.command === 'create'
    ? 'Administrator account created.\n'
    : 'Administrator password reset; active sessions revoked.\n');
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Administrator command failed.'}\n`);
  process.exitCode = 1;
}).finally(closeAdministratorStore);
