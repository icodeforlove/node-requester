/*jshint node:true*/
'use strict';

var http = require('http'),
	https = require('https'),
	url = require('url'),
	qs = require('querystring'),
	FormData = require('form-data'),
	fs = require('fs'),
	xml2js = require('xml2js'),
	async = require('async'),
	zlib = require('zlib'),
	_ = require('underscore');

function RequesterHandler ($config) {
	$config = $config || {};

	this._cookies = $config.cookies || {};
	this._headers = $config.headers || {};
	this._timeout = $config.timeout || 30000;
	this._proxies = $config.proxies || [];
	this._retries = $config.retries || 0;
	this._encoding = $config.encoding || 'utf8';
	this._cookiejar = $config.cookiejar ? {} : false;
	this._follow = _.isUndefined($config.follow) ? true : $config.follow;
	this._followMax = _.isUndefined($config.followMax) ? 5 : $config.followMax;
	this._requestID = 0;
	this._didRequestFail = $config.didRequestFail;
	this._signRequest = $config.signRequest;
	this._processResponse = $config.processResponse;
	this._dataType = $config.dataType;
	this._auth = $config.auth;

	if (this._cookiejar) this._cookiejar = _.extend(this._cookiejar, this._cookies);
}

RequesterHandler.prototype = {
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

	addProxies: function () {
		for (var proxy = 0; proxy < arguments.length; proxy++) {
			if (this._proxyCheck(arguments[proxy]) === -1) {
				this._proxies.push(arguments[proxy]);
			}
		}
	},

	removeProxies: function () {
		for (var proxy = 0; proxy < arguments.length; proxy++) {
			var index = this._proxyCheck(arguments[proxy]);
			if (index !== -1) this._proxies.splice(index, 1);
		}
	},

	_proxyCheck: function (query) {
		var index = -1;

		this._proxies.forEach(function (proxy, key) {
			if (_.isEqual(query, proxy)) index = key;
		});

		return index;
	},

	_makeRequest: function ($url, $options, callback) {
		// prepare options
		$options.cookies = $options.cookies && this._cookies ? _.extend({}, this._cookies, $options.cookies) : $options.cookies || _.extend({}, this._cookies);
		$options.headers = $options.headers && this._headers ? _.extend({}, this._headers, $options.headers) : $options.headers || _.extend({}, this._headers);
		$options.timeout = $options.timeout || this._timeout;
		$options.retries = $options.retries || this._retries;
		$options.encoding = $options.encoding || this._encoding;
		$options.didRequestFail = $options.didRequestFail || this._didRequestFail;
		$options.signRequest = $options.signRequest || this._signRequest;
		$options.processResponse = $options.processResponse || this._processResponse;
		$options.dataType = $options.dataType || this._dataType;
		
		if (this._cookiejar) $options.cookiejar = _.extend(this._cookiejar, $options.cookies);
		$options.follow = _.isUndefined($options.follow) ? this._follow : $options.follow;
		$options.followMax = $options.followMax || this._followMax;
		$options.auth = $options.auth || this._auth;
		$options.proxy = this._proxies.length ? this._proxies[this._requestID % this._proxies.length] : null;
		$options.id = this._requestID;

		this._requestID++;

		new Requester(url.parse($url), $options, callback);
	}
};

function Requester ($url, $options, callback) {
	this._callback = callback;
	this._retry = 0;
	this._followCount = 0;
	this._url = $url;

	this._multipart = $options.multipart;
	this._method = $options.method;
	this._cookies = $options.cookies;
	this._headers = $options.headers;
	this._timeout = $options.timeout;
	this._retries = $options.retries;
	this._encoding = $options.encoding;
	this._didRequestFail = $options.didRequestFail;
	this._signRequest = $options.signRequest;
	this._processResponse = $options.processResponse;
	this._dataType = $options.dataType;

	this._cookiejar = $options.cookiejar;
	this._follow = $options.follow;
	this._followMax = $options.followMax;
	this._proxy = $options.proxy;
	this._data = $options.data;
	this._protocol = $url.protocol === 'https:' && !this._proxy ? https : http;
	this._port = $url.protocol === 'https:' && this._proxy ? 443 : 80;

	this._auth = this._proxy && this._proxy.auth ? this._proxy.auth : $options.auth;
	this._queryString = this._signRequest && this._method === 'POST' ? this._signRequest(this._data) : this._data ? qs.stringify(this._data) : '';

	this._attempt = this._attempt.bind(this);
	this._prepareHttpOptions();
}

Requester.prototype = {
	_prepareHttpOptions: function () {
		var self = this;

		if (!this._headers.cookie && !this._headers.Cookie && this._cookies) this._headers.cookie = this._stringifyCookies(this._cookiejar || this._cookies);
		if (this._auth) this._headers[this._proxy ? 'Proxy-Authorization' : 'Authorization'] = 'Basic ' + new Buffer(this._auth.username + ':' + this._auth.password).toString('base64');

		if (this._multipart) {
			this._prepareFormData(function () {
				self._attempt();
			});
		} else {
			if (this._method === 'POST') {
				if (!this._headers['content-type']) this._headers['content-type'] = 'application/x-www-form-urlencoded';
				this._headers['content-length'] = this._queryString ? this._queryString.length : 0;
			} else if (this._data && this._method === 'GET') {
				this._url.search = this._url.search ? this._url.search + '&' + this._queryString : '?' + this._queryString;
			}

			this._attempt();
		}
	},

	_prepareFormData: function (callback) {
		var files = [],
			self = this;

		this._formData = new FormData();

		for (var key in this._data) {
			if (key.substr(0,1) === '@') {
				files.push([key.substr(1), this._data[key]]);
			} else {
				this._formData.append(key, this._data[key]);
			}
		}

		async.forEach(
			files,
			function (file, callback) {
				fs.readFile(file[1], function (err, data) {
					if (err) throw err;
					self._formData.append(file[0], data);
					callback();
				});
			},
			function () {
				self._headers = _.extend(self._headers, self._formData.getCustomHeaders());
				callback();
			}
		);
	},

	_attempt: function () {
		this._retry++;
		this._prepareRequestObject();

		if (this._formData) {
			this._formData.pipe(this._requestObject);
		} else {
			if (this._method === 'POST') {
				this._requestObject.write(this._queryString);
			}
			this._requestObject.end();
		}
	},

	_prepareRequestObject: function () {
		var self = this;
		
		this._requestObject = this._protocol.request(
			{
				host: this._proxy ? this._proxy.ip : this._url.hostname,
				port: this._proxy ? this._proxy.port : this._url.port,
				path: this._proxy ? url.format(this._url) : this._url.pathname + (this._url.search || ''),
				method: this._method,
				headers: this._headers
			},
			function (response) {
				if (response.headers['content-encoding'] === 'gzip') {
					self._gzipResponse(response);
				} else {
					self._normalResponse(response);
				}
			}
		);

		this._requestObject.setTimeout(this._timeout, function () {
			self._requestObject.destroy();
			self._requestObject = null;
			self._requestFailed(null);
		});

		this._requestObject.on('error', function(e) {
			console.log('problem with request: ' + e.message);
		});
	},

	_requestFailed: function (response) {
		if (this._retries > this._retry) {
			this._attempt();
		} else {
			this._callback.call(response, null);
		}
	},

	_normalResponse: function (response) {
		var self = this,
			data = '';
		
		response.setEncoding(this._encoding);

		response.on('data', function (chunk) {
			data += chunk;
		});
		
		response.on('end', function () {
			response.parsedUrl = self._url;
			response.proxy = self._proxy;

			response.body = data;
			self._checkResponse(response);
		});
	},

	_gzipResponse: function (response) {
		var self = this,
			data = '',
			gunzip = zlib.createGunzip();
		
		response.setEncoding('binary');

		gunzip = zlib.createGunzip();

		gunzip.on('data', function(chunk) {
			data += chunk;
		});

		gunzip.on('end', function () {
			response.body = data;
			self._checkResponse(response);
		});

		response.on('data', function (chunk) {
			gunzip.write(new Buffer(chunk, 'binary'));
		});
		
		response.on('end', function () {
			response.parsedUrl = self._url;
			response.proxy = self._proxy;

			gunzip.end();
		});
	},

	_checkResponse: function (response) {
		var self = this;

		response.cookies = {};
		if (response.headers['set-cookie']) {
			response.headers['set-cookie'].forEach(function (value) {
				response.cookies = _.extend(response.cookies, this._parseCookies(value));
			}, this);
		}
		if (this._cookiejar) this._cookiejar = _.extend(this._cookiejar, response.cookies);

		if (this._follow && this._followCount <= this._followMax && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
			this._url = url.parse(response.headers.location);
			this._followCount++;
			this._attempt();
			return;
		}

		if (this._processResponse) response.body = this._processResponse.call(response, response.body);

		if (this._dataType === 'JSON') {
			var json;
			try {
				json = JSON.parse(response.body);
			} catch (e) {}

			if (json) {
				if (this._didRequestFail && !this._didRequestFail(json) || !this._didRequestFail) {
					this._callback.call(response, json);
				} else {
					this._requestFailed(response);
				}
			} else {
				this._requestFailed(response);
			}
		} else if (this._dataType === 'XML') {
			var parser = new xml2js.Parser();
			parser.parseString(response.body, function (error, xml) {
				if (error) {
					self._requestFailed(response);
				} else {
					self._callback.call(response, xml);
				}
			});
		} else {
			if (this._didRequestFail && !this._didRequestFail(response.body) || !this._didRequestFail) {
				this._callback.call(response, response.body);
			} else {
				this._requestFailed(response);
			}
		}
	},

	_stringifyCookies: function (cookies) {
		var string = '';
		for (var cookie in cookies) string += cookie + '=' + cookies[cookie] + '; ';
		return string.slice(0,-2);
	},

	_parseCookies: function (string) {
		var cookies = {};
		string.split('; ').forEach(function (value) {
			var parts = value.split('=');
			if (!parts[0].match(/domain|path|expires|secure|httponly/i)) cookies[parts[0]] = parts[1] || '';
		});

		return cookies;
	}
};

module.exports = exports = RequesterHandler;