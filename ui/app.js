/*jslint browser: true */
var angular = require('angular');
var Request = require('httprequest').Request;
var NotifyUI = require('notify-ui').NotifyUI;

require('ng-upload');
require('ngstorage');

var app = angular.module('app', [
  'ngStorage',
  'ngUpload',
]);

function serializeQuerystring(query) {
  var pairs = [];
  for (var key in query) {
    var value = query[key];
    if (key != '$$hashKey' && value) {
      pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
    }
  }
  return (pairs.length > 0) ? ('?' + pairs.join('&')) : '';
}
app.filter('serializeQuerystring', function() {
  return serializeQuerystring;
});

app.directive('img', function($parse) {
  return {
    restrict: 'E',
    compile: function(el, attrs) {
      var ngLoad = $parse(attrs.ngLoad);
      var ngError = $parse(attrs.ngError);
      return function(scope, element) {
        element.on('error', function(error) {
          var context = {
            $error: error.toString(),
            $src: element.attr('src'),
          };
          scope.$apply(function() {
            ngError(scope, context);
          });
        });
        element.on('load', function(event) {
          var img = {
            width: event.target.width,
            height: event.target.height,
            naturalWidth: event.target.naturalWidth,
            naturalHeight: event.target.naturalHeight,
            src: event.target.src,
          };
          scope.$apply(function() {
            ngLoad(scope, {$img: img});
          });
        });
      };
    }
  };
});

app.factory('$uploadFile', function($q) {
  return function(url, file) {
    return $q(function(resolve, reject) {
      var request = new Request('POST', url);
      var form = new FormData();
      form.append('file', file, file.name);
      request.sendData(form, function(err, data) {
        // split out typical async callback into reject/resolve calls:
        return err ? reject(err) : resolve(data);
      });
    });
  };
});

app.controller('uploadCtrl', function($scope, $http, $localStorage, $uploadFile) {
  $scope.$storage = $localStorage;

  var promise = $http.get('/images').then(function(res) {
    $scope.uploads = res.data;
    return 'Loaded ' + $scope.uploads.length + ' images';
  }, function(err) {
    return err.toString();
  });
  NotifyUI.addPromise(promise);

  $scope.uploadFile = function(file) {
    var promise = $uploadFile('/images', file).then(function(res) {
      Array.prototype.push.apply($scope.uploads, res);
      return 'Uploaded ' + res.length + ' file(s)';
    }, function(err) {
      return 'Upload error: ' + err.toString();
    });
    NotifyUI.addPromise(promise);
  };
});

/* Shape data structures

interface Point {
  x: number;
  y: number;
}

interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

*/

/** relativeOffset(target: DOMElement, client_point: Point) => Point

Accordining to the MDN docs, MouseEvents are characterized by the following
points, which are standard. See https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent

MouseEvent.clientX
  The X coordinate of the mouse pointer in local (DOM content) coordinates.
MouseEvent.clientY
  The Y coordinate of the mouse pointer in local (DOM content) coordinates.
MouseEvent.screenX
  The X coordinate of the mouse pointer in global (screen) coordinates.
MouseEvent.screenY
  The Y coordinate of the mouse pointer in global (screen) coordinates.

But since MouseEvent inherits UIEvent, we also have access to the points, which
apparently are not standardized. See https://developer.mozilla.org/en-US/docs/Web/API/UIEvent

UIEvent.layerX
  Returns the horizontal coordinate of the event relative to the current layer.
UIEvent.layerY
  Returns the vertical coordinate of the event relative to the current layer.
UIEvent.pageX
  Returns the horizontal coordinate of the event relative to the whole document.
UIEvent.pageY
  Returns the vertical coordinate of the event relative to the whole document.

It's unclear what Event.offsetX and Event.offsetY refer to.

*/
function relativeOffset(target, client_point) {
  // this probably isn't very generlizable with all the offsetPos / offsetParent.scrollPos management
  return {
    x: client_point.x - (target.offsetLeft - target.offsetParent.scrollLeft),
    y: client_point.y - (target.offsetTop - target.offsetParent.scrollTop),
  };
}

/** makeRectangle(point_1: Point, point_2: Point) => Rectangle

Fit a Rectangle around two Points.
*/
function makeRectangle(point_1, point_2) {
  var x = Math.min(point_1.x, point_2.x);
  var y = Math.min(point_1.y, point_2.y);

  return {
    x: x,
    y: y,
    width: Math.max(point_1.x, point_2.x) - x,
    height: Math.max(point_1.y, point_2.y) - y,
  };
}

/** moveElement(element: DOMElement, rectangle: Rectangle) => null

Set the absolutely positioned offsets of an element to match the given rectangle.
*/
function moveElement(element, rectangle) {
  element.style.left = rectangle.x + 'px';
  element.style.top = rectangle.y + 'px';
  element.style.width = rectangle.width + 'px';
  element.style.height = rectangle.height + 'px';
}

/** attachDraggableFrame(container: DOMElement,
                         onUpdate: (rectangle: Rectangle) => null)

A new div will be created and appended to the container.

*/
function attachDraggableFrame(container, onUpdate) {
  var frame = document.createElement('div');
  frame.className = 'draggable-frame';
  frame.style.position = 'absolute';
  container.appendChild(frame);

  // mousedown_point: Point will not be null while drawing the frame rectangle,
  // and will be expressed in coordinates relative to the container.
  var mousedown_point = null;

  container.addEventListener('mousedown', function(ev) {
    frame.style['pointer-events'] = 'none';
    frame.draggable = false;

    mousedown_point = relativeOffset(container, {x: ev.clientX, y: ev.clientY});
  });
  container.addEventListener('mousemove', function(ev) {
    // log('mousemove page(%d, %d) layer(%d, %d) client(%d, %d)',
    //   ev.pageX, ev.pageY, ev.layerX, ev.layerY, ev.clientX, ev.clientY, ev);
    if (mousedown_point) {
      // calculate cursor offset relative to container
      var cursor_point = relativeOffset(container, {x: ev.clientX, y: ev.clientY});

      var frame_rectangle = makeRectangle(mousedown_point, cursor_point);
      moveElement(frame, frame_rectangle);

      onUpdate(frame_rectangle);
    }
  });
  container.addEventListener('mouseup', function() {
    frame.style['pointer-events'] = 'auto';
    frame.draggable = true;

    mousedown_point = null;
  });

  // container.addEventListener('dragstart', function(ev) {
  //   log('dragstart', ev);
  // });
  // container.addEventListener('drag', function(ev) {
  //   log('drag', ev);
  // });
  // container.addEventListener('drop', function(ev) {
  //   log('drop', ev);
  // });
  // container.addEventListener('dragend', function(ev) {
  //   log('dragend', ev);
  // });

}

app.controller('viewportCtrl', function($scope, $element, $localStorage) {
  $scope.$storage = $localStorage;

  $scope.frame = {
    x: 0,
    y: 0,
    width: 30,
    height: 30,
  };

  $scope.mouse = {
    down: false,
    inside: false,
  };

  var container = $element[0];
  attachDraggableFrame(container, function onUpdate(rectangle) {
    // translate from rectangle to page coordinates
    var containerX = (rectangle.x + (container.offsetLeft - container.offsetParent.scrollLeft));
    var containerY = (rectangle.y + (container.offsetTop - container.offsetParent.scrollTop));
    var centerX = containerX + (rectangle.width / 2);
    var centerY = containerY + (rectangle.height / 2);
    // document.elementFromPoint must specify the (x, y) coordinates to check,
    // in CSS pixels relative to the upper-left corner of the document's
    // containing window or frame.
    var el = document.elementFromPoint(centerX, centerY);

    if (el.tagName == 'IMG') {
      $scope.$apply(function() {
        var filename_match = el.getAttribute('src').match(/([^\/]+)$/);
        $scope.$storage.selected_filename = filename_match[1];
        // update viewport
        var x_ratio = el.naturalWidth / el.width;
        var y_ratio = el.naturalHeight / el.height;
        // since rectangle is relative to container and each img is relative to container,
        // determining offset relative to each image is pretty easy
        $scope.$storage.viewport.x = (rectangle.x - el.offsetLeft) * x_ratio;
        $scope.$storage.viewport.y = (rectangle.y - el.offsetTop) * y_ratio;
        $scope.$storage.viewport.width = rectangle.width * x_ratio;
        $scope.$storage.viewport.height = rectangle.height * y_ratio;
      });
    }
  });

});

app.controller('variationCtrl', function($scope, $http, $localStorage) {
  $scope.$storage = $localStorage;
  $scope.load = function(img) {
    // not an actual img DOM element
    $scope.width = img.naturalWidth;
    $scope.height = img.naturalHeight;
    // if the server sent along decent cache headers with the image, this
    // HEAD will be pulled directly from the cache
    $http.head(img.src).then(function(res) {
      $scope.size = res.headers('content-length');
    }, function(err) {
      NotifyUI.add('image head error ' + err.toString());
    });
  };
});

app.controller('previewCtrl', function($scope, $http, $localStorage) {
  $scope.$storage = $localStorage.$default({
    quality: 80,
    resize: '',
    viewport: {
      x: 100,
      y: 100,
      width: 200,
      height: 200,
    },
    variations: [{}, {quality: 90}]
  });

  $http.head('/images/' + $scope.$storage.selected_filename).then(function(res) {
    $scope.original_size = res.headers('content-length');
  }, function(err) {
    NotifyUI.add('image head error ' + err.toString());
  });

  $scope.deleteVariation = function(variation) {
    $scope.$storage.variations.splice($scope.$storage.variations.indexOf(variation), 1);
  };
});
