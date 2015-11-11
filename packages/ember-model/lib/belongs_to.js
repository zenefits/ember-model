require('ember-model/computed');
var get = Ember.get,
    set = Ember.set;

function storeFor(record) {
  return record.getStore();
}

function getType(record) {
  var type = this.type;

  if (typeof this.type === "string" && this.type) {
    type = Ember.get(Ember.lookup, this.type);

    if (!type) {
      var store = storeFor(record);
      type = store.modelFor(this.type);
      type.reopenClass({ adapter: store.adapterFor(this.type) });
    }
  }

  return type;
}


var getInverseKeyFor = function(obj, type, lookForType) {
  var relKeys = type.getRelationships();
  for (var i = 0, l = relKeys.length; i < l; i++) {
    var key = relKeys[i];
    var rel = type.metaForProperty(key);
    // TODO do we want to reverse hasMany's and belongsTo simulatiously?
    // TODO complain when we can't decide automatically?
    var childType = rel.getType(obj);
    if (childType === lookForType) return key;
  }
  return null;
};

var getInverseKindFor = function(obj, type, lookForKey) {
  var relKeys = type.getRelationships();
  for (var i = 0, l = relKeys.length; i < l; i++) {
    var key = relKeys[i];
    if (lookForKey !== key) continue;
    var rel = type.metaForProperty(key);
    return rel.kind;
  }
  return null;
};

Ember.belongsTo = function(type, options) {
  options = options || {};

  var meta = { type: type, isRelationship: true, options: options, kind: 'belongsTo', getType: getType};
  var inverseKey;
  var inverseKind;

  return Ember.Model.computed("_data", {
    get: function(propertyKey){
      if (this.isDeferredKey(propertyKey)) {
        return this._reloadAndGet(propertyKey);
      }

      type = meta.getType(this);
      Ember.assert("Type cannot be empty.", !Ember.isEmpty(type));


      var key; 
      if(this.constructor.useBelongsToImplicitKey) {
        key = options.key || propertyKey + '_id';
      } else {
        key = options.key || propertyKey;
      }
      
      var self = this;

      var dirtyChanged = function(sender) {
        if (sender.get('isModified')) {
          self._relationshipBecameDirty(propertyKey);
        } else {
          self._relationshipBecameClean(propertyKey);
        }
      };

      var store = storeFor(this),
          value = this.getBelongsTo(key, type, meta, store);
      this._registerBelongsTo(meta);
      if (value !== null && meta.options.embedded) {
        value.get('isModified'); // getter must be called before adding observer
        value.addObserver('isModified', dirtyChanged);
      }

      if (value == null) {
        var shadow = this.get('_shadow.' + propertyKey);
        if (shadow !== undefined) {
          return shadow;
        }
      }

      return value;
    },

    set: function(propertyKey, value, oldValue){
      type = meta.getType(this);
      Ember.assert("Type cannot be empty.", !Ember.isEmpty(type));

      var key; 
      if(this.constructor.useBelongsToImplicitKey) {
        key = options.key || propertyKey + '_id';
      } else {
        key = options.key || propertyKey;
      }

      

      if(this.get('isNew') && value) {
        if (inverseKey === undefined) {
          if (options.inverse !== undefined) {
            inverseKey = options.inverse;
          } else {
            inverseKey = getInverseKeyFor(this, type, this.constructor);
          }

          if (inverseKey) {
            inverseKind = getInverseKindFor(this, type, inverseKey);
          }
        }


        if (inverseKey && inverseKind === 'hasMany') {
          var hasMany = value.get(inverseKey);
          hasMany.pushShadowObject(this);
        }

        if (inverseKey && inverseKind === 'belongsTo') {
          value.set('_shadow.' + inverseKey, this);
        }
      }

      var dirtyAttributes = get(this, '_dirtyAttributes'),
          createdDirtyAttributes = false,
          self = this;

      var dirtyChanged = function(sender) {
        if (sender.get('isModified')) {
          self._relationshipBecameDirty(propertyKey);
        } else {
          self._relationshipBecameClean(propertyKey);
        }
      };

      if (!dirtyAttributes) {
        dirtyAttributes = [];
        createdDirtyAttributes = true;
      }

      if (value) {
        Ember.assert(Ember.String.fmt('Attempted to set property of type: %@ with a value of type: %@',
                    [value.constructor, type]),
                    value instanceof type);
      }

      if (oldValue !== value) {
        dirtyAttributes.pushObject(propertyKey);
      } else {
        dirtyAttributes.removeObject(propertyKey);
      }

      if (createdDirtyAttributes) {
        set(this, '_dirtyAttributes', dirtyAttributes);
      }

      if (meta.options.embedded) {
        if (oldValue) {
          oldValue.removeObserver('isModified', dirtyChanged);
        }
        if (value) {
          value.addObserver('isModified', dirtyChanged);
        }
      }

      return value === undefined ? null : value;
    }
  }).meta(meta);
};

Ember.Model.reopen({
  getBelongsTo: function(key, type, meta, store, subgraph) {
    var idOrAttrs = get(this, '_data.' + key),
        record;

    if (Ember.isNone(idOrAttrs)) {
      return null;
    }

    if (meta.options.embedded) {
      var primaryKey = get(type, 'primaryKey'),
        id = idOrAttrs[primaryKey];
      record = type.create({ isLoaded: false, id: id, container: this.container });
      record.load(id, idOrAttrs);
    } else {
      if (store) {
        record = store._findSync(meta.type, idOrAttrs, subgraph);
      } else {
        record = type.find(idOrAttrs, subgraph);
      }
    }

    return record;
  }
});
