const http = require('http');

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<h1>Transcendence</h1><p>Frontend stub — replace with React (Vite) in next task</p>');
});

server.listen(3000, () => {
  console.log('Frontend stub running on :3000');
});
