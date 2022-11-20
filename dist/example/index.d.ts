declare const custom: {
    custom_merged_inputs: {
        user: string;
    };
    custom_merged_types: {
        response: string;
        shipment: string;
    };
    custom_types: string;
    custom_queries: string;
    custom_query_resolvers: (db: any) => {
        aggWinningContractRules: (parent: any, { limit }: {
            limit?: number | undefined;
        }) => Promise<any>;
        aggWinningSpotRules: (parent: any, { limit }: {
            limit?: number | undefined;
        }) => Promise<any>;
    };
    custom_resolvers: (db: any) => {
        shipment: {
            possible_response: (parent: any, args: any) => Promise<any>;
            from: (parent: any, args: any) => Promise<any>;
            to: (parent: any, args: any) => Promise<any>;
        };
    };
};
export default custom;
