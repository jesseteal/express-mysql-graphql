import { MySQLGraphQLConfig } from "../types";
export declare const query: (...args: any[]) => Promise<any>;
export declare const select: (...args: any[]) => Promise<any>;
export declare const first: (...args: any[]) => Promise<any>;
declare const db: any;
export declare const generate_schema: (options: MySQLGraphQLConfig) => Promise<import("graphql").GraphQLSchema>;
export default db;
