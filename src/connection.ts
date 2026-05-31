import mysql from "mysql2";
import { DbClient, DbConnectionParams } from "../types";

export interface DbContext extends DbClient {
  database: string;
  pool: mysql.Pool;
}

export const createDbContext = (connection: DbConnectionParams): DbContext => {
  const pool = mysql.createPool({
    connectionLimit: 10,
    ...connection,
  });
  const promisePool = pool.promise();

  const query = async (...args: any[]) =>
    (promisePool.query as (...queryArgs: any[]) => Promise<any>)(...args);

  const select = async (...args: any[]) => {
    const [rows] = await query(...args);
    return rows as any[];
  };

  const first = async (...args: any[]) => {
    const rows = await select(...args);
    return rows[0];
  };

  const close = async () => {
    await promisePool.end();
  };

  return {
    database: connection.database,
    pool,
    first,
    query,
    select,
    close,
    quit: close,
  };
};
