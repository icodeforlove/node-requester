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
	EventsMixin = require('promise-object/mixins/events'),
	Requester = require('./Requester');

var RequesterHandler = PromiseObject.create(EventsMixin, {
	initialize: function ($config) {
		this._debug = $config.debug;
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
	},

	post: function ($url, $options, callback) {
		$options = $options || {};

		if (arguments.length === 2 && typeof arguments[1] === 'function') {
			callback = arguments[1];
		}

		if (!$options.method) $options.method = 'POST';
		return this._makeRequest($url, $options, callback);
	},

	put: function ($url, $options, callback) {
		$options = $options || {};

		if (arguments.length === 2 && typeof arguments[1] === 'function') {
			callback = arguments[1];
		}

		if (!$options.method) $options.method = 'PUT';
		return this._makeRequest($url, $options, callback);
	},

	get: function ($url, $options, callback) {
		$options = $options || {};

		if (arguments.length === 2 && typeof arguments[1] === 'function') {
			callback = arguments[1];
		}

		if (!$options.method) $options.method = 'GET';
		return this._makeRequest($url, $options, callback);
	},

	del: function ($url, $options, callback) {
		$options = $options || {};

		if (arguments.length === 2 && typeof arguments[1] === 'function') {
			callback = arguments[1];
		}

		if (!$options.method) $options.method = 'DELETE';
		return this._makeRequest($url, $options, callback);
	},

	addProxies: function () {
		for (var proxy = 0; proxy < arguments.length; proxy++) {
			if (this._proxyCheck(arguments[proxy]) === -1) {
				this._proxies.push(arguments[proxy]);
			}
		}
	},

	multipart: function ($url, $options, callback) {
		$options.multipart = true;
		return this.post($url, $options, callback);
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

	_makeRequest: function ($deferred, $url, $options, callback) {
		// prepare options
		$options.debug = $options.debug || this._debug;
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
		$options.proxy = this._proxies.length && _.isUndefined($options.proxy) ? this._proxies[this._requestID % this._proxies.length] : $options.proxy;
		$options.id = this._requestID;
		$options.handler = this;

		this._requestID++;

		return new Requester(url.parse($url), $options, function (body) {
			if (callback) {
				callback.call(this, body);
			} else {
				if (body === null) {
					$deferred.reject();
				} else {
					$deferred.resolve({body: body, request: this});
				}
			}
		});
	}
});

module.exports = RequesterHandler;