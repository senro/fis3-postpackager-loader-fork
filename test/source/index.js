var aa=require('./aa');
aa();
require.async(['./bb'],function(bb){
  console.log('异步加载b成功!');
  bb();
});
require.async(['./cc'],function(cc){
  console.log('异步加载cc成功!');
  cc();
});
