var statistika = angular.module('statistika', ['ui.sortable', 'ui.if']);
var persist = statistika.persist = new Persist.Store('Statistika');

rational.prototype.sqrt = function() { var b=rat.create(); rat.sqrt(b, this.a); return new rational(b[0], b[1]); }
var one = rational.fromInteger(1);
var zero = rational.fromInteger(0);

statistika.value('uiDroppableConfig', {}).directive('uiDroppable', function(uiDroppableConfig) {
  return {
    restrict:'A',

    link: function(scope, element, attrs) {
      options = angular.extend({}, uiDroppableConfig, scope.$eval(attrs.uiDroppable));
      element.droppable(options);
    }
  };
});
statistika.directive('ngDistributionChart', function() {
  return {
    restrict: 'A',
    link: function(scope, elements, attrs) {
      var distribution = scope.distribution;
      var jstat = jStat[distribution];

      scope.$watch(attrs.ngDistributionChart, _.debounce(function(tests){
        var stat;
        var first = tests[0];
        var last = tests[tests.length-1];
        var func = jStat.seq(0, last.index + 1, 100);
        func = func.map(function(f){
          return [f, first.jstat.pdf(f) ];
        });
        var real = tests.map(function(t){ return [ t.index, t.element.relative.toDecimal() ]});
        $.plot(elements, [real, func]);
      }));
    }
  }
});
statistika.directive('ngColumnChart', function() {
  return {
    restrict:'A',
    link: function(scope, elements, attrs) {
      scope.$watch(attrs.ngColumnChart, _.debounce(function(dataSource){
        elements.each(function(){
          $(this).data('chart', new Chartkick.ColumnChart(this, dataSource));
        });
      }, 1000));
    }
  };
});

statistika.value('uiDraggableConfig', {}).directive('uiDraggable', function(uiDraggableConfig) {
  return {
    restrict:'A',
    link: function(scope, element, attrs) {
      options = angular.extend({}, uiDraggableConfig, scope.$eval(attrs.uiDraggable));
      element.draggable(options);
    }
  };
});

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
    if(!rational)
      return;

    places = _.isUndefined(places) ? DEFAULT_PLACES : places;

    var decimal = rational.toDecimal ? rational.toDecimal() : rational;
    var multiplier = Math.pow(10, places)
    var fixed = Math.round(decimal * multiplier)/multiplier;

    if(decimal == Number.POSITIVE_INFINITY || decimal == Number.NEGATIVE_INFINITY) {
      return "`oo`"; // asciimath infinity
    } else {
      return fixed;
    }
  };
});

statistika.filter('fixed', function(){
  var DEFAULT_PLACES = 2;

  return function(decimal, places) {
    places = _.isUndefined(places) ? DEFAULT_PLACES : places;
    return decimal.toFixed(places);
  };
});

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
  }
};

Variable.prototype.filter = function(group){
  return _(this.matching()).partial(group);
};

Variable.prototype.group = function(column){
  return this.scale ? this[this.scale](column) : [];
};

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

function Row(group, count){
  this.group = group;
  this.count = count || 1;
}

Row.prototype.copy = function(){
  var row = new Row(this.value);
  row.count = this.count;
  return row;
};

Row.prototype.toColumn = function(){
  var column = []
  var count = this.count;
  var group = this.group;

  for(var i = 0; i < count; ++i){
    column.push(group);
  }

  return column;
}

Row.create = function(object) {
  var row = Object.create(Row.prototype);
  row.group = object.group;
  row.count = parseInt(object.count, 10);
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
    Store.set(name, newVal);
  };
}

Store.set = function(key, value) {
  persist.set(key, JSON.stringify(value));
}

Store.keys = [];

Store.get = function(name, transform) {
  transform = _.isUndefined(transform) ? Store.noop : transform;
  var persisted = persist.get(name);

  if(persisted) {
    persisted = JSON.parse(persisted);
    persisted = transform(persisted);
  } else {
    persisted = null;
  }

  return persisted;
};

Store.noop = function(val){ return val; }

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
  $scope.newRow = function(){
    return new Row(null);
  };

  Store.setup($scope, 'variable');
  Store.setup($scope, 'rows');

  $scope.rows = Store.get('rows', function(rows) { return rows.map(Row.create); }) || [$scope.newRow()];
  $scope.variable = Store.get('variable', Variable.create) || new Variable('proměnná');

  $scope.reset = Store.reset("Opravdu vymazat všechna uložená data?");

  $scope.load = function(what){
    switch(what){
      case 'health':
        var variable = $.extend(new Variable('úspěšnost léčby'), {
          description: 'úspěšnost metody léčby daného typu nádorového onemocnění',
          scale: 'nominal'
        });
        Store.clear();
        Store.set('variable', variable);
        Store.set('rows', [
          new Row('A', 9), new Row('B', 15),
          new Row('C', 20), new Row('D', 4),
          new Row('E', 2)
        ]);
        Store.set('distribution', 'normal');
        Store.set('merged_groups', [[4,5]]);
        break;
    }

    if(confirm("Data načena. Znovu načíst stránku?")){
      window.location.reload();
    }
  }

  $scope.scales = [
    new Scale("nominal", "nominální"),
    new Scale("ordinal", "ordinální"),
    new Scale("quantitative", "kvantitativní metrická"),
    new Scale("absolute", "absolutní metrická")
  ];

  $scope.$watch('rows', function(){
    var column = _($scope.rows.map(function(row){ return row.toColumn(); })).flatten();
    $scope.column = column;
  }, true);
}

function VariableCtrl($scope){

  $scope.$watch('variable', function(variable){
    $scope.groups = variable.group($scope.column);
  }, true);

  $scope.addGroup = function() {
    $scope.variable.groups.push(new Group($scope.variable.scale));
  };

  $scope.removeGroup = function(group) {
    var index = $scope.variable.groups.indexOf(group);
    $scope.variable.groups.splice(index, 1);
  };

  $scope.canAddGroup = function() {
    return $scope.variable.scale === "absolute" || $scope.variable.scale === "quantitative";
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
          $scope.variable.order = _(groups).uniq();
        });
      }
    };
    return options;
  };
}

function DataCtrl($scope) {

  $scope.removeRow = function(row) {
    var index = $scope.rows.indexOf(row);
    $scope.rows.splice(index, 1);
  };

  $scope.addRow = function(){
    $scope.rows.push($scope.newRow());
    $scope.unsorted();
  };

  $scope.copyRow = function(row) {
    var index = $scope.rows.indexOf(row);
    var copy = row.copy();
    $scope.rows.splice(index, 0, copy);
  };

  $scope.updatePosition = function(from, to) {
    var elements = $scope.rows.splice(from, 1);
    $scope.rows.splice(to, 0, elements[0]);
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

function Element(variable, rows, elements) {
  var index = elements.length;
  var row = rows[index];
  var count = rows.reduce(function(sum, row) { return sum + row.count; }, 0);
  var all = rational.fromInteger(count);

  var absolute = rational.fromInteger(row.count);
  var relative = absolute.divide(all);
  var cumulative = elements.reduce(function(sum, element){ return sum.add(element.relative); }, relative);

  this.index = elements.length;
  this.base = rational.fromInteger(this.index + 1);

  this.row = row;
  this.absolute = absolute;
  this.relative = relative;
  this.cumulative = cumulative;
}

Element.prototype.moment = function(order){
  return this.base.power(order).times(this.absolute);
};

function Sum(elements) {
  this.elements = elements;

  this.absolute = this.reduce('absolute');
  this.relative = this.reduce('relative');
}

Sum.prototype.moment = function(order) {
  return this.reduce(function(el){ return el.moment(order); });
};

Sum.prototype.reduce = function(attr) {
  var reduce;
  if(typeof(attr) == 'function'){
    reduce = attr;
  } else {
    reduce = function(el) { var val = el[attr]; return _.isUndefined(val) ? zero : val; };
  }
  return this.elements.reduce(function(sum, el){ return sum.add(reduce(el)); }, zero);
}

function Parameters(sum) {
  this.inverted = one.div(sum.absolute);
  this.sum = sum;
  this.elements = sum.elements;
  this.std = this.central_moment(2).sqrt();
  this.mean = this.general_moment(1);
  this.exces = this.normalized_moment(4).subtract(rational.fromInteger(3));
  this.length = sum.absolute;
}

Parameters.prototype.reduce = function(func, initial) {
  return this.sum.elements.reduce(function(sum, value){
    value = func(value);
    return value ? sum.add(value) : sum;
  }, initial || zero);
};

Parameters.prototype.general_moment = function(order){
  return this.inverted.times(this.sum.moment(order));
}

Parameters.prototype.central_moment = function(order){
  var general = this.general_moment(1);

  var sum = this.reduce(function(element){
    return element.absolute.times( element.base.subtract(general).power(order) );
  });

  return this.inverted.times(sum);
}

Parameters.prototype.normalized_moment = function(order){
  var general = this.general_moment(1);
  var dev = this.std;

  return this.reduce(function(element){
    return element.relative.times( element.base.subtract(general).divide(dev).power(order) );
  });
}

function ElementController($scope) {
  var index = $scope.$index;

  $scope.$watch('elements', function(elements){
    $scope.element = elements[index];
  }, true);
}

function StatsCtrl($scope) {
  $scope.$watch('column', function(data){
    var elements = [];
    var variable = $scope.variable;
    var rows = $scope.rows;
    var groups = $scope.variable.group(data);

    groups.forEach(function(group, index){
      elements.push(new Element(variable, rows, elements));
    });

    $scope.elements = elements;
    $scope.sum = new Sum(elements);
    $scope.parameters = new Parameters($scope.sum);
  }, true);

  $scope.$watch('elements', function(elements){
    $scope.absoluteChart = elements.map(function(element){
      return [ element.row.group, element.absolute.toDecimal()];
    });
    $scope.cumulativeChart = elements.map(function(element){
      return [ element.row.group, element.cumulative.toDecimal()];
    });
  });
}

function Test(distribution, tests, element, parameters) {
  var elements = parameters.elements.length;
  var i = parameters.elements.indexOf(element);
  var previous = tests[i - 1];
  var mid_index = ++i + 0.5;

  var mean = parameters.mean;
  var deviation = parameters.std;

  deviation = rational.fromInteger(1);
  if(mid_index > elements){
    mid_index = Number.POSITIVE_INFINITY;
  }

  var stat = jStat[distribution](mean.toDecimal(), deviation.toDecimal())

  var distribution = stat.cdf(mid_index);

  this.distribution = distribution;
  this.pdf = stat.pdf(mid_index);
  this.jstat = stat;

  this.element = element;
  this.parameters = parameters;
  this.index = i;
  this.count = element.absolute;


  switch(i){
    case 1:
      this.min = Number.NEGATIVE_INFINITY;
      this.max = i + 0.5;
      this.interval = "(-oo;"+ this.max +":)";
      this.bound = rational.fromDecimal(this.max);
      break;
    case elements:
      this.min = i - 0.5;
      this.max = Number.POSITIVE_INFINITY;
      this.interval = "("+ this.min +";oo)";
      this.bound = new rational(1,0); // infinity
      break;
    default:
      this.min = i - 0.5;
      this.max = i + 0.5;
      this.interval = "("+ this.min +";"+ this.max +":)";
      this.bound = rational.fromDecimal(this.max);
      break;
  }

  this.upper_bound = this.bound.subtract(mean).divide(deviation);
  this.distribution = rational.fromDecimal(distribution);
  this.relative = previous ? this.distribution.subtract(previous.distribution): this.distribution;
  this.absolute = this.relative.times(parameters.sum.absolute);
  this.chi = this.count.subtract(this.absolute).power(2).divide(this.absolute);
}

function DistributionCtrl($scope) {
  var log = function log(base, val) {
    return Math.log(val) / Math.LN10;
  }

  Store.setup($scope, 'distribution');

  $scope.distribution = Store.get('distribution');

  $scope.distributions =  [
    {name: 'normal', desc: 'normální'},
    {name: 'binomial', desc: 'binomické'}
  ]

  $scope.$watch('distribution', function(distribution){
    $scope.distribution_function = jStat[distribution];
  })

  $scope.$watch('elements', function(elements){
    var parameters = $scope.parameters;
    var distribution = $scope.distribution;
    var tests = [];

    elements.forEach(function(element){
      tests.push(new Test(distribution, tests, element, parameters));
    });

    $scope.tests = tests;
    $scope.sum = new Sum(tests);
    $scope.sum.length = parameters.length;
  });
}

function TheoreticTestCtrl($scope) {
  var index = $scope.$index;

  $scope.$watch('tests', function(tests){
    $scope.test = tests[index];
  });
}

function TestGroup() {
  this.tests = [];
}

TestGroup.prototype.addTest = function(test){
  this.tests.push(test);

  this.indexes = this.tests.map(function(t){ return t.index; });
  this.index = this.indexes.join(' + ');
  this.real  = this.reduce(function(t) { return t.count });
  this.test  = this.reduce(function(t) { return t.absolute });
  this.chi   = this.real.subtract(this.test).power(2).divide(this.test);
};

TestGroup.prototype.isMerged = function(){
  return this.indexes.length > 1;
}

TestGroup.prototype.reduce = function(reduce){
  return this.tests.reduce(function(sum, test){ return sum.add(reduce(test)); }, zero);
};

TestGroup.prototype.merge = function(groups){
  var base = this;

  groups.forEach(function(group){
    group.tests.forEach(function(test){
      base.addTest(test);
    })
  });
};

function GroupSum(p, groups) {
  if(_.isUndefined(groups))
    groups = [];

  var rows = 2;
  var chisquare, exp, teor;

  this.groups = this.elements = groups;
  this.degrees_of_freedom = groups.length - rows -1;

  chisquare = jStat.chisquare(this.degrees_of_freedom);

  exp = this.reduce(function(group){ return group.chi; });
  teor = chisquare.inv(1 - p.value);

  this.chi = { exp: exp, teor: teor};
}

GroupSum.prototype.reduce = Sum.prototype.reduce;

function P(value){
  this.default = 0.05;
  this.value = _.isUndefined(value) ? this.default : value;
}

function ExperimentalValueTestCtrl($scope) {
  // TODO: persist group merging

  Store.setup($scope, 'merged_groups');
  $scope.merged_groups = Store.get('merged_groups') || [];
  $scope.p = new P();

  $scope.dragOptions = {
    scope: 'groups',
    containment: 'parent',
    revert: 'invalid',
    helper: 'clone'
  };

  $scope.dropOptions = {
    scope: 'groups',
    activeClass: 'ui-state-active',
    hoverClass: 'ui-state-hover',
    tolerance: 'pointer',
    accept: function(drag) {
      return drag[0] != this;
    },
    over: function(event, ui) {
      console.debug(event, ui);
    },
    drop: function(event, ui) {
      var index = ui.draggable.scope().$index;
      var dropped = $(this).scope().group;

      $(this).scope().mergeGroups(dropped, index);
    }
  }

  $scope.mergeGroups = function(base, index) {
    $scope.$apply(function(){
      var removed = $scope.groups.splice(index, 1);
      base.merge(removed);
      $scope.merged_groups.push(base.indexes);
    });
  };

  $scope.split = function(group) {
    var index = $scope.groups.indexOf(group);
    var args = [];
    var merges = [];

    $scope.merged_groups.forEach(function(indexes){
      if(!angular.equals(indexes, group.indexes)){
        merges.push(indexes);
      }
    });
    $scope.merged_groups = merges;

    args.push(index);
    args.push(1);

    group.tests.forEach(function(test){
      group = new TestGroup();
      group.addTest(test);
      args.push(group);
    });

    $scope.groups.splice.apply($scope.groups, args);
  }

  $scope.$watch('p', function(p){
    $scope.sum = new GroupSum(p, $scope.groups);
  }, true);

  $scope.$watch('groups', function(groups){
    $scope.sum = new GroupSum($scope.p, groups);
  }, true);

  $scope.$watch('tests', function(tests){
    var groups = [];
    var merges = $scope.merged_groups;
    var index, group, merge, fresh;

    tests.forEach(function(test){
      index = test.index;
      merge = _(merges).find(function(group) { return group.indexOf(index) != -1 });
      fresh = !merge || merge.indexOf(index) == 0;

      if(fresh) {
        group = new TestGroup();
        groups.push(group);
      }

      group.addTest(test);
    });

    $scope.groups = groups;
  }, true);
}

function IntervalEstimate(p, params) {
  this.parameters = params;
  this.p = p;
  this.n = this.parameters.length;
  this.sq_min = this.critical_value(p.value/2);
  this.sq_max = this.critical_value(1-(p.value/2));
  this.min = this.sq_min.sqrt();
  this.max = this.sq_max.sqrt();
}

IntervalEstimate.prototype.critical_value = function(confidence){
  var degrees = this.n.subtract(one).toDecimal();
  var chisquare = jStat.chisquare(degrees).inv(1 - confidence);
  return this.parameters.central_moment(2).times(this.n).divide(rational.fromDecimal(chisquare));
}

function EstimatesCtrl($scope){
  $scope.p = new P();

  $scope.$watch('parameters', function(params){
    $scope.interval = new IntervalEstimate($scope.p, params);
  }, true);

  $scope.$watch('p', function(p){
    $scope.interval = new IntervalEstimate(p, $scope.parameters);
  }, true);

}