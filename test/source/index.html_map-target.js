require.resourceMap({
  "res": {
    "bb": {
      "url": "bb.js",
      "type": "js",
      "pkg":"index.html_bb_js.asyncs"
    },
    "cc": {
      "url": "cc.js",
      "type": "js",
      "pkg":"index.html_cc_js.asyncs"
    }
  },
  "pkg": {
    "index.html_bb_js.asyncs":{
      "uri":"pkg/index.html_bb_js.asyncs.js"
    },
    "index.html_cc_js.asyncs":{
      "uri":"pkg/index.html_cc_js.asyncs.js"
    }
  }
});
