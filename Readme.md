## node-request

A simple network request helper that is geared towards crawling

## Installation

    $ npm install git://github.com/icodeforlove/node-request.git

## Super simple to use

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

## the request object

it supports the following objects
* data
* headers
* cookies

and supports the following settings
* encoding
* dataType

## Posting

```javascript
request.post('http://localhost?something=123', {data: {foo: 'bar', bar: 'foo'}}, function (body) {
	console.log(body)
});
```

## Multipart

the multipart request works a little different, in the data object you can prefix a values key with '@' like this

```javascript
request.multipart('http://localhost?something=123', {data: {'@filename': 'filepath', bar: 'foo'}}, function (body) {
	console.log(body)
});
```

this will create a multipart request and upload files
