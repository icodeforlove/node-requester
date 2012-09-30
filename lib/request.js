/*jshint node:true*/
'use strict';

var http = require('http'),
	https = require('https'),
	url = require('url'),
	qs = require('querystring'),
	FormData = require('form-data'),
	fs = require('fs'),
	async = require('async'),
	_ = require('underscore');

function Request ($config) {
	$config = $config || {};

	this._cookies = $config.cookies || {};
	this._headers = $config.headers || {};
	this._timeout = $config.timeout || 30000;
	this._proxies = $config.proxies;
	this._retries = $config.retries || 0;
	this._encoding = $config.encoding || 'utf8';
	this._requestID = 0;
	this._didRequestFail = $config.didRequestFail;
	this._signRequest = $config.signRequest;
	this._dataType = $config.dataType;
	this._auth = $config.auth;

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

	multipart: function ($url, $options, callback) {
		$options.multipart = true;
		this.post($url, $options, callback);
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
			query = this._signRequest ? this._signRequest($options.data) : $options.data ? qs.stringify($options.data) : '',
			headers = {},
			cookies = {},
			proxy = this._proxies ? this._proxies[this._requestID % this._proxies.length] : null,
			protocol = parts.protocol === 'https:' && !proxy ? https : http,
			port = parts.protocol === 'https:' && !proxy ? 443 : 80,
			dataType = $options.dataType || this._dataType,
			didRequestFail = $options.didRequestFail || this._didRequestFail,
			form,
			request,
			auth = $options.auth || this._auth;

		_retry = _retry || 0;
		this._requestID++;

		if (proxy && proxy.auth) auth = proxy.auth;
		
		cookies = _.extend(cookies, this._cookies, $options.cookies);
		headers = _.extend(headers, this._headers, $options.headers);

		headers.cookie = this._stringifyCookies(cookies);

		function check (response) {
			if (dataType === 'JSON') {
				try {
					response.json = JSON.parse(response.body);
				} catch (e) {
					retry(response);
				}

				if (didRequestFail && didRequestFail.call(response, response.body)) {
					retry(response);
				} else {
					callback.call(response, response.json);
				}
			} else if (didRequestFail && didRequestFail.call(response, response.body)) {
				retry(response);
			} else {
				callback.call(response, response.body);
			}
		}

		function retry (response) {
			if (_retry < ($options.retries || self._retries)) {
				_retry++;
				self._makeRequest($url, $options, callback, _retry);
				console.log('attempt', _retry);
			} else {
				callback.call(response, false);
			}
		}

		function startRequest () {
			if (auth) headers[proxy ? 'Proxy-Authorization' : 'Authorization'] = 'Basic ' + new Buffer(auth.username + ':' + auth.password).toString('base64');
	
			request = protocol.request(
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

			request.setTimeout($options.timeout || self._timeout, function () {
				retry();
				request.destroy();
			});

			request.on('error', function(e) {
				console.log('problem with request: ' + e.message);
			});
		}

		if (method === 'POST' && $options.multipart) {
			form = new FormData();
			var files = [];
			for (var key in $options.data) {
				if (key.substr(0,1) === '@') {
					files.push([key.substr(1), $options.data[key]]);
				} else {
					form.append(key, $options.data[key]);
				}
			}

			// read files if we have them
			async.forEach(
				files,
				function (file, callback) {
					fs.readFile(file[1], function (err, data) {
						if (err) throw err;
						form.append(file[0], data);
						callback();
					});
				},
				function () {
					headers = _.extend(headers, form.getCustomHeaders());
					startRequest();
					form.pipe(request);
				}
			);
		} else if (method === 'POST' && query) {
			if (!headers['content-type']) headers['content-type'] = 'application/x-www-form-urlencoded';
			headers['content-length'] = query.length;
		} else if ($options.data && method === 'GET') {
			parts.search = parts.search ? parts.search + '&' + query : '?' + query;
		}

		if (!form) {
			startRequest();
			if (method === 'POST') request.write(query);
			request.end();
		}
	},

	_stringifyCookies: function (cookies) {
		var string = '';
		for (var cookie in cookies) string += cookie + '=' + cookies[cookie] + '; ';
		return string.slice(0,-2);
	}
};

module.exports = exports = Request;