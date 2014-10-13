var http = require('http'),
	https = require('https'),
	url = require('url'),
	qs = require('qs'),
	FormData = require('form-data'),
	fs = require('fs'),
	xml2js = require('xml2js'),
	async = require('async'),
	zlib = require('zlib'),
	_ = require('underscore'),
	colors = require('colors'),
	Promise = require('bluebird'),
	PromiseObject = require('promise-object')(Promise),
	EventsMixin = require('promise-object/mixins/events');

var Requester = PromiseObject.create(EventsMixin, {
	initialize: function ($url, $options, callback) {
		this._callback = callback;
		this._retry = 0;
		this._followCount = 0;
		this._url = $url;
		this._handler = $options.handler;

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
		this._debug = $options.debug;
		this._data = $options.data;
		this._protocol = $url.protocol === 'https:' && !this._proxy ? https : http;
		this._port = $url.protocol === 'https:' && this._proxy ? 443 : 80;

		this._auth = this._proxy && this._proxy.auth ? this._proxy.auth : $options.auth;

		if (_.isObject(this._data) && this._headers['content-type'] === 'application/json') {
			this._queryString = JSON.stringify(this._data);
		} else {
			this._queryString = this._signRequest && this._method !== 'GET' ? this._signRequest(this._data) : this._data ? qs.stringify(this._data) : '';
		}

		this._attempt = this._attempt.bind(this);
		this._prepareHttpOptions();
	},

	_prepareHttpOptions: function () {
		var self = this;

		if (!this._headers.cookie && !this._headers.Cookie && this._cookies) this._headers.cookie = this._stringifyCookies(this._cookiejar || this._cookies);
		if (this._auth) this._headers[this._proxy ? 'Proxy-Authorization' : 'Authorization'] = 'Basic ' + new Buffer(this._auth.username + ':' + this._auth.password).toString('base64');

		if (this._multipart) {
			this._prepareFormData(function () {
				self._attempt();
			});
		} else {
			if (this._method === 'GET' && this._data) {
				this._url.search = this._url.search ? this._url.search + '&' + this._queryString : '?' + this._queryString;
			} else if (this._method !== 'GET' && this._data) {
				if (!this._headers['content-type']) this._headers['content-type'] = 'application/x-www-form-urlencoded';
				this._headers['content-length'] = this._queryString ? this._queryString.length : 0;
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
				this._formData.append(key.substr(1), fs.createReadStream(this._data[key]));
			} else {
				this._formData.append(key, this._data[key]);
			}
		}

		this._formData.getLength(function (error, length) {
			self._headers = _.extend(self._headers, self._formData.getHeaders({'Content-Length': length}));
			callback();
		});
	},

	_attempt: function () {
		this._retry++;
		this._prepareRequestObject();

		if (this._formData) {
			this._formData.pipe(this._requestObject);
		} else {
			if (this._method !== 'GET') {
				if (this._debug > 1 && this._data) console.log(JSON.stringify(this._data, null, '\t').grey);
				this._requestObject.write(this._queryString);
			}
			this._requestObject.end();
		}
	},

	_toCapitalizedString: function (string) {
		return string.replace(/\b(\w)/g, function (firstLetter) { return firstLetter.toUpperCase()});
	},

	_prepareRequestObject: function () {
		var self = this;

		// strip cookie if we dont have one
		if (!this._headers.cookie) delete this._headers.cookie;

		var headers = {};
		for (var i in this._headers) headers[this._toCapitalizedString(i)] = this._headers[i];

		var options = {
			host: this._proxy ? this._proxy.ip : this._url.hostname,
			port: this._proxy ? this._proxy.port : this._url.port,
			path: this._proxy ? url.format(this._url) : this._url.pathname + (this._url.search || ''),
			method: this._method,
			headers: headers
		};

		if (this._debug > 0) console.log(this._method.grey + ' ' + url.format(this._url));
		if (this._debug > 1) console.log(JSON.stringify(headers, null, '\t').grey);

		this._requestObject = this._protocol.request(
			options,
			function (response) {
				if (!self._encoding && response.headers['content-encoding'] === 'gzip') {
					self._gzipResponse(response);
				} else {
					self._normalResponse(response);
				}
			}
		);

		this._requestObject.setTimeout(this._timeout, function () {
			if (self._debug > 0) console.log('FAILED '.red + self._method.grey + ' ' + url.format(self._url) + (' (' + 'timeout' + ')').red);
			self._requestFailed(null);
		});

		this._requestObject.on('error', function(e) {
			if (self._debug > 0) console.log('FAILED '.red + self._method.grey + ' ' + url.format(self._url) + (' (' + e.message + ')').red);
			self._requestFailed(null);
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

		if (this._debug > 1) {
			console.log(this._method.grey + ' RESPONSE '.grey + String(response.statusCode).red + ' ' + url.format(this._url) + ' - '.grey + String((response.connection.bytesRead / 1024).toFixed(2) + 'kb').grey);
			console.log(JSON.stringify(response.headers, null, '\t').grey);
			if (this._debug > 2) console.log(response.body.grey);
		}

		response.cookies = {};
		if (response.headers['set-cookie']) {
			response.headers['set-cookie'].forEach(function (value) {
				response.cookies = _.extend(response.cookies, this._parseCookies(value));
			}, this);
		}
		if (this._cookiejar) this._cookiejar = _.extend(this._cookiejar, response.cookies);

		if (this._follow && this._followCount <= this._followMax && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
			var location = url.parse(response.headers.location);
			if (!location.hostname) location.hostname = this._url.hostname;
			if (!location.port) location.port = this._url.port;
			if (!location.protocol) location.protocol = this._url.protocol;
			this._handler.get(url.format(location), this._callback);
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
					this.dispatchEvent('response-recieved', {data: json});
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
					self.dispatchEvent('response-recieved', {data: xml});
					self._callback.call(response, xml);
				}
			});
		} else {
			if (this._didRequestFail && !this._didRequestFail(response.body) || !this._didRequestFail) {
				this.dispatchEvent('response-recieved', {data: response.body});
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
});

module.exports = Requester;