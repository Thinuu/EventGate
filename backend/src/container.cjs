const server = require('./server');
server.listen(Number(process.env.PORT) || 80, '0.0.0.0');
