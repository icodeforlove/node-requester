/*jshint node:true, strict:false*/
var	Request = require('../lib/request');

var request = new Request();

request.get('http://www.google.com', function (data) {
	//console.log(data);
});

request.post('http://www.google.com', function (data) {
	//console.log(data);
});

request.get('http://chadscira.com', {data: {foo: 'bar'}, headers: {'user-agent': 'Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Trident/5.0)'}}, function (data) {
	//console.log(data);
});

request.get('http://chadscira.com', {data: {foo: 'bar'}, headers: {'user-agent': ''}}, function (data) {
	//console.log(data);
});

request.get('http://tumblruptime.apigee.com/json', {dataType: 'JSON'}, function (data) {
	//console.log(data);
});