var Model, ModelWithoutID;
var attr = Ember.attr;

module("Ember.Model", {
  setup: function() {
    Model = Ember.Model.extend({
      token: Ember.attr(),
      name: Ember.attr()
    });
    Model.primaryKey = 'token';
    Model.adapter = Ember.FixtureAdapter.create();
    Model.FIXTURES = [
      {token: 'a', name: 'Erik'}
    ];
    ModelWithoutID = Model.extend();
    ModelWithoutID.adapter = Ember.FixtureAdapter.create();
    ModelWithoutID.FIXTURES = [
      {name: 'Erik'},
      {name: 'Alex'}
    ];
  },
  teardown: function() {

  }
});

test("Test partial attributes", function(){
	var Post = Ember.Model.extend({
		id: attr(),
		title: attr(),
		body: attr()
	});

	var PartialPost = Post.partial(['title']);

	deepEqual(Post.getAttributes(), ['id', 'title', 'body']);
	deepEqual(PartialPost.getAttributes().sort(), ['id', 'title'].sort());
});
