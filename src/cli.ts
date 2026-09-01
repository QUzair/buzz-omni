#!/usr/bin/env node
import { AcpServer } from './acp-server.js'
import { createBuzzPublisher } from './buzz-publisher.js'
import { readConfig } from './config.js'
import { OmnigentClient } from './omnigent-client.js'

try {
  const config = readConfig()
  new AcpServer(config, new OmnigentClient(config), createBuzzPublisher(config.buzzCli)).run()
} catch (error) {
  const message = error instanceof Error ? error.message : 'Invalid bridge configuration'
  console.error(`[buzz-omnigent-acp] ${message}`)
  process.exitCode = 1
}
