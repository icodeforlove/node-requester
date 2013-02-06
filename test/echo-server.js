/*jshint node:true, strict:false*/
var colors = require('colors'),
	http = require('http'),
	port = 1338,
	host = '127.0.0.1';

http
	.createServer(function (request, response) {
		var data = '';

		request.setEncoding('utf8');
		request.on('data', function(chunk) {
			data += chunk;
		});

		request.on('end', function() {
			response.end(JSON.stringify({
				headers: request.headers,
				url: request.url,
				method: request.method,
				body: data
			}));
		});
	})
	.listen(port, host, function () {
		//process.send({port: port, host: host});
	});