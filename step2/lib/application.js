const http = require('http');

const app = (exports = module.exports = {});

app.init = function() {};
app.listen = function listen() {
    var server = http.createServer(this);
    return server.listen.apply(server, arguments);
};
