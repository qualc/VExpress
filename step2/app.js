const VExpress = require('./lib');

const app = VExpress();
app.listen(3000, function(...args) {
    console.log('启动成功');
});
