var statistika = angular.module('statistika', ['ui.sortable', 'ui.if']);
var persist = statistika.persist = new Persist.Store('Statistika');


function Header(variables){
  this.variables = $.map(variables, function(value){ return new Variable(value); });
  this.length = variables.length;
}

Header.create = function(object) {
  var header = Object.create(Header.prototype);
  header.variables = object.variables.map(Variable.create);
  header.length = object.length;
  return header;
};

function Variable(name) {
  this.name = name;
}

Variable.create = function(object) {
  var variable = Object.create(Variable.prototype);
  variable.name = object.name;
  variable.description = object.description;
  variable.scale = object.scale;
  return variable;
};

function Scale(key, description) {
  this.key = key;
  this.description = description;
  Scale.repo[key] = this;
}

Scale.find = function(name) {
  return Scale.repo[name];
};

Scale.repo = {};

function Column(value) {
  this.value = value;
}

Column.create = function(object) {
  var column = Object.create(Column.prototype);
  column.value = object.value;
  return column;
};

function Row(columns){
  // Array.map skips undefined elements
  this.columns = $.map(columns, function(value){ return new Column(value); });
  this.length = columns.length;
}

Row.create = function(object) {
  var row = Object.create(Row.prototype);
  row.length = object.length;
  row.columns = object.columns.map(Column.create);
  return row;
};

function modelChanged(callback) {
  return function(newVal, oldVal) {
    if(angular.equals(newVal, oldVal))
      return;

    callback.call(newVal, oldVal);
  };
}

function Store(name, filter) {
  return modelChanged(function(newVal){
    if(filter) {
      newVal = newVal.filter(filter);
    }

    persist.set(name, JSON.stringify(newVal));
  });
}

Store.keys = [];

Store.get = function($scope, name, transform) {
  var persisted = persist.get(name);

  if(persisted) {
    persisted = JSON.parse(persisted);
    persisted = transform(persisted);
  } else {
    persisted = null;
  }

  return persisted;
};

Store.setup = function($scope, name, filter) {
  Store.keys.push(name);
  $scope.$watch(name, Store(name, filter), true);
};

Store.clear = function() {
  Store.keys.forEach(function(key) {
    persist.remove(key);
  });
};

function MainCtrl($scope) {
  $scope.columns = function() {
    return $scope.header.length;
  };

  $scope.newRow = function(){
    var columns = new Array($scope.columns());
    return new Row(columns);
  };

  Store.setup($scope, 'header');
  Store.setup($scope, 'rows');

  $scope.header = Store.get($scope, 'header', Header.create) || new Header(['first', 'second']);
  $scope.rows = Store.get($scope, 'rows', function(rows) { return rows.map(Row.create); }) || [$scope.newRow()];

  $scope.variables = $scope.header.variables;

  $scope.reset = function(){
    if(confirm("Opravdu vymazat všechna uložená data?")) {
      Store.clear();
      window.location.reload();
    }
  };
}

function VariablesCtrl($scope){
  $scope.scales = [
    new Scale("nominal", "nominální"),
    new Scale("ordinal", "ordinální"),
    new Scale("quantitative", "kvantitativní metrická"),
    new Scale("absolute", "absolutní metrická")
  ];
}

function DataCtrl($scope) {
  var orderedBy, reversed, sorted;


  $scope.unsorted = function(){
    if(sorted){
      sorted = false;
      return;
    }

    orderedBy = null;
    reversed = null;
  };

  $scope.$watch('rows', $scope.unsorted);

  $scope.removeRow = function(row) {
    var index = $scope.rows.indexOf(row);
    $scope.rows.splice(index, 1);
  };

  $scope.addRow = function(){
    $scope.rows.push($scope.newRow());
    $scope.unsorted();
  };

  $scope.updatePosition = function(from, to) {
    var elements = $scope.rows.splice(from, 1);
    $scope.rows.splice(to, 0, elements[0]);
  };

  $scope.addVariable = function() {
    $scope.variables.push(new Variable());
  };

  $scope.orderBy = function(variable) {
    var column = $scope.variables.indexOf(variable);

    $scope.rows = _($scope.rows).sortBy(function(row) { return row.columns[column].value; });

    // cleanup old state
    if(orderedBy) { delete orderedBy.order; }

    if(orderedBy === variable) {
      if(!reversed) {
        $scope.rows.reverse();
      }
      reversed = !reversed;
    } else {
      orderedBy = variable;
      reversed = null;
    }

    variable.order = reversed ? 'desc' : 'asc';
    sorted = true;
  };

  $scope.sortableOptions = {
    items: 'tr',
    helper: 'clone',
    axis: 'y',
    start: function(event, ui) {
      ui.item.oldIndex = ui.item.index();
    },
    update: function(event, ui) {
      $scope.$apply(function() {
        $scope.updatePosition(ui.item.oldIndex, ui.item.index());
      });
    }
  };
}
