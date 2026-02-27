import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMock, setMock, delMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  setMock: vi.fn(),
  delMock: vi.fn(),
}));

vi.mock("../../src/adapters/upstash.js", () => ({
  redis: {
    get: getMock,
    set: setMock,
    del: delMock,
  },
}));

import { createRedisSessionStorage } from "../../src/adapters/session-storage.js";

type TestSession = {
  step: string;
};

describe("redis session storage", () => {
  beforeEach(() => {
    getMock.mockReset();
    setMock.mockReset();
    delMock.mockReset();
  });

  it("returns undefined when session key is missing", async () => {
    const storage = createRedisSessionStorage<TestSession>("bot:session");
    getMock.mockResolvedValueOnce(null);

    const session = await storage.read("42");

    expect(session).toBeUndefined();
    expect(delMock).not.toHaveBeenCalled();
  });

  it("reads legacy string JSON payloads", async () => {
    const storage = createRedisSessionStorage<TestSession>("bot:session");
    getMock.mockResolvedValueOnce('{"step":"menu"}');

    const session = await storage.read("42");

    expect(session).toEqual({ step: "menu" });
  });

  it("reads auto-deserialized object payloads", async () => {
    const storage = createRedisSessionStorage<TestSession>("bot:session");
    getMock.mockResolvedValueOnce({ step: "menu" });

    const session = await storage.read("42");

    expect(session).toEqual({ step: "menu" });
  });

  it("cleans up corrupted values and returns undefined", async () => {
    const storage = createRedisSessionStorage<TestSession>("bot:session");
    getMock.mockResolvedValueOnce("{bad-json");
    delMock.mockResolvedValueOnce(1);

    const session = await storage.read("42");

    expect(session).toBeUndefined();
    expect(delMock).toHaveBeenCalledWith("bot:session:42");
  });

  it("serializes session values on write", async () => {
    const storage = createRedisSessionStorage<TestSession>("bot:session");
    setMock.mockResolvedValueOnce("OK");

    await storage.write("42", { step: "menu" });

    expect(setMock).toHaveBeenCalledWith("bot:session:42", '{"step":"menu"}');
  });

  it("deletes keys from redis", async () => {
    const storage = createRedisSessionStorage<TestSession>("bot:session");
    delMock.mockResolvedValueOnce(1);

    await storage.delete("42");

    expect(delMock).toHaveBeenCalledWith("bot:session:42");
  });
});
