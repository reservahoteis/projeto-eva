/**
 * Testes para EVA Memory Service
 *
 * TDD: RED -> GREEN -> REFACTOR
 *
 * Memory Service gerencia historico de conversas via Redis:
 * - Sliding window (ultimas 15 mensagens)
 * - TTL 24h
 * - Formato compativel com OpenAI ChatCompletionMessageParam
 */

import {
  getConversationHistory,
  addMessage,
  clearMemory,
} from '@/services/eva/memory/memory.service';

// Shared in-memory store (simulates Redis)
const store: Record<string, string[]> = {};

// Mock Redis
jest.mock('@/config/redis', () => ({
  redis: {
    lrange: jest.fn(),
    pipeline: jest.fn(),
    del: jest.fn(),
  },
}));

// Mock logger
jest.mock('@/config/logger', () => ({
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Get reference to mocked redis for re-applying implementations
const mockedRedis = jest.requireMock('@/config/redis') as {
  redis: {
    lrange: jest.Mock;
    pipeline: jest.Mock;
    del: jest.Mock;
  };
};

function setupRedisMocks() {
  mockedRedis.redis.lrange.mockImplementation(
    async (key: string, start: number, stop: number) => {
      const list = store[key] || [];
      const len = list.length;
      const realStart = start < 0 ? Math.max(0, len + start) : start;
      const realStop = stop < 0 ? len + stop : stop;
      return list.slice(realStart, realStop + 1);
    }
  );

  mockedRedis.redis.pipeline.mockImplementation(() => {
    const ops: Array<{ op: string; args: unknown[] }> = [];
    const pipe = {
      rpush: (key: string, value: string) => {
        ops.push({ op: 'rpush', args: [key, value] });
        return pipe;
      },
      ltrim: (key: string, start: number, stop: number) => {
        ops.push({ op: 'ltrim', args: [key, start, stop] });
        return pipe;
      },
      expire: (key: string, ttl: number) => {
        ops.push({ op: 'expire', args: [key, ttl] });
        return pipe;
      },
      exec: async () => {
        for (const { op, args } of ops) {
          if (op === 'rpush') {
            const [k, v] = args as [string, string];
            if (!store[k]) store[k] = [];
            store[k]!.push(v);
          }
          if (op === 'ltrim') {
            const [k, s, e] = args as [string, number, number];
            const list = store[k] || [];
            const len = list.length;
            const rS = s < 0 ? Math.max(0, len + s) : s;
            const rE = e < 0 ? len + e : e;
            store[k] = list.slice(rS, rE + 1);
          }
        }
        return [];
      },
    };
    return pipe;
  });

  mockedRedis.redis.del.mockImplementation(async (key: string) => {
    delete store[key];
    return 1;
  });
}

describe('EVA Memory Service', () => {
  beforeEach(() => {
    // Clear store
    Object.keys(store).forEach((k) => delete store[k]);
    // Re-apply implementations (resetMocks: true in jest.config wipes them)
    setupRedisMocks();
  });

  describe('addMessage', () => {
    it('should add a user message to Redis', async () => {
      await addMessage('conv-1', 'user', 'Ola!');

      const key = 'eva:memory:conv-1';
      const list = store[key];
      expect(list).toBeDefined();
      expect(list).toHaveLength(1);
      expect(JSON.parse(list![0]!)).toEqual({ role: 'user', content: 'Ola!' });
    });

    it('should add an assistant message to Redis', async () => {
      await addMessage('conv-1', 'assistant', 'Ola! Como posso ajudar?');

      const key = 'eva:memory:conv-1';
      const list = store[key];
      expect(list).toBeDefined();
      const parsed = JSON.parse(list![0]!);
      expect(parsed.role).toBe('assistant');
    });

    it('should maintain multiple messages in order', async () => {
      await addMessage('conv-2', 'user', 'Msg 1');
      await addMessage('conv-2', 'assistant', 'Msg 2');
      await addMessage('conv-2', 'user', 'Msg 3');

      const key = 'eva:memory:conv-2';
      const list = store[key]!;
      expect(list).toHaveLength(3);
      expect(JSON.parse(list[0]!).content).toBe('Msg 1');
      expect(JSON.parse(list[2]!).content).toBe('Msg 3');
    });
  });

  describe('getConversationHistory', () => {
    it('should return empty array for non-existent conversation', async () => {
      const history = await getConversationHistory('non-existent');
      expect(history).toEqual([]);
    });

    it('should return stored messages', async () => {
      store['eva:memory:conv-3'] = [
        JSON.stringify({ role: 'user', content: 'Hello' }),
        JSON.stringify({ role: 'assistant', content: 'Hi!' }),
      ];

      const history = await getConversationHistory('conv-3');
      expect(history).toHaveLength(2);
      expect(history[0]).toEqual({ role: 'user', content: 'Hello' });
      expect(history[1]).toEqual({ role: 'assistant', content: 'Hi!' });
    });
  });

  describe('clearMemory', () => {
    it('should delete all messages for a conversation', async () => {
      store['eva:memory:conv-4'] = [
        JSON.stringify({ role: 'user', content: 'Test' }),
      ];

      await clearMemory('conv-4');
      expect(store['eva:memory:conv-4']).toBeUndefined();
    });

    it('should call redis.del with both memory and unit keys', async () => {
      await clearMemory('conv-5');
      expect(mockedRedis.redis.del).toHaveBeenCalledWith('eva:memory:conv-5', 'eva:unit:conv-5');
    });
  });
});
