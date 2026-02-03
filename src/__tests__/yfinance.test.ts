import { EventEmitter } from 'events';
import { Readable, Writable } from 'stream';
import { jest } from '@jest/globals';

const mockSpawn = jest.fn();

jest.unstable_mockModule('child_process', () => ({
  spawn: mockSpawn,
}));

describe('yfinance bridge', () => {
  it('parses JSON output from python bridge', async () => {
    const output = JSON.stringify({ ok: true, data: [{ date: '2025-01-01', open: 10 }] });

    mockSpawn.mockImplementation(() => {
      const proc = new EventEmitter() as EventEmitter & {
        stdout: Readable;
        stderr: Readable;
        stdin: Writable;
      };
      proc.stdout = new Readable({ read() {} });
      proc.stderr = new Readable({ read() {} });
      proc.stdin = new Writable({
        write(_chunk, _enc, cb) {
          cb();
        },
      });
      setImmediate(() => {
        proc.stdout.push(output);
        proc.stdout.push(null);
        proc.emit('close', 0);
      });
      return proc;
    });

    const { yfinanceHistory } = await import('../tools/finance/providers/yfinance.js');
    const data = await yfinanceHistory({
      symbol: 'PETR4.SA',
      start_date: '2025-01-01',
      end_date: '2025-01-31',
      interval: 'day',
    });
    expect(Array.isArray(data)).toBe(true);
  });
});
