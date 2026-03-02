const http = require('http');

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<h1>Transcendence</h1><p>Frontend stub — replace with React (Vite) in next task</p>');
});

const PORT = parseInt(process.env.FRONTEND_PORT, 10) || 3000;

server.listen(PORT, () => {
  console.log(`Frontend stub running on :${PORT}`);
});
