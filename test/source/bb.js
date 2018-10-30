module.exports=function(){
  console.log('我是异步模块bb');
  var bb_1=require('bb-1');
  var dd=require('dd');
  bb_1();
  dd();
}
