#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/c9555e2745a8c94d223cf8bf7fd4035f6ab3bb682d5596f4e38054f146adbfce/contract';
import startContract from '../../snapshots/c9555e2745a8c94d223cf8bf7fd4035f6ab3bb682d5596f4e38054f146adbfce/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/fe2ae02ecc221e8f7a98da0707200761c62762e3047e9fd83afab7846efc7ddb/contract';
import endContract from '../../snapshots/fe2ae02ecc221e8f7a98da0707200761c62762e3047e9fd83afab7846efc7ddb/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'shareRateLimit',
        columns: [
          col('attemptCount', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('identifier', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('shareLinkId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('windowStart', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'shareRateLimit',
        constraint: 'shareRateLimit_shareLinkId_identifier_key',
        columns: ['shareLinkId', 'identifier'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'shareRateLimit',
        index: 'shareRateLimit_shareLinkId_idx_373d21c1',
        columns: ['shareLinkId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'shareRateLimit',
        foreignKey: {
          name: 'shareRateLimit_shareLinkId_fkey',
          columns: ['shareLinkId'],
          references: { schema: 'public', table: 'shareLink', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
