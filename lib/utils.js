
/**
 * 格式化时间
 * @param {Date} date 
 * @param {String} format 
 */
exports.formatDate = function (date,format) {
   
    var o = {
        'M+': date.getMonth() + 1,
        'd+': date.getDate(),
        'h+': date.getHours(),
        'H+': date.getHours(),
        'm+': date.getMinutes(),
        's+': date.getSeconds(),
        'q+': Math.floor((date.getMonth() + 3) / 3),
        'w': '0123456'.indexOf(date.getDay()),
        'S': date.getMilliseconds()
    };
    if (/(y+)/.test(format)) {
        format = format.replace(RegExp.$1, (date.getFullYear() + '').substr(4 - RegExp.$1.length));
    }
    for (var k in o) {
        if (new RegExp('(' + k + ')').test(format))
        {
            format = format.replace(RegExp.$1,RegExp.$1.length == 1 ? o[k] : ('00' + o[k]).substr(('' + o[k]).length));
        }
    }
    return format;
    
}


/**
 * format string
 * @param {String} temp 
 */
exports.format = function(str) {
    var args = arguments;
    return str.replace(/\{([\d]+)\}/g, function (s1, s2) {
        var s = args[parseInt(s2) + 1];
        if (typeof (s) != 'undefined') {
            if (s instanceof (Date)) { return s.getTimezoneOffset(); }
            else {
                return (s);
            }
        }
        else {
            return '';
        }
    });
}


