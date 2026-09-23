# BuildShare - Devnet branch proof (rejection, retry, cancellation)

Cluster: Solana Devnet

Program ID: `6CeFTzDPHrZqcWJ5WLvJCTTz1c2n6vSUGRvEPGgJjw3G`

project_id: `62077453940`

Project PDA: `39BHjEaybTotyeC7iRrsXJbD6iLCriuGGDMjhLqhjLn7`

Contributor: `C8a4rb4iZFNCMfDUHFUFY1xfB1uQnGemyCUmmhLBEtY1`

## Assertions verified on chain

| Check | Expected | Actual | Result |
| --- | --- | --- | --- |
| create_task reserves nothing | `0` | `0` | PASS |
| claim reserves exactly once | `1000` | `1000` | PASS |
| rejection KEEPS the reservation | `1000` | `1000` | PASS |
| rejected attempt status | `rejected` | `rejected` | PASS |
| re-claim does NOT reserve twice | `1000` | `1000` | PASS |
| approval moves no accounting | `1000` | `1000` | PASS |
| allocation clears the reservation | `0` | `0` | PASS |
| allocated_bps | `1000` | `1000` | PASS |
| member ownership after retry | `1000` | `1000` | PASS |
| task completed | `completed` | `completed` | PASS |
| reservation held | `1000` | `1000` | PASS |
| still reserved after rejection | `1000` | `1000` | PASS |
| cancellation releases the reservation | `0` | `0` | PASS |
| task cancelled | `cancelled` | `cancelled` | PASS |
| founder + pool == 10000 | `10000` | `10000` | PASS |
| allocated never exceeds the pool | `true` | `true` | PASS |

## Transaction signatures

| # | Instruction | Signature |
| --- | --- | --- |
| 1 | `fund_contributor (system transfer)` | [Shn98HheWCXhmPSGnh5VWvufq7wNraqaWCRYVmjcM86KaEpjiKGEw2iv1eqcNkGYyttJPCVvFakQW3FCUQ87dEC](https://explorer.solana.com/tx/Shn98HheWCXhmPSGnh5VWvufq7wNraqaWCRYVmjcM86KaEpjiKGEw2iv1eqcNkGYyttJPCVvFakQW3FCUQ87dEC?cluster=devnet) |
| 2 | `initialize_project` | [5JAyZkrvKowB1S1tCzJg3zNUp6kzDkegCKwNsYuWhJ9nHmRXDQRWcWvxTvXegn5gvNmDLKkCbjhEhmhPAYFvPmqr](https://explorer.solana.com/tx/5JAyZkrvKowB1S1tCzJg3zNUp6kzDkegCKwNsYuWhJ9nHmRXDQRWcWvxTvXegn5gvNmDLKkCbjhEhmhPAYFvPmqr?cluster=devnet) |
| 3 | `create_member` | [4JzNTZfXdiCGeKT1bmDsukEbydgJfxPszDomm2PJdd5yUCLDhT64tvW1nNfcNEzUS6edUEn3VbEzp2x8AqV6rA4X](https://explorer.solana.com/tx/4JzNTZfXdiCGeKT1bmDsukEbydgJfxPszDomm2PJdd5yUCLDhT64tvW1nNfcNEzUS6edUEn3VbEzp2x8AqV6rA4X?cluster=devnet) |
| 4 | `create_task #1` | [5Viw6hbVSwEUS2HTyTuMXqKdwdJv1KFNb7R3FaiFq5R8oUfSJm6eH15ffhAqpXuZKxYV4bfktEmRmADFWP5i53A6](https://explorer.solana.com/tx/5Viw6hbVSwEUS2HTyTuMXqKdwdJv1KFNb7R3FaiFq5R8oUfSJm6eH15ffhAqpXuZKxYV4bfktEmRmADFWP5i53A6?cluster=devnet) |
| 5 | `create_task #2` | [2wbnUzijzce4E96Eq2XoHy4ZXra5SHHXwG1CgxLV7Nm5y9fkHuF3Mbwa9m9QVuw9KrwczFiQ5efxjB3x1EXZNrDb](https://explorer.solana.com/tx/2wbnUzijzce4E96Eq2XoHy4ZXra5SHHXwG1CgxLV7Nm5y9fkHuF3Mbwa9m9QVuw9KrwczFiQ5efxjB3x1EXZNrDb?cluster=devnet) |
| 6 | `claim_task (attempt 1)` | [2rPfMXaULMzXuhFdLMQcoiWaEn54itUKmDTmhk17rVGWYxiczfXPo7tgyovgqik9PfFbvvTpeDM7Kv3v6owfcQ6F](https://explorer.solana.com/tx/2rPfMXaULMzXuhFdLMQcoiWaEn54itUKmDTmhk17rVGWYxiczfXPo7tgyovgqik9PfFbvvTpeDM7Kv3v6owfcQ6F?cluster=devnet) |
| 7 | `submit_contribution (attempt 1)` | [328X9tHt6mDTDXLjofCuAqM7EMeZJnCJRmeGvNLy5tGN4xAFeshcbktDRkXjFfh7mFUwmDQvi3sXaeNwRafywm9Y](https://explorer.solana.com/tx/328X9tHt6mDTDXLjofCuAqM7EMeZJnCJRmeGvNLy5tGN4xAFeshcbktDRkXjFfh7mFUwmDQvi3sXaeNwRafywm9Y?cluster=devnet) |
| 8 | `reject_contribution (attempt 1)` | [28Jbes4L2KNXTfgrzggLNGzb8Hu3aRRDxY15jxtQ8AdLsvZMXNHWr1fMMWw4qeC91SWDpdy4nDXQUz7oGqgEEMRA](https://explorer.solana.com/tx/28Jbes4L2KNXTfgrzggLNGzb8Hu3aRRDxY15jxtQ8AdLsvZMXNHWr1fMMWw4qeC91SWDpdy4nDXQUz7oGqgEEMRA?cluster=devnet) |
| 9 | `claim_task (attempt 2, after rejection)` | [y1weMmR2jwxHn2FSNYC9yv1Y5zBQ4TXSxprj3xWoswK1cx6BpG6ShXpXLkuiVUTM4sUpEeL8WAwMqshPDm1UQTk](https://explorer.solana.com/tx/y1weMmR2jwxHn2FSNYC9yv1Y5zBQ4TXSxprj3xWoswK1cx6BpG6ShXpXLkuiVUTM4sUpEeL8WAwMqshPDm1UQTk?cluster=devnet) |
| 10 | `submit_contribution (attempt 2)` | [4g5CCAi3HWtSePEekgRah6GYfpc8mqUJTezVEZMZn2zf6w2axwozq3c57DDZHMv82ZCwA9rpisPRtTuCxZBNayE5](https://explorer.solana.com/tx/4g5CCAi3HWtSePEekgRah6GYfpc8mqUJTezVEZMZn2zf6w2axwozq3c57DDZHMv82ZCwA9rpisPRtTuCxZBNayE5?cluster=devnet) |
| 11 | `approve_contribution (attempt 2)` | [eBXE6T6fXaqpr5JpG3NCCJ3LxaaLxMuhFki88w4ay5Dw71SRWVGk1tgYjnXTrJdksqcSbp5WuG3JRSFRyxKcdTQ](https://explorer.solana.com/tx/eBXE6T6fXaqpr5JpG3NCCJ3LxaaLxMuhFki88w4ay5Dw71SRWVGk1tgYjnXTrJdksqcSbp5WuG3JRSFRyxKcdTQ?cluster=devnet) |
| 12 | `allocate_ownership (attempt 2)` | [3BcGmSemYath9un9mYmYVarrB6iaGd1WV3DtwsYFP5m6AGxxz6mdJyizek6BVbsNyiAbF6hcehGdrh1mwWh5siTK](https://explorer.solana.com/tx/3BcGmSemYath9un9mYmYVarrB6iaGd1WV3DtwsYFP5m6AGxxz6mdJyizek6BVbsNyiAbF6hcehGdrh1mwWh5siTK?cluster=devnet) |
| 13 | `claim_task (task 2)` | [236qpaUgx1X5MM8h1KeAXj3QJkfFgZ96N1NExYnbgPXtaUSetRXydMnLWnWNT3e22BXo215n4PjXYBofexCSVB7p](https://explorer.solana.com/tx/236qpaUgx1X5MM8h1KeAXj3QJkfFgZ96N1NExYnbgPXtaUSetRXydMnLWnWNT3e22BXo215n4PjXYBofexCSVB7p?cluster=devnet) |
| 14 | `submit_contribution (task 2)` | [4Rhmk3i2jP9PCNwcMg6VYEEqWMxu8LqFpJaygNTff7BzKCDh7zpJVZVSxa3DNNdGYiLQxttUJqrZFPB85pQS976Y](https://explorer.solana.com/tx/4Rhmk3i2jP9PCNwcMg6VYEEqWMxu8LqFpJaygNTff7BzKCDh7zpJVZVSxa3DNNdGYiLQxttUJqrZFPB85pQS976Y?cluster=devnet) |
| 15 | `reject_contribution (task 2)` | [5JW33jFQRPZAVE7FW7RAnkgJfXm9U85wvUVF6KAUmCyy1ag8j8YQAqpNmPfKGzrfcxzsdmtnBETHjgpPWR75iM2R](https://explorer.solana.com/tx/5JW33jFQRPZAVE7FW7RAnkgJfXm9U85wvUVF6KAUmCyy1ag8j8YQAqpNmPfKGzrfcxzsdmtnBETHjgpPWR75iM2R?cluster=devnet) |
| 16 | `cancel_task (task 2)` | [2RPEaZe9SAqXcLSvPPnaPV6RQyTkkdWeZKMkRnviU2kJeupRgfjHHn58KLJzfmYrrxsWDpapsTm1LJZdvRXNSK13](https://explorer.solana.com/tx/2RPEaZe9SAqXcLSvPPnaPV6RQyTkkdWeZKMkRnviU2kJeupRgfjHHn58KLJzfmYrrxsWDpapsTm1LJZdvRXNSK13?cluster=devnet) |

Instructions still unproven on Devnet: `expire_claim` requires the seven-day claim window to elapse, and `update_task` is not exercised here.
