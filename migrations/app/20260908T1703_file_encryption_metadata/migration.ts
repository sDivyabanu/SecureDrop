#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/46ff17a429672f81686165532a374c376b2cf7f8900de752e01e8be4313fd96e/contract';
import startContract from '../../snapshots/46ff17a429672f81686165532a374c376b2cf7f8900de752e01e8be4313fd96e/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/c9555e2745a8c94d223cf8bf7fd4035f6ab3bb682d5596f4e38054f146adbfce/contract';
import endContract from '../../snapshots/c9555e2745a8c94d223cf8bf7fd4035f6ab3bb682d5596f4e38054f146adbfce/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'file',
        column: col('encryptionAuthTag', 'text', {
          notNull: true,
          default: lit(''),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'file',
        column: col('encryptionIv', 'text', {
          notNull: true,
          default: lit(''),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'file',
        column: col('encryptionSalt', 'text', {
          notNull: true,
          default: lit(''),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'file',
        column: col('keyVersion', 'int4', {
          notNull: true,
          default: lit(1),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
