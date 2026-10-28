import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export async function nextSeq(tx: Tx, key: string, seed: number) {
  const row = await tx.counter.upsert({
    where: { id: key },
    create: { id: key, value: seed },
    update: { value: { increment: 1 } },
  });
  return row.value;
}

export const SEQ_START: Record<string, number> = {
  customer: 1015,
  employee: 115,
  lead: 1019,
  request: 2013,
  estimate: 3011,
  project: 4010,
  job: 5023,
};

export function docNo(prefix: string, seq: number) {
  return `${prefix}-${seq}`;
}
