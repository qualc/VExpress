const VExpress = require('./lib');
const app = VExpress();
app.get('/:id', function(req, res) {
    console.log(req.query);
    console.log(req.params);
    console.log('ok');
    res.send('ok');
});
app.post('/', function(req, res) {
    console.log(req.body);
    res.send('ok');
});
app.listen(3000, function(...args) {
    console.log('启动成功');
});
