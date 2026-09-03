# BuildShare - Devnet lifecycle proof

Cluster: Solana Devnet

Program ID: `6CeFTzDPHrZqcWJ5WLvJCTTz1c2n6vSUGRvEPGgJjw3G`

Founder wallet: `6gVmCQJcrHMCAiESGfYdwNCUkE4Qr92WkmygrqD256JH`

Contributor wallet: `23PtT2KqW8piyR3WrntqNxdLw9rqGoj8cKc4th556L34`

project_id: `649825720450`

## Accounts

| Account | Address |
| --- | --- |
| Project PDA | `E8UyjRSsDU37jfSXdFCj94iUn4Rriqm3uJ3ienbALffm` |
| Task PDA | `Wuw2ZLjNpHmbFwXUM9Wyy9uzF77bUkHmGJRKBp991br` |
| Contribution PDA | `2oXGvyJ3xj9h43Gv2sPgDyt7FnRfm72c1ZCQncZHbCgS` |
| Member PDA | `86HrAtuw4BUtQ2Jd747mXu1rUhaeczyz2i9TevV99BRX` |

## Transaction signatures

| # | Instruction | Signature |
| --- | --- | --- |
| 0 | `fund_contributor (system transfer)` | [24ad14TUxDioarheXFmruym9VWSqzthi2m54tFXXZGVnGA84gmNKRh63UworkJsGSvbvLE6w1UtgM1uiW7Z25F2i](https://explorer.solana.com/tx/24ad14TUxDioarheXFmruym9VWSqzthi2m54tFXXZGVnGA84gmNKRh63UworkJsGSvbvLE6w1UtgM1uiW7Z25F2i?cluster=devnet) |
| 1 | `initialize_project` | [59HCsxZFYmCoTGxmcdcU3Np9NS8nQtTiPNnDfYSj2WiXSq6Z4VK96tQBYKtQYJx4FHZrbrYyU2oenZzr7JQ9S7Yf](https://explorer.solana.com/tx/59HCsxZFYmCoTGxmcdcU3Np9NS8nQtTiPNnDfYSj2WiXSq6Z4VK96tQBYKtQYJx4FHZrbrYyU2oenZzr7JQ9S7Yf?cluster=devnet) |
| 2 | `create_task` | [39RiWovn4AaQGk4fDiwd6rPFGAWBQHUkvxLzUP2mAoiz5EayjEpzstMnF7BDM5inqJ7Xt1ZZ6CMrkJsmzC8DPJ4X](https://explorer.solana.com/tx/39RiWovn4AaQGk4fDiwd6rPFGAWBQHUkvxLzUP2mAoiz5EayjEpzstMnF7BDM5inqJ7Xt1ZZ6CMrkJsmzC8DPJ4X?cluster=devnet) |
| 3 | `create_member` | [Ur2Gtwje2Bk8VpwhQ9m3Xp3AWzr5QAkMeTE7XaEyJEcHTpDaTfaUuqXWKKsv3PY3BzryypPSt8QxmMsR2KJR9CR](https://explorer.solana.com/tx/Ur2Gtwje2Bk8VpwhQ9m3Xp3AWzr5QAkMeTE7XaEyJEcHTpDaTfaUuqXWKKsv3PY3BzryypPSt8QxmMsR2KJR9CR?cluster=devnet) |
| 4 | `claim_task` | [hVHJyyCnAHi2V5abWKqVs6NfyjPC28JLVms9zsCKgxQub6Dcin29bJhQfTy6Gs2CYJaDQxQaE3cL8v75ZZny9dt](https://explorer.solana.com/tx/hVHJyyCnAHi2V5abWKqVs6NfyjPC28JLVms9zsCKgxQub6Dcin29bJhQfTy6Gs2CYJaDQxQaE3cL8v75ZZny9dt?cluster=devnet) |
| 5 | `submit_contribution` | [2Tr4nXujwBdoJLvW8f3rQ1AJeNAFDAynAZe2wtenjxThKRsCWnHf3siP3TEtPB5mWKxogX1Z84WugrRh69jdSg3j](https://explorer.solana.com/tx/2Tr4nXujwBdoJLvW8f3rQ1AJeNAFDAynAZe2wtenjxThKRsCWnHf3siP3TEtPB5mWKxogX1Z84WugrRh69jdSg3j?cluster=devnet) |
| 6 | `approve_contribution` | [2gpaf4rozYk6BetYGHPVSBqJmUVYu2NGhK9wQPrPGib7okyBih52qVYQ2fAPyNYdpSNKfzW99S7ZMSAcsMjz4pmp](https://explorer.solana.com/tx/2gpaf4rozYk6BetYGHPVSBqJmUVYu2NGhK9wQPrPGib7okyBih52qVYQ2fAPyNYdpSNKfzW99S7ZMSAcsMjz4pmp?cluster=devnet) |
| 7 | `allocate_ownership` | [9XBM1uAkSrAkBG7LfsdxZdJ45xPRm3qK3XueB4auvsGg5iVjoEmeXk2D1G3CVDJcqxoASvSYKkrwcXpDfP1sWSz](https://explorer.solana.com/tx/9XBM1uAkSrAkBG7LfsdxZdJ45xPRm3qK3XueB4auvsGg5iVjoEmeXk2D1G3CVDJcqxoASvSYKkrwcXpDfP1sWSz?cluster=devnet) |

## Final on-chain state

| Field | Value |
| --- | --- |
| project.founder_bps | 4000 |
| project.dev_pool_bps | 6000 |
| project.committed_bps | 0 |
| project.allocated_bps | 1000 |
| member.ownership_bps | 1000 |
| member.allocation_count | 1 |
| contribution.status | settled |
| task.status | completed |

Invariant check: PASS
