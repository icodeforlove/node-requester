/*jshint node:true, strict:false*/
var	Requester = require('../lib/requester');

var requester = new Requester();

requester.get('http://www.google.com', function (data) {
	//console.log(data);
});

requester.post('http://www.google.com', function (data) {
	//console.log(data);
});

requester.get('http://www.google.com', {data: {foo: 'bar'}, headers: {'user-agent': 'Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Trident/5.0)'}}, function (data) {
	//console.log(data);
});

requester.get('http://www.google.com', {data: {foo: 'bar'}, headers: {'user-agent': ''}}, function (data) {
	//console.log(data);
});

requester.get('http://tumblruptime.apigee.com/json', {dataType: 'JSON'}, function (data) {
	//console.log(data);
});