var statistika = angular.module('statistika', []);

function BinomalTree(n, S, X, U, D, r){
  this.S = S;
  this.X = X;
  this.U = U;
  this.D = D;
  this.r = r;

  this.level = 1;
  this.n = n;
  this.name = "C";
  this.ops = [];

  this.description = this.name;
}

BinomalTree.prototype.call = function(){
  var nodes = this.nodes();
  return nodes.reduce(function(sum, n){ return sum + n.value() }, this.value());
}

BinomalTree.prototype.value = function(){
  return this.get('S');
}


BinomalTree.prototype.get = function(name) {
  switch(name){
    case 'u':
      return 1 + this.U;
    case 'd':
      return 1 + this.D;
    default:
      return this[name];
  }
}

BinomalTree.prototype.children = function(){
  return [new CallOpce('u', this), new CallOpce('d', this) ];
}

BinomalTree.prototype.nodes = function(){
  return _
    .chain(this.children())
    .map(function(node){ return node.nodes(); })
    .flatten()
    .uniq(function(node){ return node.name; })
    .value();
}

BinomalTree.prototype.edges = function(nodes) {
  return _
    .chain(nodes)
    .map(function(node){
      return node.children().map(function(child){
        return [node.name, child.name];
      });
    })
    .flatten(true)
    .uniq()
    .value();
}

BinomalTree.prototype.toJSON = function(){
  var nodes = this.nodes();
  nodes.unshift(this);
  var edges = this.edges(nodes);

  return {
    "nodes": nodes.map(function(node){ return node.name; }),
    "edges": edges
  }
}

function CallOpce(op, parent){
  var self = this;
  var ops;

  this.level = parent.level + 1;
  this.n = parent.n;

  ops = this.ops = parent.ops.slice(0);
  ops.push(op);

  this.op = op;
  this.name = 'C' + ops.sort().join('');
  this.value = function() {
    return parent.get(op) * parent.value();
  }

  this.get = function(name){
    return parent.get(name);
  }

  this.diff = function() {
    return Math.max(0, self.value() - parent.get('X'));
  }
}

CallOpce.prototype.children = function(){
  if(this.level <= this.get('n')) {
    return [new CallOpce('u', this), new CallOpce('d', this)];
  } else {
    return [];
  }
}

CallOpce.prototype.inner = function(){
  return this.get(this.op) * this.value();
}


CallOpce.prototype.nodes = function() {
  return [this, this.children().map(function(node){ return node.nodes() })];
}

function BinomalCtrl($scope){

  $scope.tree = new BinomalTree(4, 1100, 1050, 0.1, -0.04);

  $scope.$watch('tree', function(tree){
    $scope.graph = new Springy.Graph();
    $scope.graph.loadJSON(tree.toJSON());
    $('#viz').springy({graph: $scope.graph});
  }, true);

  $scope.$watch('tree.call()', function(call) {
    $scope.call = call;
  });
}
