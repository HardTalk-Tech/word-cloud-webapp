import { describe, expect, it } from 'vitest';
import { npmRunArgs, parseArgs, splitCommandLine } from '../../scripts/lib';

describe('parseArgs (seed / load-test options)', () => {
  it('reads --key value, --key=value and bare flags', () => {
    expect(parseArgs(['--event', 'dev', '--count=30', '--force'], {})).toEqual({ event: 'dev', count: '30', force: 'true' });
  });

  it('PowerShell dropped "--" but used "=": values come from npm_config_*', () => {
    expect(parseArgs([], { npm_config_event: 'dev', npm_config_count: '30', npm_config_delay: '3000' })).toEqual({
      event: 'dev',
      count: '30',
      delay: '3000',
    });
  });

  it('PowerShell dropped "--" with "--count 30": stops with a clear message instead of seeding the default 100', () => {
    expect(() => parseArgs(['dev', '30'], { npm_config_event: 'true', npm_config_count: 'true' })).toThrow(/--count=30/);
  });

  it('command-line values win over npm env, unrelated npm config is ignored', () => {
    expect(parseArgs(['--count', '5'], { npm_config_count: '99', npm_config_cache: 'C:/x' })).toEqual({ count: '5' });
  });

  it('no options: empty (the script uses its defaults and says so)', () => {
    expect(parseArgs([], {})).toEqual({});
  });
});

describe("npmRunArgs (PowerShell fallback: options from npm's own command line)", () => {
  const npm = String.raw`"C:\Program Files\nodejs\node.exe" "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js"`;

  it('returns the options after the script name, in typed order', () => {
    expect(npmRunArgs(`${npm} run seed --event dev --count 5 --delay 3000`)).toEqual(['--event', 'dev', '--count', '5', '--delay', '3000']);
  });

  it('drops a surviving "--" and parses like the normal path', () => {
    const a = npmRunArgs(`${npm} run seed -- --event dev --count 30`)!;
    expect(parseArgs(a, {})).toEqual({ event: 'dev', count: '30' });
  });

  it('ignores processes that are not npm run', () => {
    expect(npmRunArgs(String.raw`C:\Windows\system32\cmd.exe /d /s /c tsx scripts/seed.ts dev 5`)).toBeNull();
    expect(npmRunArgs(`${npm} install`)).toBeNull();
  });

  it('splits quoted paths as one argument', () => {
    expect(splitCommandLine('"a b" c "d"')).toEqual(['a b', 'c', 'd']);
  });
});
