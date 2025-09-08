# Provider Hash Snapshots

## Overview

The provider hash snapshot system maintains a historical record of provider hashes for payment methods on production networks (base_sepolia, base_staging, and base). This allows for better tracking of changes and easier rollback capabilities.

## How It Works

### Snapshot Creation

When deploying payment methods to production networks, the system automatically:

1. **Creates a timestamped snapshot file**: Saved as `{payment_method}_{timestamp}.json` in `deployments/outputs/platforms/snapshots/{network}/`
2. **Updates a latest reference**: Maintains a `{payment_method}_latest.json` file for easy access to the most recent configuration
3. **Updates the main network file**: Keeps the existing `deployments/outputs/platforms/{network}.json` file current

### File Structure

```
deployments/outputs/platforms/
├── base_sepolia.json          # Main network configuration (current state)
├── base_staging.json
├── base.json
└── snapshots/
    ├── base_sepolia/
    │   ├── venmo_2025-09-08T12-30-45.json
    │   ├── venmo_latest.json
    │   ├── revolut_2025-09-08T13-15-22.json
    │   └── revolut_latest.json
    ├── base_staging/
    └── base/
```

### Snapshot Content

Each snapshot file contains:

```json
{
  "paymentMethodHash": "0x...",
  "currencies": ["0x..."],
  "timestampBuffer": 30,
  "hashes": ["0x...", "0x..."],
  "updatedAt": "2025-09-08T12:30:45.123Z"
}
```

## Scripts

### List Available Snapshots

View all snapshots for a network:

```bash
npx ts-node scripts/list-provider-snapshots.ts base_sepolia
```

Filter by payment method:

```bash
npx ts-node scripts/list-provider-snapshots.ts base_sepolia venmo
```

### Remove Provider Hashes

Remove specific provider hashes from the contract:

1. Edit `scripts/remove-provider-hashes.ts` and add hashes to the `hashesToRemove` array
2. Run:
   ```bash
   npx hardhat run scripts/remove-provider-hashes.ts --network base_sepolia
   ```

### Restore from Snapshot

Restore provider hashes from a specific snapshot:

```bash
# Restore from latest snapshot
PAYMENT_METHOD=venmo npx hardhat run scripts/restore-provider-snapshot.ts --network base_sepolia

# Restore from specific snapshot
PAYMENT_METHOD=venmo SNAPSHOT_FILE=venmo_2025-09-08T12-30-45.json npx hardhat run scripts/restore-provider-snapshot.ts --network base_sepolia
```

## Benefits

1. **Historical Tracking**: Maintains a complete history of provider hash changes
2. **Easy Rollback**: Can restore to any previous configuration
3. **Audit Trail**: Each snapshot includes timestamps for tracking when changes were made
4. **Cleaner Updates**: Can remove old hashes and add new ones without losing historical data
5. **Production Safety**: Only applies to production networks, development networks use the simpler approach

## Network Coverage

This timestamped snapshot system is active for:
- `base_sepolia` - Base Sepolia testnet
- `base_staging` - Base staging environment  
- `base` - Base mainnet

Other networks (like `localhost`, `hardhat`) continue to use the original simpler approach without timestamping.

## Migration

When this system is first deployed:
1. Existing data in the main network files is preserved
2. New snapshots are created going forward
3. No manual migration is required