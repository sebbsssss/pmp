#!/usr/bin/env node
/**
 * PMP conformance CLI.
 *
 *   pmp-conformance <base-url> [--bearer <token>] [--verbose] [--only <id,id>] [--json <path>]
 *
 * Env (alternative to flags):
 *   PMP_BASE_URL          base url of the provider
 *   PMP_BEARER_TOKEN      bearer token for CONTRIBUTE-class tests
 *   PMP_NO_COLOR=1        disable ANSI colors in output
 *
 * Exit codes:
 *   0  all tests passed (skips are not failures)
 *   1  at least one test failed
 *   2  invocation error (missing url, etc.)
 */

import { run } from './runner';
import { ALL_TESTS } from './tests';
import { writeFileSync } from 'node:fs';

interface Args {
  baseUrl?: string;
  bearerToken?: string;
  verbose: boolean;
  noColor: boolean;
  only: string[];
  jsonPath?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { verbose: false, noColor: false, only: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--bearer' || a === '-b') {
      args.bearerToken = argv[++i];
    } else if (a === '--verbose' || a === '-v') {
      args.verbose = true;
    } else if (a === '--no-color') {
      args.noColor = true;
    } else if (a === '--only') {
      const next = argv[++i];
      if (next) args.only = next.split(',').map((s) => s.trim()).filter(Boolean);
    } else if (a === '--json') {
      args.jsonPath = argv[++i];
    } else if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    } else if (!a.startsWith('-') && !args.baseUrl) {
      args.baseUrl = a;
    }
  }
  if (!args.baseUrl) args.baseUrl = process.env.PMP_BASE_URL;
  if (!args.bearerToken) args.bearerToken = process.env.PMP_BEARER_TOKEN;
  if (process.env.PMP_NO_COLOR === '1') args.noColor = true;
  return args;
}

function printHelp(): void {
  const lines = [
    'pmp-conformance — verify a PMP v0.1 provider against the spec',
    '',
    'Usage:',
    '  pmp-conformance <base-url> [options]',
    '',
    'Options:',
    '  -b, --bearer <token>  Bearer token for auth-required tests (CONTRIBUTE)',
    '  -v, --verbose         Print raw response bodies for failures',
    '      --no-color        Disable ANSI colors',
    '      --only <id,id>    Run only the listed test ids',
    '      --json <path>     Write a machine-parseable report to <path>',
    '  -h, --help            Show this message',
    '',
    'Examples:',
    '  pmp-conformance https://api.portablememoryprotocol.com',
    '  pmp-conformance https://api.clude.io --bearer $PRIVY_JWT',
    '  pmp-conformance https://my-provider.example --only discover.basic,verify.public',
    '',
    'Exit codes: 0 = all passed, 1 = some failed, 2 = invocation error',
  ];
  console.log(lines.join('\n'));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  if (!args.baseUrl) {
    console.error('error: base-url is required (positional arg or PMP_BASE_URL env var)');
    console.error('run with --help for usage');
    process.exit(2);
  }
  const { report } = await run(
    {
      baseUrl: args.baseUrl,
      bearerToken: args.bearerToken,
      verbose: args.verbose,
      noColor: args.noColor,
      only: args.only,
    },
    ALL_TESTS,
  );
  if (args.jsonPath) {
    writeFileSync(args.jsonPath, JSON.stringify(report, null, 2));
    console.log('');
    console.log(`  report → ${args.jsonPath}`);
  }
  process.exit(report.summary.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('conformance crashed:', err);
  process.exit(2);
});
