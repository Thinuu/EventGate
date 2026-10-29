const server = require('./server');
if (process.env.VERCEL) server.listen(Number(process.env.PORT) || 3000);
module.exports = server.app;
