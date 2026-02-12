import { describe, it, expect, beforeEach } from 'bun:test';
import { logger } from '../utils/logger.js';
import type { LogEntry } from '../utils/logger.js';

describe('DebugLogger', () => {
  beforeEach(() => {
    logger.clear();
  });

  it('adds debug log entries', () => {
    let received: LogEntry[] = [];
    const unsub = logger.subscribe((logs) => { received = logs; });
    logger.debug('test message');
    expect(received).toHaveLength(1);
    expect(received[0].level).toBe('debug');
    expect(received[0].message).toBe('test message');
    unsub();
  });

  it('adds info log entries', () => {
    let received: LogEntry[] = [];
    const unsub = logger.subscribe((logs) => { received = logs; });
    logger.info('info message', { extra: 'data' });
    expect(received).toHaveLength(1);
    expect(received[0].level).toBe('info');
    expect(received[0].data).toEqual({ extra: 'data' });
    unsub();
  });

  it('adds warn log entries', () => {
    let received: LogEntry[] = [];
    const unsub = logger.subscribe((logs) => { received = logs; });
    logger.warn('warning');
    expect(received[0].level).toBe('warn');
    unsub();
  });

  it('adds error log entries', () => {
    let received: LogEntry[] = [];
    const unsub = logger.subscribe((logs) => { received = logs; });
    logger.error('error msg');
    expect(received[0].level).toBe('error');
    unsub();
  });

  it('assigns unique IDs to entries', () => {
    let received: LogEntry[] = [];
    const unsub = logger.subscribe((logs) => { received = logs; });
    logger.info('msg1');
    logger.info('msg2');
    expect(received[0].id).not.toBe(received[1].id);
    unsub();
  });

  it('includes timestamps', () => {
    let received: LogEntry[] = [];
    const unsub = logger.subscribe((logs) => { received = logs; });
    logger.info('test');
    expect(received[0].timestamp).toBeInstanceOf(Date);
    unsub();
  });

  it('maintains circular buffer (max 50 logs)', () => {
    let received: LogEntry[] = [];
    const unsub = logger.subscribe((logs) => { received = logs; });
    for (let i = 0; i < 55; i++) {
      logger.info(`msg-${i}`);
    }
    expect(received).toHaveLength(50);
    // Oldest 5 should be dropped; first remaining should be msg-5
    expect(received[0].message).toBe('msg-5');
    expect(received[49].message).toBe('msg-54');
    unsub();
  });

  it('notifies multiple subscribers', () => {
    let received1: LogEntry[] = [];
    let received2: LogEntry[] = [];
    const unsub1 = logger.subscribe((logs) => { received1 = logs; });
    const unsub2 = logger.subscribe((logs) => { received2 = logs; });
    logger.info('broadcast');
    expect(received1).toHaveLength(1);
    expect(received2).toHaveLength(1);
    unsub1();
    unsub2();
  });

  it('sends current logs immediately on subscribe', () => {
    logger.info('before');
    let received: LogEntry[] = [];
    const unsub = logger.subscribe((logs) => { received = logs; });
    expect(received).toHaveLength(1);
    expect(received[0].message).toBe('before');
    unsub();
  });

  it('unsubscribe stops notifications', () => {
    let callCount = 0;
    const unsub = logger.subscribe(() => { callCount++; });
    // Subscribe itself triggers 1 call
    expect(callCount).toBe(1);
    unsub();
    logger.info('after unsub');
    // Should NOT have been called again
    expect(callCount).toBe(1);
  });

  it('clear empties logs and notifies subscribers', () => {
    let received: LogEntry[] = [];
    const unsub = logger.subscribe((logs) => { received = logs; });
    logger.info('will be cleared');
    expect(received).toHaveLength(1);
    logger.clear();
    expect(received).toHaveLength(0);
    unsub();
  });
});
