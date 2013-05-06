var statistika = angular.module('statistika', ['ui.sortable', 'ui.if']);
var persist = statistika.persist = new Persist.Store('Statistika');

statistika.factory('$exceptionHandler', function ($log) {
  var reset = Store.reset("Bohužel vaše uložená data nejsou kompatabilní s novou verzí. Chcete je smazat?");
  var log = $log.error;

  return function(error, cause) {
    // does not work right now :(
    // _errs.push(error);

    (window.location.hostname == 'localhost' ? log : reset).apply(log, arguments);
  };
});

statistika.filter('decimal', function() {
  var DEFAULT_PLACES = 2;
  return function(rational, places) {
    if(!places)
      places = DEFAULT_PLACES;

    return rational.toDecimal(places);
  }
});

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
  this.groups = [];
  this.order = [];
}

Variable.prototype.nominal = function(column) {
  return _(column).uniq();
};

Variable.prototype.ordinal = function(column) {
  var order = this.order;
  var ordinal = _(column).sortBy(function(value) {
    var i; return (i = order.indexOf(value)) == -1 ? undefined : i;
  });

  this.order = _(ordinal).uniq();
  return this.order;
};

Variable.prototype.absolute = Variable.prototype.quantitative = function(index, rows) {
  return this.groups;
};

Variable.prototype.matching = function() {
  switch(this.scale) {
    case 'absolute':
    case 'quantitative':
      return function(group, value) {
        return group.min <= value && value < group.max;
      };

    case 'nominal':
    case 'ordinal':
      return function(group, value) {
        return value == group;
      };

    default:
      throw new Error('unknown scale: ' + this.scale);
  };
};

Variable.prototype.filter = function(group){
  return _(this.matching()).partial(group);
};

Variable.prototype.group = function(column){
  return this.scale ? this[this.scale](column) : [];
}

Variable.create = function(object) {
  var variable = Object.create(Variable.prototype);
  variable.name = object.name;
  variable.description = object.description;
  variable.scale = object.scale;
  variable.order = object.order || [];
  variable.groups = object.groups.map(Group.create);
  return variable;
};

function Group(scale, min, max) {
  this.scale = scale;
  this.min = min;
  this.max = max;
}

Group.create = function(object) {
  var group = Object.create(Group.prototype);
  group.scale = object.scale;
  group.min = object.min;
  group.max = object.max;
  return group;
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
  return function(newVal){
    if(filter) {
      newVal = newVal.filter(filter);
    }

    persist.set(name, JSON.stringify(newVal));
  };
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

Store.reset = function(msg) {
  return function(){
    if(confirm(msg)) {
      Store.clear();
      window.location.reload();
    }
  };
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

  $scope.reset = Store.reset("Opravdu vymazat všechna uložená data?");

  $scope.scales = [
    new Scale("nominal", "nominální"),
    new Scale("ordinal", "ordinální"),
    new Scale("quantitative", "kvantitativní metrická"),
    new Scale("absolute", "absolutní metrická")
  ];

  $scope.column = function(variable){
    var index = $scope.variables.indexOf(variable);
    if(index == -1) {
      return;
    }

    return $scope.rows.map(function(row) { return row.columns[index].value; });
  }
}

function VariableCtrl($scope){
  var variable = $scope.variable;
  var column = $scope.column(variable);

  $scope.groups = variable.group(column);

  $scope.addGroup = function() {
    variable.groups.push(new Group(variable.scale));
  };

  $scope.removeGroup = function(group) {
    var index = variable.groups.indexOf(group);
    variable.groups.splice(index, 1);
  };

  $scope.canAddGroup = function() {
    return variable.scale === "absolute" || variable.scale === "quantitative";
  };

  $scope.ordinalOptions = function() {
    var options = {
      items: 'li',
      helper: 'clone',
      axis: 'y',
      // using bind to set $scope as in the function there is no closure?!
      update: function(event, ui) {
        var items = $(event.target).find(options.items);
        $scope.$apply(function(){
          var groups = _(items).map(function(item) { return $(item).text().trim(); });
          variable.order = _(groups).uniq();
        });
      }
    };
    return options;
  };
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
    if(orderedBy) { delete orderedBy.sort; }

    if(orderedBy === variable) {
      if(!reversed) {
        $scope.rows.reverse();
      }
      reversed = !reversed;
    } else {
      orderedBy = variable;
      reversed = null;
    }

    variable.sort = reversed ? 'desc' : 'asc';
    sorted = true;
  };

  $scope.sortableOptions = {
    // containment: 'table', // prevents from moving to last position
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

function Element(variable, elements, group, column) {
  var matching = variable.filter(group);
  //var groups = variable.group(column);
  var all = rational.fromInteger(column.length);
  var values = column.filter(matching);
  var absolute = rational.fromInteger(values.length);
  var relative = absolute.divide(all);
  var cumulative = elements.reduce(function(sum, element){ return sum.add(element.relative); }, relative);

  this.index = elements.length;
  this.group = group;
  this.values = values;
  this.absolute = absolute;
  this.relative = relative;
  this.cumulative = cumulative;
}

Element.prototype.moment = function(order){
  var base = rational.fromInteger(this.index + 1).power(order);
  return base.times(this.absolute);
}

function TableCtrl($scope) {
  var getElements = function(variable){
    var elements = [];
    var column = $scope.column(variable);
    var groups = variable.group(column)

    groups.forEach(function(group){
      elements.push(new Element(variable, elements, group, column));
    });

    $scope.elements = elements;
  };

  $scope.$watch('variable', getElements, true);
  $scope.$watch('column(variable)', _(getElements).partial($scope.variable), true);
}
