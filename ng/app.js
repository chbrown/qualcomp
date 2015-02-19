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

app.directive('variation', function($http) {
  return {
    restrict: 'A',
    scope: {
      variation: '=',
      filename: '=',
    },
    templateUrl: '/ng/variation.html',
    replace: true,
    link: function(scope, el, attrs) {
      //  title="quality: {{variation.quality}}; resize: {{variation.resize}}"
      var src = '/images/' + scope.filename + serializeQuerystring(scope.variation);

      var img = document.createElement('img');
      img.addEventListener('error', function(err) {
        log('img error', err);
      });
      // img.complete is a boolean that is false when fetching is currently in progress, and true when the src is missing or it has been completely loaded, but the load event seems to work just fine.
      img.addEventListener('load', function() {
        log('img[src=%s]:load', src);
        // we must read the width and height before putting it on the page, where it may be restyled
        // apparently img has .naturalWidth and .naturalHeight fields in some browsers,
        //   but that's not universally supported
        var original_width = img.width;
        var original_height = img.height;
        // now we can put the image into the DOM
        el.append(img);
        // and fill in the scope's variables
        scope.$apply(function() {
          scope.width = original_width;
          scope.height = original_height;

          // if the server sent along decent cache headers with the image, this
          // HEAD will be pulled directly from the cache
          $http.head(src).then(function(res) {
            scope.size = res.headers('content-length');
          }, function(err) {
            log('image head error', err);
          });
        });
      });
      img.src = src;
      // ${(100.0 * output_stats.size / input_stats.size).toFixed(2)}%
      // logger.info(`recompressed file is ... the size of the original`);
    }
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
    variations: [
      {quality: 80},
      // {quality: 70},
      {quality: 60},
      // {quality: 50},
    ]
  });

  $scope.$on('delete', function(variation) {
    $scope.$storage.variations.splice($scope.$storage.variations.indexOf(variation), 1);
  });
});
