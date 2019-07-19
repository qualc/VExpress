const VExpress = require('./lib');

const app = VExpress();
const router = VExpress.Router();
app.use(
    function(req, res, next) {
        console.log('哈哈哈哈哈');
        next();
    },
    function(req, res, next) {
        console.log('哈哈哈哈哈2');
        next();
    }
);
app.get('/', function(req, res) {
    console.log('ok');
    res.send('ok');
});

router.get('/test', function(req, res) {
    console.log('test');
    res.send('test');
});

app.listen(3000, function(...args) {
    console.log('启动成功');
});
