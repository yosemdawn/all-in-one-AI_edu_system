// Check the Git index, so ignored local server configuration is never read.
import { execFileSync } from 'node:child_process';

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const forbidden = files.filter((file) => {
  const name = file.split('/').at(-1);
  return (/^\.env(?:\.|$)/i.test(name) && !/\.example$/i.test(name)) ||
    /\.(?:pem|key|p12|pfx|bundle)$/i.test(name) || /^id_(?:rsa|ed25519|ecdsa)$/i.test(name);
});
if (forbidden.length) {
  console.error('Private configuration/key files must not be tracked:\n' + forbidden.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Tracked file check passed.');
}
