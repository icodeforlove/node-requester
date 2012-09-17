/*jshint node:true*/
'use strict';

var http = require('http'),
	https = require('https'),
	url = require('url'),
	qs = require('querystring');

function Request ($config) {
	$config = $config || {};

	this._headers = $config.headers || {};
	this._timeout = $config.timeout || 4000;
	this._proxies = $config.proxies;
	this._retries = $config.retries || 0;
	this._encoding = $config.encoding || 'utf8';
	this._requestID = 0;
	this._didRequestFail = $config.didRequestFail;
	this._dataType = $config.dataType;

	this._makeRequest = this._makeRequest.bind(this);
}

Request.prototype = {
	post: function ($url, $options, callback) {
		if (arguments.length === 2) {
			callback = arguments[1];
			$options = {};
		}

		$options.method = 'POST';
		this._makeRequest($url, $options, callback);
	},

	get: function ($url, $options, callback) {
		if (arguments.length === 2) {
			callback = arguments[1];
			$options = {};
		}

		$options.method = 'GET';
		this._makeRequest($url, $options, callback);
	},

	_makeRequest: function ($url, $options, callback, _retry) {
		var self = this,
			parts = url.parse($url),
			method = $options.method,
			query = $options.data ? qs.stringify($options.data) : null,
			headers = {},
			proxy = this._proxies ? this._proxies[this._requestID % this._proxies.length] : null,
			protocol = parts.protocol === 'https:' && !proxy ? https : http,
			port = parts.protocol === 'https:' && !proxy ? 443 : 80,
			dataType = $options.dataType || this._dataType,
			didRequestFail = $options.didRequestFail || this._didRequestFail,
			header;

		_retry = _retry || 0;
		this._requestID++;
		
		// default headers
		for (header in this._headers) headers[header] = this._headers[header];

		// additional headers
		if ($options.headers) for (header in $options.headers) headers[header] = $options.headers[header];

		// prepare headers for request type
		if (method === 'POST' && query) {
			if (!headers['content-type']) headers['content-type'] = 'application/x-www-form-urlencoded';
			headers['content-length'] = query.length;
		} else if ($options.data && method === 'GET') {
			parts.search = parts.search ? parts.search + '&' + query : '?' + query;
		}

		function check (response) {
			if (dataType === 'JSON') {
				try {
					response.json = JSON.parse(response.body);
				} catch (e) {
					retry(response);
				}

				if (response.json) callback.call(response, response.json);
			} else if (didRequestFail && didRequestFail.call(response, response.body)) {
				retry(response);
			} else {
				callback.call(response, response.body);
			}
		}

		function retry (response) {
			if (_retry < self._retries) {
				_retry++;
				self._makeRequest($url, $options, callback, _retry);
				console.log('attempt', _retry);
			} else {
				callback.call(response, false);
			}
		}

		var request = protocol.request(
			{
				host: proxy ? proxy.ip : parts.hostname,
				port: proxy ? proxy.port : parts.port,
				path: proxy ? url.format(parts) : parts.pathname + (parts.search || ''),
				method: method,
				headers: headers
			},
			function (response) {
				var data = '';

				response.setEncoding($options.encoding || self._encoding);
				
				response.on('data', function (chunk) {
					data += chunk;
				});
				
				response.on('end', function () {
					response.body = data;
					response.parsedUrl = parts;
					response.proxy = proxy;

					check(response);
				});
			}
		);

		request.setTimeout(this.timeout, function () {
			console.log('request timed out');
		});

		request.on('error', function(e) {
			console.log('problem with request: ' + e.message);
		});

		if (method === 'POST') request.write(query);
		request.end();
	}
};

module.exports = exports = Request;