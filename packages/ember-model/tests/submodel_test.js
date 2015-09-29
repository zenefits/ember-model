var Model, SubModel;
var attr = Ember.attr;

module("Ember.Model", {
  setup: function() {
    Model = Ember.Model.extend({
      id: attr(),
      title: attr(),
      body: attr()
    });
    Model.adapter = Ember.FixtureAdapter.create();
    Model.FIXTURES = [];

    SubModel = Model.sub(['title']);
    SubModel.FIXTURES = [];
  },
  teardown: function() {

  }
});

test("Test sub attributes", function(){
	deepEqual(Model.getAttributes(), ['id', 'title', 'body']);
	deepEqual(SubModel.getAttributes().sort(), ['id', 'title'].sort());
});

test("Test full() tracking", function() {
  strictEqual(Model.full(), Model, "A full model's full model is itself.");
  strictEqual(SubModel.full(), Model, "A sub model's full model is its root");
});

test("Shared reference cache and clientId", function() {
  Model.create({
    id: 1,
    title: "Test",
    body: "Test",
  });
  var subRecord = SubModel.getCachedReferenceRecord(1),
      fullRecord = Model.getCachedReferenceRecord(1);
  strictEqual(subRecord, fullRecord);
});
