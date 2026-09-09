// Read-only. Fetches a Task account and decodes it with the shipped decoder.
// Sends nothing, signs nothing.
import { Connection, PublicKey } from '@solana/web3.js';
import { decodeTaskAccount, TASK_ACCOUNT_LEN } from '../src/lib/solana/decode';

const RPC = process.env.RPC || 'https://api.devnet.solana.com';
const pda = process.argv[2];
if (!pda) {
  console.log('usage: npx tsx scripts/check-task-decode.mts <task-pda>');
  process.exit(1);
}
const info = await new Connection(RPC, 'confirmed').getAccountInfo(new PublicKey(pda));
if (info === null) {
  console.log('account not found: ' + pda);
  process.exit(1);
}
const data = new Uint8Array(info.data);
console.log('length     : ' + data.length + ' (expected ' + TASK_ACCOUNT_LEN + ')');
console.log('option tag : ' + data[52] + ' (1 = Some contributor, 0 = None)');
console.log('owner      : ' + info.owner.toBase58());
console.log(JSON.stringify(decodeTaskAccount(data), null, 1));
