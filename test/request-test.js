var vows = require('vows'),
	assert = require('assert'),
	Requester = require('../index'),
	requester = new Requester({
		headers: {'connection': 'keep-alive'},
		debug: 0
	}),
	basePath = 'http://127.0.0.1:1338';

var request = function () {
	var params = Array.prototype.slice.call(arguments),
		method = params.shift();

	return function () {
		var self = this,
			callback = function (details) {
				self.callback(null, {request: this, details: JSON.parse(details)});
			};

		params.push(callback);

		requester[method].apply(requester, params);
	};
};

exports.getRequests2 = vows.describe('GET Requests').addBatch({
	'Standard Request': {
		topic: function () {
			var self = this;

			requester.get(basePath + '?something=something').then(function (response) {
				self.callback(null, response.body);
			}, function (error) {
				self.callback(error);
			});
		},

		'is response correct': function (topic) {
			assert.equal(topic, '{"headers":{"connection":"keep-alive","host":"127.0.0.1:1338"},"url":"/?something=something","method":"GET","body":""}');
		}
	}
});

exports.getRequests = vows.describe('GET Requests').addBatch({
	'Standard Request': {
		topic: request('get', basePath + '?something=something'),

		'is response correct': function (topic) {
			assert.equal(topic.request.statusCode, 200);
			assert.equal(JSON.stringify(topic.details), '{"headers":{"connection":"keep-alive","host":"127.0.0.1:1338"},"url":"/?something=something","method":"GET","body":""}');
		}
	},

	'Mixed Request': {
		topic: request('get', basePath + '?something=something', {data: {somethingElse: 'somethingElse'}}),

		'is response correct': function (topic) {
			assert.equal(topic.request.statusCode, 200);
			assert.equal(JSON.stringify(topic.details), '{"headers":{"connection":"keep-alive","host":"127.0.0.1:1338"},"url":"/?something=something&somethingElse=somethingElse","method":"GET","body":""}');
		}
	}
});

exports.postRequests = vows.describe('POST Requests').addBatch({
	'Standard Request': {
		topic: request('post', basePath, {data: {something: 'something'}}),

		'is response correct': function (topic) {
			assert.equal(topic.request.statusCode, 200);
			assert.equal(JSON.stringify(topic.details), '{"headers":{"connection":"keep-alive","content-type":"application/x-www-form-urlencoded","content-length":"19","host":"127.0.0.1:1338"},"url":"/","method":"POST","body":"something=something"}');
		}
	},
	'Mixed Request': {
		topic: request('post', basePath + '?something=something', {data: {something: 'something'}}),

		'is response correct': function (topic) {
			assert.equal(topic.request.statusCode, 200);
			assert.equal(JSON.stringify(topic.details), '{"headers":{"connection":"keep-alive","content-type":"application/x-www-form-urlencoded","content-length":"19","host":"127.0.0.1:1338"},"url":"/?something=something","method":"POST","body":"something=something"}');
		}
	},
	'Headers': {
		topic: request('post', basePath, {headers: {'user-agent': 'something'}}),

		'is response correct': function (topic) {
			assert.equal(topic.request.statusCode, 200);
			assert.equal(topic.details.headers['user-agent'], 'something');
		}
	},

	'Custom Content': {
		topic: request('post', basePath, {data: {something: 'something'}, headers: {'content-type': 'something'}}),

		'is response correct': function (topic) {
			assert.equal(topic.request.statusCode, 200);
			assert.equal(topic.details.body, 'something=something');
			assert.equal(topic.details.headers['content-type'], 'something');
		}
	},

	'JSON Content': {
		topic: request('post', basePath, {data: {something: 'something'}, headers: {'content-type': 'application/json'}}),

		'is response correct': function (topic) {
			assert.equal(topic.request.statusCode, 200);
			assert.equal(topic.details.body, '{"something":"something"}');
			assert.equal(topic.details.headers['content-type'], 'application/json');
		}
	}
});

exports.putRequests = vows.describe('PUT Requests').addBatch({
	'Standard Request': {
		topic: request('put', basePath, {data: {something: 'something'}}),

		'is response correct': function (topic) {
			assert.equal(topic.request.statusCode, 200);
			assert.equal(topic.details.method, 'PUT');
			assert.equal(topic.details.body, 'something=something');
		}
	}
});

exports.delRequests = vows.describe('DELETE Requests').addBatch({
	'Standard Request': {
		topic: request('del', basePath + '/post/123'),

		'is response correct': function (topic) {
			assert.equal(topic.request.statusCode, 200);
			assert.equal(topic.details.method, 'DELETE');
			assert.equal(topic.details.url, '/post/123');
		}
	}
});

exports.multipartRequests = vows.describe('Multipart Requests').addBatch({
	'Standard Request': {
		topic: request('multipart', basePath, {data: {something: 'something'}}),

		'is response correct': function (topic) {
			assert.equal(topic.request.statusCode, 200);
			assert.match(topic.details.body, /name="something"/);
		}
	}
});