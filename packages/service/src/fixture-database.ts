// Fixture only: a pg Pool that answers Prisma's SQL from in-memory tables instead of a PostgreSQL server. Prisma, its
// driver adapter and pg's type parsers run as they would against a database; only the network round trip is replaced.
// It understands the statements this backend sends: SELECT, INSERT and UPDATE with simple AND conditions. Writes
// return the written row but are not kept, so every invocation sees the same data.
import pg from 'pg';
import { seed, type Row } from './sample-data';

// PostgreSQL type IDs of the columns, so pg parses each value as it would parse a real result.
const TYPES: Record<string, number> = { text: 25, int: 23, numeric: 1700, timestamp: 1114 };
const COLUMNS: Record<string, Record<string, keyof typeof TYPES>> = {
  Customer: { id: 'text', email: 'text', name: 'text', createdAt: 'timestamp' },
  Product: { id: 'text', name: 'text', category: 'text', price: 'numeric', stock: 'int', weightGrams: 'int' },
  Order: { id: 'text', customerId: 'text', status: 'text', total: 'numeric', currency: 'text', placedAt: 'timestamp' },
  OrderLine: { id: 'text', orderId: 'text', productId: 'text', quantity: 'int', unitPrice: 'numeric' },
  Shipment: { id: 'text', orderId: 'text', carrier: 'text', trackingNumber: 'text', status: 'text', updatedAt: 'timestamp' }
};

const tables = seed;
const column = /"public"\."\w+"\."(\w+)"/g;
const names = (sql: string) => [...sql.matchAll(column)].map((m) => m[1]);
const text = (value: unknown) => (value instanceof Date ? value.toISOString().replace('T', ' ').replace('Z', '') : String(value));

function matches(row: Row, where: string, values: unknown[]) {
  const conditions = [...where.matchAll(/"public"\."\w+"\."(\w+)" (=|<|>|<=|>=|IN) \(?([$\d, ]+)\)?/g)];
  return conditions.every(([, name, op, params]) => {
    const args = params.split(',').map((p) => text(values[Number(p.trim().slice(1)) - 1]));
    const actual = row[name];
    const number = ['int', 'numeric'].includes(COLUMNS[row.__table][name]);
    const [a, b] = number ? [Number(actual), Number(args[0])] : [actual, args[0]];
    return op === 'IN' ? args.includes(actual) : op === '=' ? a === b : op === '<' ? a < b : op === '>' ? a > b : op === '<=' ? a <= b : a >= b;
  });
}

function execute(sql: string, values: unknown[]) {
  const table = sql.match(/(?:FROM|INTO|UPDATE) "public"\."(\w+)"/)![1];
  const rows = tables[table];
  let selected: Row[];
  let returned: string[];
  if (sql.startsWith('INSERT')) {
    const insertColumns = sql.match(/\(([^)]*)\) VALUES/)![1].split(',').map((c) => c.trim().replaceAll('"', ''));
    const row: Row = { __table: table };
    insertColumns.forEach((name, i) => (row[name] = text(values[i])));
    selected = [row];
    returned = names(sql.split('RETURNING')[1]);
  } else if (sql.startsWith('UPDATE')) {
    const [set, rest] = sql.split(' WHERE ');
    selected = rows.filter((row) => matches(row, rest.split('RETURNING')[0], values)).map((row) => ({ ...row }));
    for (const [, name, param] of set.matchAll(/"(\w+)" = \$(\d+)/g)) for (const row of selected) row[name] = text(values[Number(param) - 1]);
    returned = names(rest.split('RETURNING')[1] ?? '');
  } else {
    const where = sql.split(' WHERE ')[1]?.split(/ (?:ORDER BY|LIMIT|OFFSET) /)[0] ?? '';
    selected = rows.filter((row) => matches(row, where, values));
    const limit = sql.match(/LIMIT \$(\d+)/);
    if (limit) selected = selected.slice(0, Number(values[Number(limit[1]) - 1]));
    returned = names(sql.split(' FROM ')[0]);
  }
  return { selected, returned, table };
}

export class FixturePool extends pg.Pool {
  override async query(config: any): Promise<any> {
    const { selected, returned, table } = execute(config.text, config.values ?? []);
    const fields = returned.map((name) => ({ name, dataTypeID: TYPES[COLUMNS[table][name]] }));
    const parse = (name: string, value: string) => config.types.getTypeParser(TYPES[COLUMNS[table][name]], 'text')(value);
    return { rows: selected.map((row) => returned.map((name) => parse(name, row[name]))), fields, rowCount: selected.length };
  }
  override async connect(): Promise<any> {
    return { query: (config: any) => this.query(config), release() {} };
  }
}
