require('ember-model/adapter');

var get = Ember.get;

Ember.RESTAdapter = Ember.Adapter.extend({
  find: function(record, id) {
    var url = this.buildURL(record.constructor, id),
        self = this;

    return this.ajax(url).then(function(data) {
      self.didFind(record, id, data);
      return record;
    });
  },

  didFind: function(record, id, data) {
    var rootKey = get(record.constructor, 'rootKey'),
        dataToLoad = rootKey ? get(data, rootKey) : data;

    record.load(id, dataToLoad);
  },

  findAll: function(klass, records) {
    var url = this.buildURL(klass),
        self = this;

    return this.ajax(url).then(function(data) {
      self.didFindAll(klass, records, data);
      return records;
    });
  },

  didFindAll: function(klass, records, data) {
    var collectionKey = get(klass, 'collectionKey'),
        dataToLoad = collectionKey ? get(data, collectionKey) : data;

    records.load(klass, dataToLoad);
  },

  findQuery: function(klass, records, params) {
    var url = this.buildURL(klass),
        self = this;

    return this.ajax(url, params).then(function(data) {
      self.didFindQuery(klass, records, params, data);
      return records;
    });
  },

  didFindQuery: function(klass, records, params, data) {
      var collectionKey = get(klass, 'collectionKey'),
          dataToLoad = collectionKey ? get(data, collectionKey) : data;

      records.load(klass, dataToLoad);
  },

	_clientRequestId: 0,
	_pendingModRequests: [],
	_pendingModDeferreds: {},
	_pushModRequest: function(url, body, method, noBatch) {
		if (noBatch) {
			return this.ajax(url, body, method);
		}
		var deferred = Ember.RSVP.defer();
		var clientId = this._clientRequestId++;
		var mod = {
			"method": method,
			"url": url,
			"body": body,
			"clientId": clientId,
		};
		this._pendingModRequests.push(mod);
		this._pendingModDeferreds[clientId] = deferred;
		Ember.run.scheduleOnce('save-data', this, this._executeModRequests);
		return deferred.promise;
	},
	_executeModRequests: function() {
		var mods = this._pendingModRequests;
		var deferreds = this._pendingModDeferreds;
		this._pendingModRequests = [];
		this._pendingModDeferreds = {};
		this.ajax("/api/batch", { "requests": mods }, "POST").then(function(data) {
			var results = data.results;
			for (var i = 0, l = results.length; i < l; i++) {
				var result = results[i];
				var deferred = deferreds[result.clientId];
				var status = result.statusCode;
				
				if (status && !(status >= 200 && status < 300 || status === 304)) {
					deferred.reject({ "responseText": JSON.stringify(result.data), "status": status });
				}
				else {
					deferred.resolve(result.data);
				}
			}
		});
	},

  createRecord: function(record) {
    var url = this.buildURL(record.constructor),
        noBatch = get(record.constructor, 'noBatch') || false,
        self = this;

    return this._pushModRequest(url, record.toJSON(), "POST", noBatch).then(function(data) {
      self.didCreateRecord(record, data);
      return record;
    });
  },

  didCreateRecord: function(record, data) {
    this._loadRecordFromData(record, data);
    record.didCreateRecord();
  },

  saveRecord: function(record) {
    var primaryKey = get(record.constructor, 'primaryKey'),
        url = this.buildURL(record.constructor, get(record, primaryKey)),
        noBatch = get(record.constructor, 'noBatch') || false,
        self = this;

    return this._pushModRequest(url, record.toJSON(), "PUT", noBatch).then(function(data) {  // TODO: Some APIs may or may not return data
      self.didSaveRecord(record, data);
      return record;
    });
  },

  didSaveRecord: function(record, data) {
    this._loadRecordFromData(record, data);
    record.didSaveRecord();
  },

  deleteRecord: function(record) {
    var primaryKey = get(record.constructor, 'primaryKey'),
        url = this.buildURL(record.constructor, get(record, primaryKey)),
        noBatch = get(record.constructor, 'noBatch') || false,
        self = this;

    return this._pushModRequest(url, record.toJSON(), "DELETE", noBatch).then(function(data) {  // TODO: Some APIs may or may not return data
      self.didDeleteRecord(record, data);
    });
  },

  didDeleteRecord: function(record, data) {
    record.didDeleteRecord();
  },

  ajax: function(url, params, method, settings) {
    return this._ajax(url, params, (method || "GET"), settings);
  },

  buildURL: function(klass, id) {
    var urlRoot = get(klass, 'url');
    var urlSuffix = get(klass, 'urlSuffix') || '';
    if (!urlRoot) { throw new Error('Ember.RESTAdapter requires a `url` property to be specified'); }

    if (!Ember.isEmpty(id)) {
      return urlRoot + "/" + id + urlSuffix;
    } else {
      return urlRoot + urlSuffix;
    }
  },

  ajaxSettings: function(url, method) {
    return {
      url: url,
      type: method,
      dataType: "json"
    };
  },

  _ajax: function(url, params, method, settings) {
    if (!settings) {
      settings = this.ajaxSettings(url, method);
    }

    return new Ember.RSVP.Promise(function(resolve, reject) {
      if (params) {
        if (method === "GET") {
          settings.data = params;
        } else {
          settings.contentType = "application/json; charset=utf-8";
          settings.data = JSON.stringify(params);
        }
      }

      settings.success = function(json) {
        Ember.run(null, resolve, json);
      };

      settings.error = function(jqXHR, textStatus, errorThrown) {
        // https://github.com/ebryn/ember-model/issues/202
        if (jqXHR && typeof jqXHR === 'object') {
          jqXHR.then = null;
        }

        Ember.run(null, reject, jqXHR);
      };


      Ember.$.ajax(settings);
   });
  },

  _loadRecordFromData: function(record, data) {
    var rootKey = get(record.constructor, 'rootKey'),
        primaryKey = get(record.constructor, 'primaryKey');
    // handle HEAD response where no data is provided by server
    if (data) {
      data = rootKey ? get(data, rootKey) : data;
      if (!Ember.isEmpty(data)) {
        record.load(data[primaryKey], data);
      }
    }
  }
});
