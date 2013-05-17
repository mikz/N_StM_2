var statistika = angular.module('statistika', []);

function BinomalTree(n, S, X, U, D, r){
  this.S = S;
  this.X = X;
  this.U = U;
  this.D = D;
  this.r = r;

  this.u = 1 + U;
  this.d = 1 + D;

  this.level = 1;
  this.n = n;
  this.name = "C";
  this.ops = [];

  this.value = function() { return S; }

  this.description = this.name;
}

BinomalTree.prototype.get = function(name) {
  return this[name];
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

  this.name = 'C' + ops.sort().join('');
  this.value = function() {
    return parent[op] * parent.value();
  }

  this.get = function(name){
    return parent[name];
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
}