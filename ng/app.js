/*jslint browser: true */ /*globals angular */
var app = angular.module('app', [
  'ngStorage',
  'misc-js/angular-plugins',
]);

var log = console.log.bind(console);

function serializeQuerystring(query) {
  var pairs = [];
  for (var key in query) {
    pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(query[key]));
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

app.controller('configCtrl', function($scope, $http, $localStorage, $flash) {
  $scope.$storage = $localStorage.$default({
    variations: [
      {quality: 80},
      // {quality: 70},
      {quality: 60},
      // {quality: 50},
    ]
  });
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
  $scope.$storage = $localStorage;

  function refresh() {
    log('previewCtrl refreshing');
    var uploaded_image = {
      src: '/images/' + $scope.$storage.selected_filename,
    };
    var variation_images = $scope.$storage.variations.map(function(options) {
      var query = angular.copy(options);
      return {
        src: uploaded_image.src + serializeQuerystring(query),
      };
    });
    $scope.images = [uploaded_image].concat(variation_images);
  }
  $scope.$watch('$storage.variations', refresh);
  $scope.$watch('$storage.selected_filename', refresh);
});
