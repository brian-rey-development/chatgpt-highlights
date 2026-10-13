import { defineBackground } from 'wxt/utils/define-background'
import { createRouter, serve } from '@/messaging'
import { parseRequest } from '@/schemas'
import { openDatabase } from '@/storage'
import { createHandlers } from './handlers'
import { startPurge } from './purge'
import { startToolbarAction } from './toolbar-action'

export default defineBackground(() => {
  const database = openDatabase()
  serve(createRouter(parseRequest, createHandlers(database)))
  startToolbarAction()
  void startPurge(database)
})
