/**
 * 将零散的文件打包合成一个新文件。
 */
var common = require('./common.js');
var SourceMap = require('source-map');
var Sugarjs = require('sugar');
var _ = fis.util;
var rSourceMap = /(?:\/\/\#\s*sourceMappingURL[^\r\n\'\"]*|\/\*\#\s*sourceMappingURL[^\r\n\'\"]*\*\/)(?:\r?\n|$)/ig;
Sugarjs.extend();

function getFileRequires(src, file, isNeedAsyncs) {
  var result = [];

  if(isNeedAsyncs){
    var requires=file.requires.concat(file.asyncs);
    requires.map(function(item){
      if(src[item]&&src[item].isJsLike){
        result.push(item);
        var innerRequires=src[item].requires.concat(src[item].asyncs);
        if (innerRequires.length > 0) {
          result = result.concat(getFileRequires(src,src[item],isNeedAsyncs));
        }
      }
    });
  }else{
    file&&file.requires&&file.requires.map(function(item){
      result.push(item);

      if (src[item].requires && src[item].requires.isJsLike && src[item].requires.length > 0) {
        result = result.concat(getFileRequires(src,src[item]));
      }
    });
  }

  return result;
}
function delCssIds(ids){
  ids=ids.filter(function(id){
    if(/\.css|\.less|\.scss|\.sass|\<\<\</.test(id)){
      return false;
    }
    return true;
  });

  return ids;
}
function arrayIntersection(a, b)
{
  var ai=0, bi=0;
  var result = new Array();
  while( ai < a.length && bi < b.length )
  {
    if (a[ai] < b[bi] ){ ai++; }
    else if (a[ai] > b[bi] ){ bi++; }
    else /* they're equal */
    {
      result.push(a[ai]);
      ai++;
      bi++;
    }
  }
  return result;
}

function tranlateIdsToResources(fileIdArray,ret){
  fileIdArray=fileIdArray.map(function(id){
    var resourceItem=ret.map.res[id];
    if(resourceItem){
      resourceItem.id=id;
      resourceItem.async=false;
      resourceItem.attrs=resourceItem.type=== 'js' ? ' type="text/javascript"' : ' rel="stylesheet" type="text/css"';
    }

    return resourceItem;
  });
  return fileIdArray;
}
module.exports = function (file, resource, ret, opts,commandOpts) {
  if(commandOpts.verbose){
    fis.log.debug('loader 开始，文件id',file.id);
  }

  var root = fis.project.getProjectPath();
  var ignoreList;

  resource.calculate();

  // 把异步池子中 js 放到同步的池子中
  /*if (opts.includeAsyncs) {
    resource.asyncs.forEach(function(item) {
      item.async = false;
      item.id && (resource.loaded[item.id] = false);
      resource[item.type === 'js' ? 'js' : 'css'].push(item);
    });

    resource.asyncs = [];
  }*/
  /*这里计算所有的异步模块的共用模块，然后放到pkg，同时把包的依赖信息同步到resourceMap*/
  /*
  1.合并src里所有有asyncs属性并且length>0到数组A，这个数组A里就是所有异步加载的模块
  2.递归数组A里的每个元素Item的requires,合并到数组A-item[i]-requires,找到所有异步加载模块的所有同步依赖模块
  3.找到每个A-item[i]-requires里相同的模块，这就是所有异步模块公用的模块集合AC,再去除所有同步模块集合相同的模块，以免重复引用
  4.去除A-item[i]-requires里包含在集合AC的模块，得到每个异步模块的打包模块集合
  5.把AC的file合并成一个pkg文件，命名为：host文件的filePath为前缀+asyncs.common.js
  6.把A-item[i]-requires的file合并成一个pkg文件，命名为：host文件的filePath为前缀+A-item[i]+asyncs.js
  7.改变ret里pkg的顺序，让allinone打包的同步模块放在第一位，asyncs.common.js第二位，A-item[i]+asyncs.js为第三位但是不引入host的html因为是异步加载用的
  8.改变resoureMap为A及其指向的asyncs.js
  */

  var getDeps = (function(src, ids) {
    // 2016-02-17
    // 由于使用递归函数方式, 出现堆栈错误, 所以修改成了 while 逻辑.
    return function (file, async) {
      var list = [];
      var pending = [{file: file, async: async}];
      var collected = [];
      var asyncCollected = [];

      while (pending.length) {
        var current = pending.shift();
        var cf = current.file;
        var ca = current.async;
        var includeAsync = current.includeAsync;
        if(!cf){
          if(commandOpts.verbose){
            fis.log.warn('检查到有非法引用路径，请检查代码');
          }
        }
        if (cf && cf.requires && cf.requires.length && !~collected.indexOf(cf)) {
          collected.push(cf);
          cf.requires.forEach(function(id) {
            if (!ids[id])return;

            ~list.indexOf(ids[id]) || list.push(ids[id]);

            pending.push({
              file: ids[id],
              async: ca
            });
          });
        }

        if ((ca || includeAsync) && file && file.asyncs && file.asyncs.length && !~asyncCollected.indexOf(cf)) {
          asyncCollected.push(cf);
          cf.asyncs.forEach(function(id) {
            if (!ids[id])return;

            ~list.indexOf(ids[id]) || list.push(ids[id]);

            pending.push({
              file: ids[id],
              async: false,
              includeAsync: true
            });
          });
        }
      }

      return list;
    };
  })(ret.src, ret.ids);

  //为了兼容低版本的node，用es5
  var allAsyncsModIds = [];
  var allAsyncsModRequireIds = [];
  var allAsyncsModCommonRequireIds = [];

  var currrentFileRequires=getDeps(file,true);
  currrentFileRequires=currrentFileRequires.unique();
  //console.log('currrentFileRequires:',currrentFileRequires);
  //这里应该根据入口文件进行划分,从入口文件去递归出该文件所有的异步依赖 TODO
  currrentFileRequires.forEach(function (srcfile, index) {
    if (srcfile.asyncs && srcfile.asyncs.length > 0) {
      allAsyncsModIds = allAsyncsModIds.concat(srcfile.asyncs);
    }
  });

  allAsyncsModIds=allAsyncsModIds.unique();

  allAsyncsModIds.forEach(function (id) {
    //用户可能有写错引用路径的情况，所以这里要判断一下，不然会导致后面逻辑报错
    if(ret.ids[id]){
      var currentIdFileRequireIds=getDeps(ret.ids[id], false).map(function(file){return file.id});
      //异步入口模块本身也要加进去
      currentIdFileRequireIds.push(id);
      allAsyncsModRequireIds.push(currentIdFileRequireIds);
    }
  });

  allAsyncsModRequireIds.forEach(function (array,index) {
    if(index>0){
      //获取每个异步模块的共同依赖
      allAsyncsModCommonRequireIds=arrayIntersection(allAsyncsModRequireIds[index-1],array);
    }
  });


  var allAsyncsModCommonRequireIdsJoin=allAsyncsModCommonRequireIds.join('|');
  var allsyncsModRequireIdsJoin=resource.js.map(function(item){
    return item.id;
  }).join('|');

  //去除异步模块里共同的依赖，和包含的同步模块
  allAsyncsModRequireIds=allAsyncsModRequireIds.map(function (array,index) {
    array=delCssIds(array.filter(function(item){
      if(new RegExp(item).test(allAsyncsModCommonRequireIdsJoin)||new RegExp(item).test(allsyncsModRequireIdsJoin)){
        return false;
      }
      return true;
    }));
    return array;
  });

  //去除所有异步模块的共同依赖里的同步模块中已经包含的模块，避免二次加载
  allAsyncsModCommonRequireIds=delCssIds(allAsyncsModCommonRequireIds.filter(function (item,index) {
    if(new RegExp(item).test(allsyncsModRequireIdsJoin)){
      return false;
    }
    return true;
  }));

  var allAsyncsModCommonRequireIdsResource=tranlateIdsToResources(allAsyncsModCommonRequireIds,ret);

  if(commandOpts.verbose){
    fis.log.debug('allAsyncsModIds:',allAsyncsModIds);
    fis.log.debug('allAsyncsModRequireIds:',allAsyncsModRequireIds);
    fis.log.debug('allAsyncsModCommonRequireIds:',allAsyncsModCommonRequireIds);
  }

  // normalize ignore.
  if (opts.ignore) {
    ignoreList = opts.ignore;

    if (typeof ignoreList === 'string') {
      ignoreList = ignoreList.split(/\s*,\s*/);
    } else if (!Array.isArray(ignoreList)) {
      ignoreList = [ignoreList];
    }

    ignoreList = ignoreList.map(function (item) {
      return typeof item === 'string' ? _.glob(item) : item;
    });
  }

  //把异步模块公用模块加入同步的包中
  resource.js=resource.js.concat(allAsyncsModCommonRequireIdsResource);
  pack(resource.js, opts.js || 'pkg/${filepath}_aio.js', opts.sourceMap);
  //pack(allAsyncsModCommonRequireIdsResource, 'pkg/${filepath}_asyncs.common.js', opts.sourceMap);
  //独立打包所有的异步模块及其依赖
  allAsyncsModRequireIds.map(function(idsArray,index){
    if(commandOpts.verbose){
      fis.log.debug('开始打包：',allAsyncsModIds[index],'的异步依赖');
    }

    pack(tranlateIdsToResources(idsArray,ret), 'pkg/${filepath}_'+allAsyncsModIds[index].replace(/\.|\//g,'_')+'.asyncs.js', opts.sourceMap,true,allAsyncsModIds[index]);
  });
  pack(resource.css, opts.css || 'pkg/${filepath}_aio.css', opts.sourceMap);

  function isIgnored(item) {
    if (!ignoreList || !ignoreList.length) {
      return false;
    }

    var file = null;

    if (item.id) {
      file = resource.getFileById(item.id)
    } else {
      file = resource.getFileByUrl(item.uri);
    }

    var filepath = file ? file.subpath : item.uri;
    var hitted = false;

    ignoreList.every(function (reg) {

      if (reg.test(filepath)) {
        hitted = true;
        return false;
      }

      return true;
    });

    return hitted;
  }

  function pack(list, fileTpl, sourceMap,isAsyncs,asyncsEntry) {
    var index = 1;
    var i = 0;
    var unpacked = [];
    var item;

    while (i < list.length) {
      item = list[i];

      if (item.id && !(item.pkg && !item.allInOne) && (!opts.ignore || !isIgnored(item))/**/) {
        unpacked.push(item);
        list.splice(i, 1);
        // todo 可能还要删除其他东西。
      } else {
        if (unpacked.length > 1) {
          _pack();
        } else if (unpacked.length) {
          list.splice(i, 0, unpacked[0]);
        }

        unpacked = [];
        i++;
      }
    }

    if (unpacked.length > 0) {//以前是1，TODO 这里不知道为什么限制必须两个及以上才打包，先改成0，看有没有问题
      _pack();
    } else if (unpacked.length) {
      list.push(unpacked.pop());
    }

    function _pack() {

      var filepath = getFilepath(fileTpl, file);

      if(commandOpts.verbose){
        fis.log.debug(filepath,'开始_pack');
      }

      if (index > 1) {
        filepath = filepath.replace(/\.([^\.]+)$/i, function (ext) {
          return '_' + index + ext;
        });
      }

      var pkg = fis.file(root, filepath);
      var has = [];

      var sourceNode;
      if (sourceMap) {
        sourceNode = new SourceMap.SourceNode();
      }

      var content = '';
      unpacked.forEach(function (item) {
        var file = ret.idmapping[item.id];
        var prefix = (!(opts.useTrack)) ? '' : (file.isJsLike ? '/*!' + file.id + '*/\n;' : '/*!' + file.id + '*/\n');
        var map = file.map = file.map || {};

        map.aioPkg = pkg.getId();
        has.push(file.getId());

        // 派送事件
        var message = {
          file: file,
          content: file.getContent(),
          pkg: pkg
        };
        fis.emit('pack:file', message);
        message.content = message.content.replace(rSourceMap, '');

        if (sourceNode) {
          sourceNode.add(prefix);

          var mapFile = getMapFile(file);

          if (mapFile) {
            var json = JSON.parse(mapFile.getContent());
            var smc = new SourceMap.SourceMapConsumer(json);

            sourceNode.add(SourceMap.SourceNode.fromStringWithSourceMap(message.content, smc));
            // mapFile.release = false;
          } else {
            sourceNode.add(contents2sourceNodes(message.content, file.subpath));
          }

          sourceNode.add('\n');
        }

        content += prefix + message.content + '\n';
      });


      if (sourceMap) {
        var mapping = fis.file.wrap(pkg.dirname + '/' + pkg.filename + pkg.rExt + '.map');
        var code_map = sourceNode.toStringWithSourceMap({
          file: pkg.subpath
        });

        var generater = SourceMap.SourceMapGenerator.fromSourceMap(new SourceMap.SourceMapConsumer(code_map.map.toJSON()));
        mapping.setContent(generater.toString());
        ret.pkg[mapping.subpath] = mapping;
        content += pkg.isCssLike ? ('/*# sourceMappingURL=' + mapping.getUrl() + '*/') : ('//# sourceMappingURL=' + mapping.getUrl());

      }
      pkg.setContent(content);

      var attrs = unpacked[0].attrs;
      var pkgUrl = pkg.getUrl();
      // 配置了该属性。
      if (opts.attrs) {
        if (typeof opts.attrs === 'string') {
          attrs = attrs + ' ' + opts.attrs;
        } else if (typeof opts.attrs === 'function') {
          attrs = opts.attrs(attrs, pkgUrl);
        }
      }
      list.splice(i, 0, {
        id: pkg.id,
        uri: pkgUrl,
        attrs: attrs,
      });

      resource._map['pkg'][pkg.getId()] = {
        type: 'js',
        uri: pkg.getUrl(),
        has: has
      };

      //给异步加载的pkg加一个标记,并且设置异步模块入口，方便生成resourceMap
      if(isAsyncs){
        resource._map['pkg'][pkg.getId()].asyncs=true;
        pkg.asyncs=true;
        resource._map['pkg'][pkg.getId()].entry=asyncsEntry;
        pkg.entry=asyncsEntry;
        pkg.entry=asyncsEntry;

        if(commandOpts.verbose){
          fis.log.debug(filepath,'打包完成');
        }
      }

      ret.pkg[pkg.subpath] = pkg;
      index++;
    }

    function getMapFile(file) {
      // 同时修改 sourcemap 文件内容。
      var derived = file.derived;
      if (!derived || !derived.length) {
        derived = file.extras && file.extras.derived;
      }

      if (derived && derived[0] && derived[0].rExt === '.map') {
        return derived[0];
      }

      return null;
    }

    //定制化目录处理, 可以传函数进来
    function getFilepath(fun, file) {
      if (typeof(fun) == "function") {
        return fun(file);
      }

      return common.tokenizePath(fun, {
        filepath: file.subpath,
        filename: file.filename,
        hash: file.getHash()
      });
    }

    function contents2sourceNodes(content, filename) {
      var chunks = [];
      var lineIndex = 0;
      content.replace(/.*(\r\n|\n|\r|$)/g, function (line) {
        lineIndex++;
        chunks.push(new SourceMap.SourceNode(lineIndex, 0, filename, line));
      });

      var node = new SourceMap.SourceNode(1, 0, filename, chunks);
      node.setSourceContent(filename, content);

      return node;
    }
  }
};
