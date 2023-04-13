export interface DbConnectionParams {
    host?: string;
    user: string;
    password: string;
    database: string;
}
export interface SimpleObject {
    [key: string]: any;
}
interface RuleParams {
    model: SimpleObject;
    db: any;
    row?: any;
}
/**
 * example return value
 *  {
 *    potato: async (parent, args) => `tomato`
 *  };
 */
interface CustomQueryResolver {
    [query_name: string]: (parent: any, args: any) => any;
}
interface CustomResolver {
    [table_name: string]: CustomQueryResolver | ((parent: any, args: any) => any);
}
export interface RuleDefinition {
    /**
     * after delete action (optional)
     */
    after_delete?: (props: RuleParams) => void;
    /**
     * after insert action (optional)
     */
    after_insert?: (props: RuleParams) => void;
    /**
     * after update action (optional)
     */
    after_update?: (props: RuleParams) => void;
    /**
     * before deletion, return false to disallow/abort
     */
    before_delete?: (props: RuleParams) => boolean;
    /**
     * before insert preprocessing returns modified data object
     * or false if insert is not allowed
     */
    before_insert?: (props: RuleParams) => SimpleObject | boolean;
    /**
     * before update preprocessing returns modified data object
     * or false if insert is not allowed
     */
    before_update?: (props: RuleParams) => SimpleObject | boolean;
    /**
     * based on JWT data, return SQL to append to WHERE
     * AND is used
     */
    restrict?: (jwt: SimpleObject) => string;
    restrict_subgraph?: (jwt: SimpleObject) => string;
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
    custom_merged_types?: {
        [table: string]: string;
    };
    custom_merged_inputs?: {
        [table: string]: string;
    };
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
export {};
