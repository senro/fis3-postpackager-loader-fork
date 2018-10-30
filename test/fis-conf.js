fis.unhook('components');//如果不加这句话,会导致node_modules里的本地依赖与components里的模块名重名时,node_modules本地模块解析出错问题
fis.hook('commonjs');
fis.hook('node_modules');
fis.hook('relative-fork');

// fis.match("*.html", {
//   useHash: false,
//   packTo: root + "/dist/aaaa.html"
// });

fis.match("**/(*).js", {
  wrap:true,
  isMod: true
});

fis.match("{mod,lib}.js", {
  wrap:false,
  isMod: false
});

fis.match("**/*.css", {
  // release: './static/$0'
});

fis.match('**', { relative: true });

fis.match('*.{js,es,es6,jsx,ts,tsx}', {
  preprocessor: [
    fis.plugin('js-require-file-fork'),
    fis.plugin('js-require-css')
  ]
});
