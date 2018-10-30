/**
 * Created by ryan on 15/7/28.
 */
var fs = require('fs'),
  path = require('path');
var fis = require('fis3');
var _ = fis.util,
  config = fis.config;
var expect = require('chai').expect;
var resource = require('../lib/resource.js');
var pack = require('../lib/pack.js');
var _release = fis.require('command-release/lib/release.js');
var _deploy = fis.require('command-release/lib/deploy.js');
var loader = require('../');

function wrapLoader(options) {
  return function (ret, pack, settings, opt) {
    settings = _.assign({}, loader.defaultOptions);
    _.assign(settings, options);
    return loader.call(this, ret, pack, settings, opt);
  }
};

function release(opts, cb) {
  opts = opts || {};

  _release(opts, function (error, info) {
    _deploy(info, cb);
  });
}


var root = path.join(__dirname, 'source');
fis.project.setProjectRoot(root);
fis.media().init();
//fis.config.init();
var testfile = _(root, '../dist');
_.del(testfile);

require('./fis-conf.js');

fis.match('/node_modules/**.{woff,ttf}', {
    release: '/static/fonts/$0'
  })
  .match('**.{js,jsx}', {
    optimizer: fis.plugin('uglify-js')
    //useHash: true
  })
  .match('**.{css,less}', {
    optimizer: fis.plugin('clean-css')
    //useHash: true
  });

fis.match('::packager', {
  postpackager: wrapLoader({
    allInOne: true,
    scriptPlaceHolder: "<!--SCRIPT_PLACEHOLDER-->",
    stylePlaceHolder: '<!--STYLE_PLACEHOLDER-->',
    resourcePlaceHolder: '<!--RESOURCEMAP_PLACEHOLDER-->',
    resourceType: 'asyncsMod',
    processor: {
      '.html': 'html'
    },
    obtainScript: true,
    obtainStyle: true,
    useInlineMap: false
  })

});

fis.match('*', {
  deploy: fis.plugin('local-deliver', {
    to: path.join(root , "../dist")
  })
})

release({
  unique: true,
  //verbose:true
  //clean:true
}, function () {
  console.log('Done');
});

