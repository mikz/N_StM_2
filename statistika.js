
var statistika = angular.module('statistika', ['ui.sortable']);
var persist = statistika.persist = new Persist.Store('Statistika');

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


function GridCtrl($scope) {
  var header = persist.get('header');
  var rows = persist.get('rows');

  if(header) {
    header = JSON.parse(header);
    header = Row.create(header);
  } else {
    header = new Row(['first', 'second']);
  }

  if(rows) {
    rows = JSON.parse(rows);
    rows = rows.map(Row.create);
  } else {
    rows = [];
  }

  $scope.header = header;
  $scope.rows = rows;

  $scope.$watch('rows', function(newVal, oldVal) {
    if(!angular.equals(newVal, oldVal)) {
      console.log('rows updated');
      persist.set('rows', JSON.stringify(newVal));
    }
  }, true);

  $scope.$watch('header', function(newVal, oldVal) {
    if(!angular.equals(newVal, oldVal)) {
      console.log('header updated');
      persist.set('header', JSON.stringify(newVal));
    }
  }, true);

  $scope.removeRow = function(row) {
    var index = $scope.rows.indexOf(row);
    $scope.rows.splice(index, 1);
  };

  $scope.columns = function() {
    return $scope.header.length;
  };

  $scope.newRow = function(){
    var columns = new Array($scope.columns());
    return new Row(columns);
  };

  $scope.addRow = function(){
    $scope.rows.push($scope.newRow());
  };

  $scope.updatePosition = function(from, to) {
    var elements = $scope.rows.splice(from, 1);
    $scope.rows.splice(to, 0, elements[0]);
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
