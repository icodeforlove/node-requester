## node-requester [![Build Status](https://travis-ci.org/icodeforlove/node-requester.png?branch=master)](https://travis-ci.org/icodeforlove/node-requester)

A simple network request helper that is geared towards crawling. (a few keywords GZIP, XML, JSON, PROXIES)

## installation

    $ npm install requester

## super simple to use

```javascript
var Requester = require('requester'),
	requester = new Requester({debug: 1});

requester.get(/* URL */, function (body) {
	console.log(this.statusCode, body);
});

requester.get(/* URL */, /* REQUEST_OBJECT */, function (body) {
	console.log(this.statusCode, body);
});
```

you can even use this simple [request translation tool](http://codepen.io/icodeforlove/full/nKuwa)

## initialization

```javascript
var Requester = ('requester');

var requester = new Requester({
	cookiejar: true, // basic cookie support, currently doesnt care about domain or path rules
	cookies: {},
	headers: {},
	timeout: 4000,
	retries: 3,
	encoding 'utf8',
	// didRequestFail: null, (this has its own section)
	// signRequest: null, (this has its own section)
	// processResponse: null, (this has its own section)
	dataType: 'RAW' // JSON or XML,
	auth: {username: 'username', password: 'password'}, // basic auth for all requests
	proxies: [{ip: '127.0.0.1', port: 1337}, {ip: '127.0.0.2', port: 1337}, {ip: '127.0.0.3', port: 1337}] // rotating proxy array
});
```

if you initialize the request object with any of the above properties every request will default to those settings, you can over ride them on a per request basis

```javascript
var options = {
	encoding: 'binary',
	proxy: {ip: '127.0.0.1', port: 1337},
	data: {foo: 'bar'},
	cookies: {foo: 'bar'},
	auth: {username: 'username', password: 'password'} // basic auth for request
};

requester.get(/* URL */, options, function (body) {
	console.log(body)
});
```
## request objects

they support the following properties
* {Object} data 
* {String} dataType
* {Object} headers
* {Object} cookies
* {Object} proxy
* {Object} auth
* {String} encoding
* {Number} timeout
* {Number} retries
* {Function} didRequestFail
* {Function} signRequest
* {Function} processResponse
* {Boolean} follow
* {Number} followMax
* {Number} debug

## debugging

you can set debug to the following
* 1 - outgoing requests 
* 2 - outgoing requests and responses with headers
* 3 - outgoing requests, responses with headers, and response body

## methods
* get
* post
* multipart
* put
* del

## proxies

request objects support proxies but you also can add / remove them from the proxy rotation like this

```javascript
var requester = new Requester({
	proxies: [{ip: 127.0.0.1, port: 1337}]
});

requester.addProxies({ip: 127.0.0.1, port: 1337}, {ip: 127.0.0.2, port: 1337}, {ip: 127.0.0.1, port: 1337, auth: {username: 'foo', password: 'bar'}});

requester.removeProxies({ip: 127.0.0.1, port: 1337});
```

this allows you to do custom checking outside of requester to maintain the proxy list

## request response checking

this is a method that gets ran before the actual response callback gets run to ensure that the content is what you're expecting, for example if the content rotates and you're looking for something special you can do

```javascript
requester.get(
	/ * URL */,
	{
		didRequestFail: function (data) {
			return !data.match(/something/);
		},
		retries: 10
	},
	function (data) {
		console.log(data);
	}
);
```

this would request the url until it matches the string 'something' in the response (up to 10 attempts)

## response preprocessing

lets say the server responds back with invalid JSON

```javascript
var json = {foo: 'bar'}
```
you can use a processResponse function to clean it up like this

```javascript
requester.get(
	/* URL */,
	{
		dataType: 'JSON',
		processResponse: function (body) {
			return body.replace(/^var json = /, '');
		}
	},
	function (body) {
		console.log(body);
	}
);
```

this is really useful if you want to not repeat response cleanup code

## request signatures

you can create a custom request signature function like this

```javascript
var qs = require('querystring');

var requester = new Requester({
	signRequest: function (data) {
		// do something with the data
		return qs.stringify(data);
	}
});
```

## posting

```javascript
requester.post(/* URL */, {data: {foo: 'bar', bar: 'foo'}}, function (body) {
	console.log(body)
});
```

## multipart

the multipart request works a little different, in the data object you can prefix a values key with '@' like this

```javascript
requester.multipart(/* URL */, {data: {'@file': /* FILEPATH */, '@file2': /* FILEPATH */, bar: 'foo'}}, function (body) {
	console.log(body)
});
```

this will create a multipart request and upload files
