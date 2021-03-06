require('ember-model/computed');
var get = Ember.get;

function getType(record) {
  var type = this.type;

  if (typeof this.type === "string" && this.type) {
    this.type = get(Ember.lookup, this.type);

    if (!this.type) {
      var store = record.container.lookup('store:main');
      this.type = store.modelFor(type);
      this.type.reopenClass({ adapter: store.adapterFor(type) });
    }
  }

  return this.type;
}

Ember.hasMany = function(type, options) {
  options = options || {};

  var meta = { type: type, isRelationship: true, options: options, kind: 'hasMany', getType: getType};

  return Ember.Model.computed({
    get: function(propertyKey) {
      type = meta.getType(this);
      Ember.assert("Type cannot be empty", !Ember.isEmpty(type));

      var key = options.key || propertyKey;
      return this.getHasMany(key, type, meta, this.container);
    },
    set: function(propertyKey, newContentArray, existingArray) {
      type = meta.getType(this);
      var key = options.key || propertyKey;
      if (!existingArray) {
        existingArray = this.getHasMany(key, type, meta, this.container);
      }
      return existingArray.setObjects(newContentArray);
    }
  }).meta(meta);
};

Ember.Model.reopen({
  getHasMany: function(key, type, meta, container) {
    var embedded = meta.options.embedded,
        collectionClass = embedded ? Ember.EmbeddedHasManyArray : Ember.HasManyArray;

    var content = this._getHasManyContent(key, type, embedded);
    var collection = collectionClass.create({
      parent: this,
      modelClass: type,
      content: content,
      embedded: embedded,
      key: key,
      relationshipKey: meta.relationshipKey,
      container: container
    });

    this._registerHasManyArray(collection);

    if (!content || content.length === 0) {
      collection.notifyLoaded();
    }

    return collection;
  }
});
