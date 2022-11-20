const SQL_RELATIONSHIPS = (schema: string) => `select
  t.TABLE_NAME,
  t.REFERENCED_TABLE_NAME as LINKED_TABLE,
  t.COLUMN_NAME as FROM_COL,
  t.REFERENCED_COLUMN_NAME AS TO_COL
  from INFORMATION_SCHEMA.KEY_COLUMN_USAGE t
  WHERE t.TABLE_SCHEMA='${schema}'
  AND t.REFERENCED_TABLE_NAME IS NOT NULL
  ORDER BY t.TABLE_NAME
`;

const SQL_SCHEMA = (schema: string) => `select
    q1.TABLE_NAME,
    q1.types,
    pk.PKEYS,
    CONCAT('input ', q2.TABLE_NAME, 'Input {
    ',group_concat(q2.COLUMNS SEPARATOR '\n'),'
    }') as inputs
  from
  (
    SELECT
      t.TABLE_NAME,
        CONCAT('type ',t.TABLE_NAME,' {
    ',group_concat(q.COLUMNS SEPARATOR '\n'),'
    }') as types
      FROM INFORMATION_SCHEMA.TABLES t
      inner join
      (
      SELECT
        c.TABLE_NAME,
        CONCAT('\t',COLUMN_NAME,': ',
              case when DATA_TYPE in ('int','tinyint','smallint','bigint') THEN ' Int'
                when DATA_TYPE in ('decimal','float','double') THEN ' Float'
                when DATA_TYPE = 'datetime' then ' DateTime'
                when DATA_TYPE = 'date' then ' Date'
                ELSE ' String' end,
              case when IS_NULLABLE = 'NO' AND COLUMN_KEY <> 'PRI' then '!' else '' end
        ) as COLUMNS
      FROM INFORMATION_SCHEMA.COLUMNS c
      WHERE c.TABLE_SCHEMA='${schema}' AND c.COLUMN_COMMENT NOT LIKE '@Omit'
      union
      -- FK references
      select
      t.TABLE_NAME,
      concat('\t',t.COLUMN_NAME,'_',t.REFERENCED_TABLE_NAME,'(where: String): ',t.REFERENCED_TABLE_NAME) as COLUMNS
      from INFORMATION_SCHEMA.KEY_COLUMN_USAGE t
      WHERE t.TABLE_SCHEMA='${schema}'
      AND t.REFERENCED_TABLE_NAME IS NOT NULL
      -- reverse FK (children)
      union
      select
      t.REFERENCED_TABLE_NAME,
      concat('\t',case when TABLE_NAME = REFERENCED_TABLE_NAME then SUBSTRING(t.COLUMN_NAME,1,LENGTH(t.COLUMN_NAME)-2) else t.TABLE_NAME end,'(limit: Int, offset: Int, where: String, order: String): [',t.TABLE_NAME,']') as COLUMNS
      from INFORMATION_SCHEMA.KEY_COLUMN_USAGE t
      WHERE t.TABLE_SCHEMA='${schema}'
      AND t.REFERENCED_TABLE_NAME IS NOT NULL
          ) q on q.TABLE_NAME=t.TABLE_NAME
          WHERE t.TABLE_SCHEMA='${schema}'
          AND TABLE_COMMENT not LIKE '@Omit'
          GROUP BY t.TABLE_NAME
      )q1
      inner join
      (
      SELECT
            c.TABLE_NAME,
      CONCAT('\t',COLUMN_NAME,': ',
          case when DATA_TYPE in ('int','tinyint','smallint','bigint') THEN ' Int'
            when DATA_TYPE in ('decimal','float','double') THEN ' Float'
            when DATA_TYPE = 'datetime' then ' DateTime'
            when DATA_TYPE = 'date' then ' Date'
            ELSE ' String' end
        ) as COLUMNS
        FROM INFORMATION_SCHEMA.COLUMNS c
        WHERE c.TABLE_SCHEMA='${schema}' AND c.COLUMN_COMMENT NOT LIKE '@Omit'
  ) q2 on q1.TABLE_NAME=q2.TABLE_NAME
  INNER JOIN (
    SELECT
      t.TABLE_NAME,group_concat(c.COLUMN_NAME) AS PKEYS
    FROM INFORMATION_SCHEMA.TABLES t
      LEFT JOIN INFORMATION_SCHEMA.COLUMNS c on c.TABLE_NAME=t.TABLE_NAME
    WHERE t.TABLE_SCHEMA='${schema}' AND c.TABLE_SCHEMA='${schema}'
      AND t.TABLE_COMMENT not LIKE '@Omit'
      AND c.COLUMN_KEY='PRI'
    group by t.TABLE_NAME
    ORDER BY t.TABLE_NAME
  ) pk on pk.TABLE_NAME=q1.TABLE_NAME
  group by q1.TABLE_NAME
`;

export default {
  SQL_RELATIONSHIPS,
  SQL_SCHEMA,
};
