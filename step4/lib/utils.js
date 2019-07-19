exports.mixin = function mixin(dest, src) {
    Object.getOwnPropertyNames(src).forEach(protoName => {
        if (Object.hasOwnProperty.call(dest, protoName)) {
            return;
        }
        let descriptor = Object.getOwnPropertyDescriptor(src, protoName);
        Object.defineProperty(dest, protoName, descriptor);
    });
    return dest;
};

exports.setProtoOf = function setProtoOf(obj, proto) {
    obj.__proto__ = proto;
    return obj;
};

exports.gettype = function gettype(obj) {
    var type = typeof obj;
    if (type !== 'object') {
        return type;
    }
    return toString.call(obj).replace(/^\[object (\S+)\]$/, '$1');
};
