/*jshint node:true, strict:false*/
var async = require('async'),
	echoServer = require('child_process').fork('echo-server'),
	Requester = require('../lib/requester'),
	colors = require('colors');

var requester = new Requester({
	headers: {'content-type': 'custom-default-content-type'}
});

function testRequest (name, method, args, callback) {
	console.log('\n' + name.yellow, method, JSON.stringify(args));
	args.push(function () {
		callback();
	});
	requester[method].apply(requester, args);
}

function testGet (callback) {
	testRequest('testGet', 'get', ['http://localhost:1338?something=something'], callback);
}

function testGetMixed (callback) {
	testRequest('testGetMixed', 'get', ['http://localhost:1338?something=something', {data: {somethingElse: 'somethingElse'}}], callback);
}

function testPost (callback) {
	testRequest('testPost', 'post', ['http://localhost:1338', {data: {something: 'something'}}], callback);
}

function testPostMixed (callback) {
	testRequest('testMixedPost', 'post', ['http://localhost:1338?something=something', {data: {somethingElse: 'somethingElse'}}], callback);
}

function testPostHeaders (callback) {
	testRequest('testPostHeaders', 'post', ['http://localhost:1338', {headers: {'user-agent': 'something'}}], callback);
}

function testPostCustomContent (callback) {
	testRequest('testPostCustomContent', 'post', ['http://localhost:1338', {data: {something: 'something'}, headers: {'content-type': 'something'}}], callback);
}

function testMultipart (callback) {
	testRequest('testMultipart', 'multipart', ['http://localhost:1338', {data: {something: 'something'}}], callback);
}


setTimeout(function () {
	async.series(
		[
			testGet,
			testGetMixed,
			testPost,
			testPostMixed,
			testPostHeaders,
			testPostCustomContent,
			testMultipart
		],
		function () {
			echoServer.kill();
		}
	);
}, 100);