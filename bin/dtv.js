#!/usr/bin/env node
import { startServer } from '../src/server.js';

const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: dtv <trace.json | trace-directory>');
  console.error('');
  console.error('Examples:');
  console.error('  dtv decision_trace/forward_decision_trace.json');
  console.error('  dtv decision_trace/   # loads all traces in directory');
  process.exit(1);
}

startServer(filePath);
