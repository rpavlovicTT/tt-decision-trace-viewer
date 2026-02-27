import express from 'express';
import { createServer } from 'node:http';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import open from 'open';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function startServer(filePath) {
  const absPath = resolve(filePath);
  const stat = statSync(absPath);
  const isDir = stat.isDirectory();

  const app = express();

  // Serve static files from src/public
  app.use(express.static(join(__dirname, 'public')));

  // Serve node_modules for client-side imports
  const nodeModules = join(__dirname, '..', 'node_modules');
  app.get('/vendor/cytoscape.esm.min.js', (_req, res) => {
    res.type('application/javascript');
    res.sendFile(join(nodeModules, 'cytoscape', 'dist', 'cytoscape.esm.min.js'));
  });
  app.get('/vendor/cytoscape.min.js', (_req, res) => {
    res.type('application/javascript');
    res.sendFile(join(nodeModules, 'cytoscape', 'dist', 'cytoscape.min.js'));
  });
  app.get('/vendor/cytoscape-dagre.js', (_req, res) => {
    res.type('application/javascript');
    res.sendFile(join(nodeModules, 'cytoscape-dagre', 'cytoscape-dagre.js'));
  });
  app.get('/vendor/dagre.min.js', (_req, res) => {
    res.type('application/javascript');
    res.sendFile(join(nodeModules, 'dagre', 'dist', 'dagre.min.js'));
  });

  // API: list available trace files (directory mode)
  app.get('/api/traces', (_req, res) => {
    if (!isDir) {
      res.json([{ name: absPath.split('/').pop(), path: absPath }]);
      return;
    }
    const files = readdirSync(absPath)
      .filter(f => extname(f) === '.json')
      .map(f => ({ name: f, path: join(absPath, f) }));
    res.json(files);
  });

  // API: load a specific trace file
  app.get('/api/trace', (req, res) => {
    let target = absPath;
    if (req.query.file) {
      // Only allow loading files from the specified directory
      if (isDir) {
        const requested = resolve(absPath, req.query.file);
        if (!requested.startsWith(absPath)) {
          res.status(403).json({ error: 'Access denied' });
          return;
        }
        target = requested;
      }
    } else if (isDir) {
      // Load first JSON file in directory
      const files = readdirSync(absPath).filter(f => extname(f) === '.json');
      if (files.length === 0) {
        res.status(404).json({ error: 'No JSON files found in directory' });
        return;
      }
      target = join(absPath, files[0]);
    }

    try {
      const data = readFileSync(target, 'utf-8');
      res.type('application/json').send(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Find available port and start
  const server = createServer(app);
  server.listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    const url = `http://127.0.0.1:${port}`;
    console.log(`Decision Trace Viewer running at ${url}`);
    console.log(`Loading: ${absPath}`);
    console.log('Press Ctrl+C to stop');
    open(url);
  });
}
