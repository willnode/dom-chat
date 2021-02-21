
function parseHttpLike(data) {
    var chunk = data.toString('utf-8').replace(/\r/g, '').split('\n\n', 2);
    var head = chunk[0].split('\n');
    var heads = head.reduce((p, c) => {
        var ss = c.split(':', 2);
        if (ss.length == 2) {
            p[ss[0].toLowerCase()] = ss[1].trim();
        }
        return p;
    }, {});
    return {
        headers: heads,
        method: head[0],
        body: chunk[1] || '',
    }
}

function sanitizeUsername(name) {
    return ('' + name).trim().replace(/ /g, '-').toLowerCase();
}

module.exports = {
    parseHttpLike,
    sanitizeUsername,
}