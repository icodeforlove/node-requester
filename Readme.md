## node-request

A simple network request helper that is geared towards crawling

## installation

    $ npm install git://github.com/icodeforlove/node-request.git

## super simple to use

```javascript
var Request = require('request'),
	request = new Request();

request.get(/* URL */, function (body) {
	console.log(body)
});

request.get(/* URL */, /* REQUEST_OBJECT */, function (body) {
	console.log(body)
});
```

## request initialization

```javascript
var Request = ('request');

var request = new Request({
	cookies: {},
	headers: {},
	timeout: 4000,
	retries: 3,
	encoding 'utf8',
	// didRequestFail: null, (this has its own section)
	// signRequest: null, (this has its own section)
	dataType: 'raw' // or JSON
});
```

if you initialize the request object with any of the above properties every request will default to those settings, you can over ride them on a per request basis

```javascript
var options = {
	encoding: 'binary',
	proxy: {ip: '127.0.0.1', port: 1337},
	data: {foo: 'bar'},
	cookies: {foo: 'bar'}
};

request.get(/* URL */, options, function (body) {
	console.log(body)
});
```

## request signatures

you can create a custom request signature function like this

```javascript
var qs = require('querystring');

var request = new Request({
	signRequest: function (data) {
		// do something with the data
		return qs.stringify(data);
	}
});
```

## posting

```javascript
request.post('http://localhost?something=123', {data: {foo: 'bar', bar: 'foo'}}, function (body) {
	console.log(body)
});
```

## multipart

the multipart request works a little different, in the data object you can prefix a values key with '@' like this

```javascript
request.multipart('http://localhost?something=123', {data: {'@filename': 'filepath', bar: 'foo'}}, function (body) {
	console.log(body)
});
```

this will create a multipart request and upload files
