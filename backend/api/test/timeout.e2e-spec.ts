import { withTimeout } from '../src/ai/timeout';

describe('withTimeout', () => {
  it('resolves when the promise wins the race', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 1000, 'x')).resolves.toBe('ok');
  });

  it('rejects with a labeled error when it times out', async () => {
    const slow = new Promise((resolve) => setTimeout(resolve, 50));
    await expect(withTimeout(slow, 5, 'gemini')).rejects.toThrow(
      /gemini timed out after 5ms/,
    );
  });
});
