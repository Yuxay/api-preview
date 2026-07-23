import { describe, expect, it } from 'vitest'
import { readResponseBytes, ResponseTooLargeError } from '@/utils/http'

describe('readResponseBytes', () => {
  it('reads a response within the limit', async () => {
    const bytes = await readResponseBytes(new Response('hello'), 5)
    expect(new TextDecoder().decode(bytes)).toBe('hello')
  })

  it('rejects a streamed response that crosses the limit', async () => {
    const response = new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]))
        controller.enqueue(new Uint8Array([4, 5, 6]))
        controller.close()
      },
    }))

    await expect(readResponseBytes(response, 5)).rejects.toBeInstanceOf(ResponseTooLargeError)
  })
})
