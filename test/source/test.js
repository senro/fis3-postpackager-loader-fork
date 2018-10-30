var aa=require('./aa');
aa();
require.async(['./bb'],function(bb){
  console.log('异步加载b成功!');
  bb();
});
