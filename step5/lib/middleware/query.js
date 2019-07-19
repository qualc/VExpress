const url = require('url');
const querystring = require('querystring');

module.exports = function query() {
    return (req, res, next) => {
        if (!req.query) {
            // 通过 url 模块解析 url, 得到 query 部分
            let queryStr = url.parse(req.url).query;
            // 通过 querystring 模块将字符串的 query 解析成格式
            req.query = querystring.parse(queryStr);
        }
        next();
    };
};

/*
let path = 'https://www.baidu.com/?params=1&key=2';
let parse = url.parse(path).query;
console.log('parse:  ', parse);
//parse:   params=1&key=2
let query = querystring.parse(parse);
console.log(query);
// { params: '1', key: '2' }
*/
