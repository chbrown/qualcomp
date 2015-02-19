/*jslint browser: true */ /*globals angular */
var app = angular.module('app', [
  'ngStorage',
  'misc-js/angular-plugins',
]);

var log = console.log.bind(console);

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

function uploadFile(url, file, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open('POST', url);
  xhr.onerror = function(error) {
    callback(error);
  };
  xhr.onload = function(event) {
    if (xhr.status >= 300) {
      var error = new Error(xhr.responseText);
      return callback(error);
    }

    var body = xhr.responseText;
    var content_type = xhr.getResponseHeader('content-type');
    if (content_type.match(/application\/json/)) {
      // unescape angular.js anti-XSS-prefix, if needed
      body = body.replace(/^\)\]\}',/, '');
      body = JSON.parse(body);
    }
    callback(null, body);
  };

  var form = new FormData();
  form.append('file', file, file.name);
  xhr.send(form);
}

app.directive('img', function($parse) {
  return {
    restrict: 'E',
    compile: function(el, attrs) {
      var ngLoad = $parse(attrs.ngLoad);
      var ngError = $parse(attrs.ngError);
      return function(scope, element, attr) {
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

app.factory('uploadFile', function($q) {
  return function(url, file) {
    return $q(function(resolve, reject) {
      uploadFile(url, file, function(err, data) {
        // split out typical async callback into reject/resolve calls:
        return err ? reject(err) : resolve(data);
      });
    });
  };
});

app.controller('variationCtrl', function($scope, $http, $localStorage, $flash) {
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
      $flash('image head error ' + err.toString());
    });
  };
});

app.controller('viewportCtrl', function($scope, $http, $localStorage, $flash) {
  $scope.$storage = $localStorage;
  $scope.mouse = {down: false};

  $scope.mousemove = function(ev) {
    // ev.offsetX and ev.offsetY are what we want, but it seems they are non-standard?
    //   maybe just Chrome / Angular.js trying to be helpful?
    // ev.offsetX, ev.offsetY == 0, 0 in the top-left corner of the image
    if ($scope.mouse.down) {
      $localStorage.viewport.x = (ev.offsetX * $scope.x_ratio) - ($localStorage.viewport.width / 2);
      $localStorage.viewport.y = (ev.offsetY * $scope.y_ratio) - ($localStorage.viewport.height / 2);
    }
  };

  $scope.load = function(img) {
    // img is not an actual img DOM element
    $scope.x_ratio = img.naturalWidth / img.width;
    $scope.y_ratio = img.naturalHeight / img.height;
  };
});

app.controller('uploadCtrl', function($scope, $http, $localStorage, $flash, uploadFile) {
  $scope.$storage = $localStorage;

  var promise = $http.get('/images').then(function(res) {
    $scope.uploads = res.data;
    return 'Loaded ' + $scope.uploads.length + ' images';
  }, function(err) {
    return err.toString();
  });
  $flash(promise);

  $scope.uploadFile = function(file, ev) {
    var promise = uploadFile('/images', file).then(function(res) {
      Array.prototype.push.apply($scope.uploads, res);
      return 'Uploaded ' + res.length + ' file(s)';
    }, function(err) {
      return 'Upload error: ' + err.toString();
    });
    $flash(promise);
  };
});

app.controller('previewCtrl', function($scope, $http, $localStorage, $flash) {
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
    $flash('image head error ' + err.toString());
  });

  $scope.deleteVariation = function(variation) {
    $scope.$storage.variations.splice($scope.$storage.variations.indexOf(variation), 1);
  };
});
