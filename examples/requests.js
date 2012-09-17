/*jshint node:true, strict:false*/
var	Request = require('../lib/request');

var request = new Request();

request.get('http://www.google.com', function (data) {
	console.log(data);
});

request.post('http://www.google.com', function (data) {
	console.log(data);
});