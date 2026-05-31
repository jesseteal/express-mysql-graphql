jest.mock("./src/connection", () => ({
  createDbContext: jest.fn(() => ({
    close: jest.fn(),
  })),
}));

jest.mock("./src/schema", () => ({
  generateSchema: jest.fn(() => new Promise(() => undefined)),
}));

import mysqlGraphql from "./index";
import { createDbContext } from "./src/connection";
import { generateSchema } from "./src/schema";

describe("mysqlGraphql", () => {
  test("creates an Express middleware app with instance-scoped db cleanup", () => {
    const app = mysqlGraphql({
      connection: {
        user: "user",
        password: "password",
        database: "test",
      },
    });

    expect(typeof app).toBe("function");
    expect(app.locals.mysqlGraphql.close).toEqual(expect.any(Function));
    expect(createDbContext).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "localhost",
        database: "test",
      }),
    );
    expect(generateSchema).toHaveBeenCalled();
  });
});
