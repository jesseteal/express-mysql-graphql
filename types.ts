export interface DbConnectionParams {
  host?: string;
  user: string;
  password: string;
  database: string;
  connectionLimit?: number;
  [key: string]: unknown;
}

export interface DbClient {
  first: (...args: any[]) => Promise<any>;
  query: (...args: any[]) => Promise<any>;
  select: (...args: any[]) => Promise<any[]>;
  close: () => Promise<void>;
  quit: () => Promise<void>;
}

export interface RuleParams {
  model: Record<string, any>;
  db: DbClient;
  row?: any;
  token?: Record<string, any>;
}

export interface ResolverContext {
  req?: {
    auth?: Record<string, any>;
    user?: Record<string, any>;
    [key: string]: any;
  };
}

export interface QueryArgs {
  limit?: number;
  offset?: number;
  where?: string;
  order?: string;
}

export interface TableMetadata {
  TABLE_NAME: string;
  PKEYS: string;
  inputs: string;
  types: string;
}

export interface RelationshipMetadata {
  TABLE_NAME: string;
  LINKED_TABLE: string;
  FROM_COL: string;
  TO_COL: string;
}

export interface CustomQueryResolver {
  [query_name: string]: (
    parent: any,
    args: any,
    context?: ResolverContext,
  ) => any;
}

export interface CustomResolver {
  [table_name: string]: CustomQueryResolver | ((parent: any, args: any) => any);
}

export type RuleResult<T> = T | Promise<T>;

export interface RuleDefinition {
  after_delete?: (props: RuleParams) => RuleResult<void>;
  after_insert?: (props: RuleParams) => RuleResult<void>;
  after_update?: (props: RuleParams) => RuleResult<void>;
  before_delete?: (props: RuleParams) => RuleResult<boolean>;
  before_insert?: (
    props: RuleParams,
  ) => RuleResult<Record<string, any> | boolean>;
  before_update?: (
    props: RuleParams,
  ) => RuleResult<Record<string, any> | boolean>;
  restrict?: (jwt: Record<string, any>) => string | null | undefined;
  restrict_subgraph?: (jwt: Record<string, any>) => string | null | undefined;
}

export interface RuleDefinitionSet {
  [table_name: string]: RuleDefinition;
}

export interface MySQLGraphQLConfig {
  connection: DbConnectionParams;

  /**
   * custom GQL type definitions to include in schema
   * e.g. `scalar Date` or `scalar DateTime`
   */
  custom_types?: string;
  custom_merged_types?: { [table: string]: string };
  custom_merged_inputs?: { [table: string]: string };

  /**
   * custom GQL query definitions to include in schema
   * requires paired custom_query_resolvers definition
   * e.g.
   *  type Query {
   *    dailyMessage: String
   *  }
   */
  custom_queries?: string;

  /**
   * resolver for custom_queries, each Query should
   * have a matching named value of type CustomQueryResolver
   * a reference to the `db` connection allows for db access
   * e.g.
   * custom_query_resolvers: (db: any) => ({
   *   dailyMessage: () => `hello world`,
   *   other: async () => await db.query('select * from...')
   * })
   */
  custom_query_resolvers?: (db: any) => CustomQueryResolver;

  /**
   *
   * e.g.
   * custom_resolvers: (db:any) => ({
   *    user: {
   *      info: (parent: any, args: any) => any
   *    }
   * })
   */
  custom_resolvers?: (db: any) => CustomResolver;
  /**
   * custom GQL mutation definitions to include in schema
   * requires paried custom_mutation_resolvers definition
   * e.g.
   *   type Mutation {
   *     archive(type: String!): Boolean
   *   }
   */
  custom_mutations?: string;

  /**
   * resolvers for custom mutations, each Mutation should
   * have a matching named value of type CustomQueryResolver
   * a reference to the `db` connection allows for db access
   * e.g.
   * custom_mutation_resolvers: (db:any) => ({
   *   archive: async (parent:any, args: any) => {
   *     const { type } = args;
   *     await db.query('update tableX ... where type=?',[type]);
   *   }
   * })
   */
  custom_mutation_resolvers?: (db: any) => CustomQueryResolver;

  /**
   * allow schema introspection
   * necessary for systems that self-manage db schema (custom CRM tools)
   * this is not recommended
   */
  enable_schema_query?: boolean;
  enable_graphiql?: boolean;
  graphql_path?: string;

  jwt_signature?: string;
  jwt_unless?: (req: any) => boolean;

  /**
   * business rules and access control
   * define before/after actions for insert/update/delete
   * define access restrictions by table
   */
  rules?: RuleDefinitionSet;
}

export type MysqlGraphqlConfig = MySQLGraphQLConfig;
