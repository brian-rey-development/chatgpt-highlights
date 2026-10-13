import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/preact'
import { afterEach, beforeEach, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { installFakeCheckVisibility, restorePrototypes } from '@/testing'

beforeEach(installFakeCheckVisibility)
afterEach(cleanup)
afterEach(() => vi.useRealTimers())
afterEach(() => fakeBrowser.reset())
afterEach(() => sessionStorage.clear())
afterEach(restorePrototypes)
