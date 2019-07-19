const VExpress = require('./lib');

const app = VExpress();
const Router = VExpress.Router();
app.get('/', function(req, res) {
    res.send('ok');
});
app.get('/test', function(req, res) {
    res.send('test');
});

app.listen(3000, function(...args) {
    console.log('启动成功');
});
